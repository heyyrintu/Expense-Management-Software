// Next.js calls register() once per server process, before the first
// request. That makes it the only place a configuration error can be caught
// at BOOT rather than by whoever happens to hit the affected screen first.
export async function register(): Promise<void> {
  // Skip during `next build`: the build renders pages without the runtime
  // secrets a deploy provides, so validating here would fail every CI build
  // for variables that are present in the environment that matters.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertEnv } = await import("@/lib/env");
  assertEnv();
}
