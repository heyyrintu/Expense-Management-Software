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
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    rules: {
      // `motion.div` bundles the entire animation runtime into whichever
      // route renders it. The app loads features lazily through
      // MotionProvider, so components use `m.div` — see
      // components/motion-provider.tsx and lib/motion-features.ts. The one
      // legitimate import of the full runtime is that features module.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "framer-motion",
              importNames: ["motion"],
              message:
                "Use `m` from framer-motion instead of `motion`: the animation features load lazily through MotionProvider, and `motion.*` drags the full runtime (39 KB gzipped) back into the route.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
