import { expect, test } from "@playwright/test";

test("v1 migration preserves accounts and rollback preserves v1 before retry", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { openAccountDatabase } = await import(
      new URL("src/infrastructure/indexeddb-accounts.ts", location.href).href
    );
    const account = {
      id: "synthetic-old",
      name: "旧口座",
      category: "cash",
      isActive: false,
      sortOrder: 7,
    };
    const name = "synthetic-v1-monthly";
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () =>
        r.result.createObjectStore("accounts", { keyPath: "id" }).add(account);
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        r.result.close();
        resolve();
      };
    });
    const original = IDBDatabase.prototype.createObjectStore;
    IDBDatabase.prototype.createObjectStore = function (store, options) {
      if (store === "accountBalanceSnapshots") throw new Error("synthetic upgrade failure");
      return original.call(this, store, options);
    };
    let failed = false;
    try {
      await openAccountDatabase(name);
    } catch {
      failed = true;
    } finally {
      IDBDatabase.prototype.createObjectStore = original;
    }
    const afterFailure = await new Promise<{ version: number; stores: string[] }>(
      (resolve, reject) => {
        const r = indexedDB.open(name);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result;
          const value = { version: db.version, stores: Array.from(db.objectStoreNames) };
          db.close();
          resolve(value);
        };
      },
    );
    const db = await openAccountDatabase(name);
    const preserved = await new Promise((resolve) => {
      const tx = db.transaction("accounts");
      const r = tx.objectStore("accounts").get(account.id);
      tx.oncomplete = () => resolve(r.result);
    });
    const tx = db.transaction(["monthlyCashFlows", "accountBalanceSnapshots"]);
    const indexes = {
      cash: tx.objectStore("monthlyCashFlows").index("month").unique,
      balance: tx.objectStore("accountBalanceSnapshots").index("monthAccount").unique,
    };
    const version = db.version;
    db.close();
    return { failed, afterFailure, preserved, account, indexes, version };
  });
  expect(result.failed).toBe(true);
  expect(result.afterFailure).toEqual({ version: 1, stores: ["accounts"] });
  expect(result.preserved).toEqual(result.account);
  expect(result.indexes).toEqual({ cash: true, balance: true });
  expect(result.version).toBe(2);
});

test("monthly repository enforces references, concurrent uniqueness, stale edits and commit rollback", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { IndexedDbAccountRepository } = await import(
      new URL("src/infrastructure/indexeddb-accounts.ts", location.href).href
    );
    const { IndexedDbMonthlyRepository } = await import(
      new URL("src/infrastructure/indexeddb-monthly.ts", location.href).href
    );
    const name = "synthetic-monthly-contract",
      accounts = new IndexedDbAccountRepository(name),
      repo = new IndexedDbMonthlyRepository(name);
    const a = await accounts.create({ name: "合成休止口座", category: "cash", isActive: false });
    const cash = { income: 10, expenses: 2, investmentContribution: 3 };
    const race = await Promise.allSettled([
      repo.saveCash("2026-09", cash, null),
      repo.saveCash("2026-09", cash, null),
    ]);
    const initial = await repo.readMonth("2026-09");
    const updated = await repo.saveCash("2026-09", { ...cash, income: 20 }, initial.cash);
    let conflict = false,
      missing = false,
      rollback = false;
    try {
      await repo.saveCash("2026-09", { ...cash, income: 99 }, initial.cash);
    } catch {
      conflict = true;
    }
    try {
      await repo.saveBalance("2026-09", "missing", 1, null);
    } catch {
      missing = true;
    }
    const balances = await Promise.allSettled([
      repo.saveBalance("2026-09", a.id, 0, null),
      repo.saveBalance("2026-09", a.id, 9, null),
    ]);
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const request =
        key === undefined ? original.call(this, value) : original.call(this, value, key);
      this.transaction.abort();
      return request;
    };
    try {
      await repo.saveCash("2026-09", { ...cash, income: 100 }, updated);
    } catch {
      rollback = true;
    } finally {
      IDBObjectStore.prototype.put = original;
    }
    const final = await new IndexedDbMonthlyRepository(name).readMonth("2026-09");
    const empty = await repo.readMonth("2026-10");
    return {
      cashSuccess: race.filter((r) => r.status === "fulfilled").length,
      balanceSuccess: balances.filter((r) => r.status === "fulfilled").length,
      conflict,
      missing,
      rollback,
      final,
      empty,
      createdPreserved: initial.cash.createdAt === updated.createdAt,
    };
  });
  expect(result.cashSuccess).toBe(1);
  expect(result.balanceSuccess).toBe(1);
  expect(result.conflict).toBe(true);
  expect(result.missing).toBe(true);
  expect(result.rollback).toBe(true);
  expect(result.createdPreserved).toBe(true);
  expect(result.final.cash.income).toBe(20);
  expect(result.final.balances).toHaveLength(1);
  expect(result.final.balances[0].balance).toBe(0);
  expect(result.empty).toEqual({ cash: null, balances: [] });
});

