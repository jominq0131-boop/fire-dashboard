import { expect, test } from "@playwright/test";

test("create, edit, deactivate and reactivate survive reload without inventing balances", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("계좌명", { exact: true }).fill("  테스트계좌  ");
  await page.getByLabel("계좌 종류").selectOption("nisa_growth");
  await page.getByRole("button", { name: "계좌 추가", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("계좌를 이 기기에 저장했습니다.");
  await page.reload();
  const row = page.getByRole("listitem").filter({ hasText: "테스트계좌" });
  await expect(row).toContainText("NISA 성장투자 한도 · 사용 중");
  await page.getByRole("button", { name: "테스트계좌 편집", exact: true }).click();
  await page.getByLabel("계좌명", { exact: true }).fill("갱신테스트");
  await page.getByLabel("계좌 종류").selectOption("cash");
  await page.getByRole("button", { name: "변경 저장" }).click();
  await expect(page.getByRole("status")).toContainText("저장했습니다");
  await page.getByRole("button", { name: "갱신테스트 사용 중지", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("데이터는 보존");
  await page.reload();
  await expect(page.getByRole("listitem")).toContainText("현금·예금 · 사용 중지");
  await expect(page.getByText("0개의 사용 중인 계좌", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "갱신테스트 사용 재개", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("계좌 사용을 재개했습니다");
  await page.reload();
  await expect(page.getByRole("listitem")).toContainText("사용 중");
  await expect(page.getByLabel("금융자산: 데이터 없음", { exact: true })).toHaveText("—");
});

test("invalid names preserve the draft and do not create an account", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("계좌명", { exact: true }).fill("   ");
  await page.getByRole("button", { name: "계좌 추가", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("1~100자");
  await expect(page.getByLabel("계좌명", { exact: true })).toHaveValue("   ");
  await expect(page.getByRole("listitem")).toHaveCount(0);
});

test("cancelling an edit does not change stored data", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("계좌명", { exact: true }).fill("취소테스트");
  await page.getByRole("button", { name: "계좌 추가", exact: true }).click();
  await page.getByRole("button", { name: "취소테스트 편집", exact: true }).click();
  await page.getByLabel("계좌명", { exact: true }).fill("저장하지 않는 이름");
  await page.getByRole("button", { name: "편집 취소" }).click();
  await page.reload();
  await expect(page.getByRole("listitem")).toContainText("취소테스트");
  await expect(page.getByText("저장하지 않는 이름", { exact: true })).toHaveCount(0);
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
    "저장 공간을 사용할 수 없습니다",
  );
  await expect(page.getByRole("button", { name: "계좌 추가", exact: true })).toBeDisabled();
  await expect(page.getByRole("status")).toBeEmpty();
});

test("a failed write retains the draft and never reports success", async ({ page }) => {
  await page.addInitScript(() => {
    IDBObjectStore.prototype.add = function () {
      throw new DOMException("Synthetic quota failure", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await page.getByLabel("계좌명", { exact: true }).fill("저장 실패테스트");
  await page.getByRole("button", { name: "계좌 추가", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("status")).toBeEmpty();
  await expect(page.getByLabel("계좌명", { exact: true })).toHaveValue("저장 실패테스트");
  await page.reload();
  await expect(page.getByText("등록된 계좌가 없습니다.", { exact: true })).toBeVisible();
});

test("stale edits in a second tab do not overwrite a committed change", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByLabel("계좌명", { exact: true }).fill("충돌테스트");
  await page.getByRole("button", { name: "계좌 추가", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("저장했습니다");
  const second = await context.newPage();
  await second.goto("/");
  await second.getByRole("button", { name: "충돌테스트 편집", exact: true }).click();
  await page.getByRole("button", { name: "충돌테스트 사용 중지", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("계좌 사용을 중지했습니다");
  await second.getByLabel("계좌명", { exact: true }).fill("이전 탭의 변경");
  await second.getByRole("button", { name: "변경 저장" }).click();
  await expect(second.getByRole("alert")).toContainText("다른 탭에서 계좌가 변경");
  await expect(second.getByLabel("계좌명", { exact: true })).toHaveValue("이전 탭의 변경");
  await second.reload();
  await expect(second.getByRole("listitem")).toContainText("충돌테스트");
  await expect(second.getByRole("listitem")).toContainText("사용 중지");
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
    const details = { name: "동일 이름테스트", category: "cash", isActive: true };
    const created = await Promise.all([repository.create(details), repository.create(details)]);
    const reopened = await new IndexedDbAccountRepository(name).list();
    const failedDb = await openAccountDatabase(name);
    await new Promise<void>((resolve) => {
      const transaction = failedDb.transaction("accounts", "readwrite");
      transaction.objectStore("accounts").put({ ...created[0], name: "미확정 변경" });
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
    version: 5,
    stores: ["accountBalanceSnapshots", "accounts", "firePlans", "goalPlans", "monthlyCashFlows"],
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
      const request = indexedDB.open(name, 6);
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
      const request = indexedDB.open(name, 6);
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
  await expect(page.getByRole("button", { name: "계좌 추가", exact: true })).toBeEnabled();
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const request = indexedDB.open("fire-dashboard", 5);
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
  await expect(page.getByRole("alert")).toContainText("저장된 계좌 데이터를 읽을 수 없습니다");
  await expect(page.getByRole("button", { name: "계좌 추가", exact: true })).toBeDisabled();
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
      await repository.create({ name: "보존할 계좌", category: "cash", isActive: true });
      let rejected = false;
      try {
        await repository.create({ name: "중복ID", category: "cash", isActive: true });
      } catch {
        rejected = true;
      }
      const accounts = await repository.list();
      return { rejected, names: accounts.map((item: { name: string }) => item.name) };
    } finally {
      crypto.randomUUID = original;
    }
  });
  expect(result).toEqual({ rejected: true, names: ["보존할 계좌"] });
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
      const request = indexedDB.open("synthetic-versionchange", 6);
      request.onblocked = () => reject(new Error("Upgrade blocked"));
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const version = request.result.version;
        request.result.close();
        resolve(version);
      };
    });
  });
  expect(result).toBe(6);
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
  expect(result.message).toContain("다른 탭에서 저장 공간을 사용");
  expect(result.closed).toBe(true);
});
