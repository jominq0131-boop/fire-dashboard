import { expect, test } from "@playwright/test";

test("create, edit, deactivate and reactivate survive reload without inventing balances", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("口座名", { exact: true }).fill("  テスト口座  ");
  await page.getByLabel("口座の種類").selectOption("nisa_growth");
  await page.getByRole("button", { name: "口座を追加", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("口座をこの端末に保存しました。");
  await page.reload();
  const row = page.getByRole("listitem").filter({ hasText: "テスト口座" });
  await expect(row).toContainText("NISA 成長投資枠 · 利用中");
  await page.getByRole("button", { name: "テスト口座を編集", exact: true }).click();
  await page.getByLabel("口座名", { exact: true }).fill("更新テスト");
  await page.getByLabel("口座の種類").selectOption("cash");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.getByRole("status")).toContainText("保存しました");
  await page.getByRole("button", { name: "更新テストを休止", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("データは保持");
  await page.reload();
  await expect(page.getByRole("listitem")).toContainText("現金・預金 · 休止中");
  await expect(page.getByText("0 件の利用中口座", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "更新テストを再開", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("再開しました");
  await page.reload();
  await expect(page.getByRole("listitem")).toContainText("利用中");
  await expect(page.getByLabel("金融資産: データなし", { exact: true })).toHaveText("—");
});

test("invalid names preserve the draft and do not create an account", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("口座名", { exact: true }).fill("   ");
  await page.getByRole("button", { name: "口座を追加", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("1〜100文字");
  await expect(page.getByLabel("口座名", { exact: true })).toHaveValue("   ");
  await expect(page.getByRole("listitem")).toHaveCount(0);
});

test("cancelling an edit does not change stored data", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("口座名", { exact: true }).fill("取消テスト");
  await page.getByRole("button", { name: "口座を追加", exact: true }).click();
  await page.getByRole("button", { name: "取消テストを編集", exact: true }).click();
  await page.getByLabel("口座名", { exact: true }).fill("保存しない名前");
  await page.getByRole("button", { name: "編集をやめる" }).click();
  await page.reload();
  await expect(page.getByRole("listitem")).toContainText("取消テスト");
  await expect(page.getByText("保存しない名前", { exact: true })).toHaveCount(0);
});

test("unavailable storage shows an error and disables writes", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new DOMException("Denied", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await expect(page.locator("#accounts").getByRole("alert")).toContainText(
    "保存領域を利用できません",
  );
  await expect(page.getByRole("button", { name: "口座を追加", exact: true })).toBeDisabled();
  await expect(page.getByRole("status")).toBeEmpty();
});

test("a failed write retains the draft and never reports success", async ({ page }) => {
  await page.addInitScript(() => {
    IDBObjectStore.prototype.add = function () {
      throw new DOMException("Synthetic quota failure", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await page.getByLabel("口座名", { exact: true }).fill("保存失敗テスト");
  await page.getByRole("button", { name: "口座を追加", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("status")).toBeEmpty();
  await expect(page.getByLabel("口座名", { exact: true })).toHaveValue("保存失敗テスト");
  await page.reload();
  await expect(page.getByText("口座はまだ登録されていません。", { exact: true })).toBeVisible();
});

test("stale edits in a second tab do not overwrite a committed change", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByLabel("口座名", { exact: true }).fill("競合テスト");
  await page.getByRole("button", { name: "口座を追加", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("保存しました");
  const second = await context.newPage();
  await second.goto("/");
  await second.getByRole("button", { name: "競合テストを編集", exact: true }).click();
  await page.getByRole("button", { name: "競合テストを休止", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("休止しました");
  await second.getByLabel("口座名", { exact: true }).fill("古いタブの変更");
  await second.getByRole("button", { name: "変更を保存" }).click();
  await expect(second.getByRole("alert")).toContainText("別のタブで変更");
  await expect(second.getByLabel("口座名", { exact: true })).toHaveValue("古いタブの変更");
  await second.reload();
  await expect(second.getByRole("listitem")).toContainText("競合テスト");
  await expect(second.getByRole("listitem")).toContainText("休止中");
});

test("real IndexedDB migration, concurrent creation, reopen and abort preserve records", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const modulePath = new URL("src/infrastructure/indexeddb-accounts.ts", location.href).href;
    const { IndexedDbAccountRepository, openAccountDatabase } = await import(modulePath);
    const name = "synthetic-integration";
    const repository = new IndexedDbAccountRepository(name);
    const db = await openAccountDatabase(name);
    const version = db.version;
    const stores = Array.from(db.objectStoreNames);
    const keyPath = db.transaction("accounts").objectStore("accounts").keyPath;
    db.close();
    const details = { name: "同名テスト", category: "cash", isActive: true };
    const created = await Promise.all([repository.create(details), repository.create(details)]);
    const reopened = await new IndexedDbAccountRepository(name).list();
    const failedDb = await openAccountDatabase(name);
    await new Promise<void>((resolve) => {
      const transaction = failedDb.transaction("accounts", "readwrite");
      transaction.objectStore("accounts").put({ ...created[0], name: "未確定の変更" });
      transaction.onabort = () => {
        failedDb.close();
        resolve();
      };
      transaction.abort();
    });
    const afterAbort = await repository.list();
    return {
      version,
      stores,
      keyPath,
      distinctIds: created[0].id !== created[1].id,
      orders: reopened.map((item: { sortOrder: number }) => item.sortOrder),
      preserved: JSON.stringify(reopened) === JSON.stringify(afterAbort),
    };
  });
  expect(result).toEqual({
    version: 4,
    stores: ["accountBalanceSnapshots", "accounts", "firePlans", "monthlyCashFlows"],
    keyPath: "id",
    distinctIds: true,
    orders: [0, 1],
    preserved: true,
  });
});

test("unknown future schema is rejected without deleting data", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const name = "synthetic-future";
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(name, 5);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("future").put("preserve", "key");
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    const modulePath = new URL("src/infrastructure/indexeddb-accounts.ts", location.href).href;
    const { IndexedDbAccountRepository } = await import(modulePath);
    let rejected = false;
    try {
      await new IndexedDbAccountRepository(name).list();
    } catch {
      rejected = true;
    }
    const value = await new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 5);
      request.onsuccess = () => {
        const db = request.result;
        const read = db.transaction("future").objectStore("future").get("key");
        read.onsuccess = () => {
          db.close();
          resolve(read.result);
        };
      };
      request.onerror = () => reject(request.error);
    });
    return { rejected, value };
  });
  expect(result).toEqual({ rejected: true, value: "preserve" });
});

test("invalid stored account is not silently discarded or overwritten", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "口座を追加", exact: true })).toBeEnabled();
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const request = indexedDB.open("fire-dashboard", 4);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("accounts", "readwrite");
        tx.objectStore("accounts").add({ id: "synthetic-invalid", name: "invalid" });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("保存済みの口座データを読み取れません");
  await expect(page.getByRole("button", { name: "口座を追加", exact: true })).toBeDisabled();
});