test("monthly reads use bounded indexes; oversized counts and malformed records preserve originals", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { IndexedDbMonthlyRepository } = await import(
      new URL("src/infrastructure/indexeddb-monthly.ts", location.href).href
    );
    const { openAccountDatabase } = await import(
      new URL("src/infrastructure/indexeddb-accounts.ts", location.href).href
    );
    const repo = new IndexedDbMonthlyRepository("synthetic-month-limits");
    const cash = await repo.saveCash(
      "2026-09",
      { income: 1, expenses: 0, investmentContribution: 0 },
      null,
    );
    const original = IDBIndex.prototype.getAll,
      limits: number[] = [];
    IDBIndex.prototype.getAll = function (query, count) {
      if (!count || count > 100) throw new Error("unbounded");
      limits.push(count);
      return original.call(this, query, count);
    };
    await repo.readMonth("2026-09");
    IDBIndex.prototype.getAll = original;
    const countOriginal = IDBObjectStore.prototype.count;
    const blocked: boolean[] = [];
    for (const [storeName, total] of [
      ["monthlyCashFlows", 3601],
      ["accountBalanceSnapshots", 360001],
    ] as const) {
      IDBObjectStore.prototype.count = function (query) {
        const request = countOriginal.call(this, query);
        if (this.name === storeName) Object.defineProperty(request, "result", { get: () => total });
        return request;
      };
      IDBIndex.prototype.getAll = function () {
        throw new Error("must not materialize");
      };
      try {
        await repo.readMonth("2026-09");
        blocked.push(false);
      } catch (e) {
        blocked.push((e as Error).message.includes("上限"));
      } finally {
        IDBObjectStore.prototype.count = countOriginal;
        IDBIndex.prototype.getAll = original;
      }
    }
    const preserved = await repo.readMonth("2026-09");
    const db = await openAccountDatabase("synthetic-month-limits");
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("monthlyCashFlows", "readwrite");
      tx.objectStore("monthlyCashFlows").put({ ...cash, unexpected: "synthetic" });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => reject(tx.error);
    });
    let malformed = false;
    try {
      await repo.readMonth("2026-09");
    } catch {
      malformed = true;
    }
    const check = await openAccountDatabase("synthetic-month-limits");
    const raw = await new Promise((resolve) => {
      const tx = check.transaction("monthlyCashFlows");
      const r = tx.objectStore("monthlyCashFlows").get(cash.id);
      tx.oncomplete = () => {
        check.close();
        resolve(r.result);
      };
    });
    return { limits, blocked, preserved: preserved.cash.income, malformed, raw };
  });
  expect(result.limits).toEqual([1, 100]);
  expect(result.blocked).toEqual([true, true]);
  expect(result.preserved).toBe(1);
  expect(result.malformed).toBe(true);
  expect(result.raw).toHaveProperty("unexpected", "synthetic");
});

test("monthly UI saves separate amounts, zero balances and restores after reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("口座名", { exact: true }).fill("合成月末口座");
  await page.getByRole("button", { name: "口座を追加", exact: true }).click();
  await expect(page.getByRole("listitem")).toContainText("合成月末口座");
  const panel = page.getByRole("region", { name: "月別記録" });
  await panel.getByLabel("対象月").fill("2026-09");
  await panel.getByRole("button", { name: "記録を読み込む" }).click();
  await expect(panel.getByLabel("収入", { exact: true })).toHaveValue("");
  await panel.getByLabel("収入", { exact: true }).fill("100");
  await panel.getByLabel("消費支出", { exact: true }).fill("20");
  await panel.getByLabel("投資への拠出", { exact: true }).fill("30");
  await panel.getByRole("button", { name: "現金収支を保存" }).click();
  await expect(panel.getByRole("status")).toContainText("保存しました");
  await expect(panel.getByLabel("合成月末口座の月末残高")).toHaveValue("");
  await panel.getByLabel("合成月末口座の月末残高").fill("0");
  await panel.getByRole("button", { name: "合成月末口座の残高を保存" }).click();
  await expect(panel.getByText("保存済み", { exact: true })).toBeVisible();
  await page.reload();
  await panel.getByLabel("対象月").fill("2026-09");
  await panel.getByRole("button", { name: "記録を読み込む" }).click();
  await expect(panel.getByLabel("収入", { exact: true })).toHaveValue("100");
  await expect(panel.getByLabel("消費支出", { exact: true })).toHaveValue("20");
  await expect(panel.getByLabel("投資への拠出", { exact: true })).toHaveValue("30");
  await expect(panel.getByLabel("合成月末口座の月末残高")).toHaveValue("0");
  await page.screenshot({ path: "test-results/monthly-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel.getByLabel("合成月末口座の月末残高")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/monthly-mobile.png", fullPage: true });
  await panel.getByLabel("収入", { exact: true }).fill("1e3");
  await panel.getByRole("button", { name: "現金収支を保存" }).click();
  await expect(panel.getByRole("alert")).toContainText("整数");
  await expect(panel.getByLabel("収入", { exact: true })).toHaveValue("1e3");
  page.once("dialog", (d) => d.dismiss());
  await panel.getByLabel("対象月").fill("2026-10");
  await expect(panel.getByLabel("対象月")).toHaveValue("2026-09");
  page.once("dialog", (d) => d.accept());
  await panel.getByLabel("対象月").fill("2026-10");
  await panel.getByRole("button", { name: "記録を読み込む" }).click();
  await expect(panel.getByLabel("収入", { exact: true })).toHaveValue("");
});

