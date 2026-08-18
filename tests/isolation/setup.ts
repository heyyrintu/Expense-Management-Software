// Loads .env for local runs (CI sets env directly) and provides
// docker-compose defaults so `npm run test:isolation` just works.
import { config } from "dotenv";

config();

process.env.DATABASE_URL ??=
  "postgresql://expense_app:expense_app@localhost:5432/expense_dev?schema=public";
process.env.DIRECT_DATABASE_URL ??=
  "postgresql://expense:expense@localhost:5432/expense_dev?schema=public";
process.env.AUTH_SECRET ??= "isolation-test-secret";
