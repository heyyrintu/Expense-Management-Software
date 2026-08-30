// Next.js calls register() once per server process, before the first
// request. That makes it the only place a configuration error can be caught
// at BOOT rather than by whoever happens to hit the affected screen first.
export async function register(): Promise<void> {
  // Skip during `next build`: the build renders pages without the runtime
  // secrets a deploy provides, so validating here would fail every CI build
  // over variables that are present in the environment that matters.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertEnv } = await import("@/lib/env");
  try {
    assertEnv();
  } catch (err) {
    // Throwing out of register() is NOT enough on its own. Next logs
    // "Failed to prepare server", turns it into an unhandledRejection, and
    // leaves the process alive — so the container keeps running, serves
    // nothing, and any orchestrator watching the process reports a healthy
    // deploy. Exiting non-zero is what makes the deploy actually fail.
    console.error(err instanceof Error ? err.message : String(err));
    if (process.env.NODE_ENV === "production") process.exit(1);
    throw err;
  }
}