test("failed monthly save and stale tab retain draft without overwriting", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const panel = page.getByRole("region", { name: "月別記録" });
  await panel.getByLabel("対象月").fill("2026-09");
  await panel.getByRole("button", { name: "記録を読み込む" }).click();
  for (const label of ["収入", "消費支出", "投資への拠出"])
    await panel.getByLabel(label, { exact: true }).fill("1");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (value, key) {
      if (this.name === "monthlyCashFlows")
        throw new DOMException("Synthetic quota", "QuotaExceededError");
      return key === undefined ? original.call(this, value) : original.call(this, value, key);
    };
  });
  await panel.getByRole("button", { name: "現金収支を保存" }).click();
  await expect(panel.getByRole("alert")).toBeVisible();
  await expect(panel.getByLabel("収入", { exact: true })).toHaveValue("1");
  await expect(panel.getByRole("status")).toHaveCount(0);
  page.once("dialog", (d) => d.accept());
  await page.reload();
  await panel.getByLabel("対象月").fill("2026-09");
  await panel.getByRole("button", { name: "記録を読み込む" }).click();
  await expect(panel.getByLabel("収入", { exact: true })).toHaveValue("");
  const second = await context.newPage();
  await second.goto("/");
  const other = second.getByRole("region", { name: "月別記録" });
  await other.getByLabel("対象月").fill("2026-09");
  await other.getByRole("button", { name: "記録を読み込む" }).click();
  for (const label of ["収入", "消費支出", "投資への拠出"]) {
    await panel.getByLabel(label, { exact: true }).fill("2");
    await other.getByLabel(label, { exact: true }).fill("3");
  }
  await panel.getByRole("button", { name: "現金収支を保存" }).click();
  await expect(panel.getByRole("status")).toBeVisible();
  await other.getByRole("button", { name: "現金収支を保存" }).click();
  await expect(other.getByRole("alert")).toBeVisible();
  await expect(other.getByLabel("収入", { exact: true })).toHaveValue("3");
});

test("100 monthly balance rows remain editable and global capacity blocks only new rows", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "口座を追加", exact: true })).toBeEnabled();
  await page.evaluate(async () => {
    const r = indexedDB.open("fire-dashboard", 2);
    await new Promise<void>((resolve, reject) => {
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction(["accounts", "accountBalanceSnapshots"], "readwrite");
        for (let i = 0; i < 100; i++) {
          const id = i === 0 ? "cash" : `synthetic-${i}`;
          tx.objectStore("accounts").add({
            id,
            name: `合成${i}`,
            category: "cash",
            isActive: false,
            sortOrder: i,
          });
          tx.objectStore("accountBalanceSnapshots").add({
            id: `b-${i}`,
            accountId: id,
            month: "2026-09",
            balance: i,
            createdAt: "2026-09-04T00:00:00.000Z",
            updatedAt: "2026-09-04T00:00:00.000Z",
          });
        }
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onabort = () => reject(tx.error);
      };
    });
  });
  const panel = page.getByRole("region", { name: "月別記録" });
  await panel.getByLabel("対象月").fill("2026-09");
  await panel.getByRole("button", { name: "記録を読み込む" }).click();
  await expect(panel.locator(".monthly-balances form")).toHaveCount(100);
  await panel.getByLabel("合成0の月末残高").fill("999");
  await panel.getByRole("button", { name: "合成0の残高を保存", exact: true }).click();
  await expect(panel.getByRole("status")).toBeVisible();
  const result = await page.evaluate(async () => {
    const { IndexedDbMonthlyRepository } = await import(
      new URL("src/infrastructure/indexeddb-monthly.ts", location.href).href
    );
    const repo = new IndexedDbMonthlyRepository();
    const original = IDBObjectStore.prototype.count;
    IDBObjectStore.prototype.count = function (query) {
      const r = original.call(this, query);
      if (this.name === "accountBalanceSnapshots")
        Object.defineProperty(r, "result", { get: () => 360000 });
      return r;
    };
    let blocked = false;
    try {
      const current = await repo.readMonth("2026-09");
      await repo.saveBalance(
        "2026-09",
        "cash",
        1000,
        current.balances.find((b: { accountId: string }) => b.accountId === "cash"),
      );
      try {
        await repo.saveBalance("2026-10", "cash", 1, null);
      } catch {
        blocked = true;
      }
    } finally {
      IDBObjectStore.prototype.count = original;
    }
    const final = await repo.readMonth("2026-09");
    return {
      blocked,
      total: final.balances.length,
      amount: final.balances.find((b: { accountId: string }) => b.accountId === "cash").balance,
      cash: final.cash,
    };
  });
  expect(result).toEqual({ blocked: true, total: 100, amount: 1000, cash: null });
});