test("an asynchronous constraint failure is rejected after abort, preserving the first record", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const modulePath = new URL("src/infrastructure/indexeddb-accounts.ts", location.href).href;
    const { IndexedDbAccountRepository } = await import(modulePath);
    const repository = new IndexedDbAccountRepository("synthetic-constraint");
    const original = crypto.randomUUID;
    crypto.randomUUID = () => "00000000-0000-4000-8000-000000000001";
    try {
      await repository.create({ name: "保持する口座", category: "cash", isActive: true });
      let rejected = false;
      try {
        await repository.create({ name: "重複ID", category: "cash", isActive: true });
      } catch {
        rejected = true;
      }
      const accounts = await repository.list();
      return { rejected, names: accounts.map((item: { name: string }) => item.name) };
    } finally {
      crypto.randomUUID = original;
    }
  });
  expect(result).toEqual({ rejected: true, names: ["保持する口座"] });
});

test("versionchange closes idle connections so a later upgrade is not blocked", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const modulePath = new URL("src/infrastructure/indexeddb-accounts.ts", location.href).href;
    const { openAccountDatabase } = await import(modulePath);
    await openAccountDatabase("synthetic-versionchange");
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("synthetic-versionchange", 5);
      request.onblocked = () => reject(new Error("Upgrade blocked"));
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const version = request.result.version;
        request.result.close();
        resolve(version);
      };
    });
  });
  expect(result).toBe(5);
});

test("blocked open is surfaced and its late connection is closed", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const modulePath = new URL("src/infrastructure/indexeddb-accounts.ts", location.href).href;
    const { openAccountDatabase } = await import(modulePath);
    // Simulate an open event sequence; normal native upgrade/close is tested above.
    const factory = indexedDB;
    const original = factory.open.bind(factory);
    const fake = {
      onblocked: null as (() => void) | null,
      onsuccess: null as (() => void) | null,
      result: {
        close() {
          closed = true;
        },
      },
    };
    let closed = false;
    factory.open = (() => fake) as unknown as typeof indexedDB.open;
    try {
      const opened = openAccountDatabase("synthetic-blocked");
      fake.onblocked?.();
      let message = "";
      try {
        await opened;
      } catch (error) {
        message = (error as Error).message;
      }
      fake.onsuccess?.();
      return { message, closed };
    } finally {
      factory.open = original;
    }
  });
  expect(result.message).toContain("別のタブが保存領域を使用");
  expect(result.closed).toBe(true);
});
