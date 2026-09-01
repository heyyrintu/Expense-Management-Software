import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // .claude/** holds agent-managed git worktrees (full repo checkouts with
    // their own node_modules/.next) — linting them floods the gate with
    // thousands of findings from code that isn't this checkout's source.
    ignores: ["node_modules/**", ".next/**", "out/**", "next-env.d.ts", ".claude/**"],
  },
];

export default eslintConfig;
