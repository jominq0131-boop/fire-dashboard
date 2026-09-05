import { IndexedDbPortfolioRepository } from "./infrastructure/indexeddb-portfolio";
import { IndexedDbMonthlyRepository } from "./infrastructure/indexeddb-monthly";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { IndexedDbAccountRepository } from "./infrastructure/indexeddb-accounts";
import { IndexedDbFirePlanRepository } from "./infrastructure/indexeddb-fire-plan";
import "./app/styles.css";
import "./app/theme.css";
import "./app/brand.css";

const accountRepository = new IndexedDbAccountRepository();
const monthlyRepository = new IndexedDbMonthlyRepository();
const portfolioRepository = new IndexedDbPortfolioRepository();
const firePlanRepository = new IndexedDbFirePlanRepository();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App
      accountRepository={accountRepository}
      monthlyRepository={monthlyRepository}
      portfolioRepository={portfolioRepository}
      backupRepository={portfolioRepository}
      firePlanRepository={firePlanRepository}
    />
  </StrictMode>,
);
