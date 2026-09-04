// zod under a nonce Content-Security-Policy.
//
// zod 4 compiles object parsers through `new Function` for speed, after
// probing once whether the runtime allows it. The probe is wrapped in
// try/catch, so under our CSP (lib/security/csp.ts: no 'unsafe-eval' in
// production) parsing still works — but the browser still reports the caught
// `new Function` as a securitypolicyviolation on every page that loads zod,
// and anyone reading CSP reports would chase a phantom injection. zod's own
// comment on `allowsEval` says as much and offers `jitless` to skip the
// probe. The cost is the non-JIT parse path, which for forms this size is
// not measurable.
//
// Imported for its side effect by components/csp-runtime.tsx, which the root
// layout renders, so it runs at bundle evaluation — long before the first
// form submit parses anything. Server-side there is no CSP, so instrumentation
// leaves the default alone.
import { z } from "zod";

z.config({ jitless: true });

export {};
