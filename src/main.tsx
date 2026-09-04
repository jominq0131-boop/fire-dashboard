import { IndexedDbMonthlyRepository } from "./infrastructure/indexeddb-monthly";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { IndexedDbAccountRepository } from "./infrastructure/indexeddb-accounts";
import "./app/styles.css";

const accountRepository = new IndexedDbAccountRepository();
const monthlyRepository = new IndexedDbMonthlyRepository();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App accountRepository={accountRepository} monthlyRepository={monthlyRepository} />
  </StrictMode>,
);
