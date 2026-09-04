"use client";

// Renders nothing. Exists so that lib/zod-csp.ts is part of the client
// bundle every route loads, evaluated before any schema parses in the
// browser — see that file for why. A component is the honest way to put a
// side-effect module in the client graph: an unused `import` in a server
// component never reaches the browser, and hiding it inside an unrelated
// client component is how it would get lost in a refactor.
import "@/lib/zod-csp";

export function CspRuntime() {
  return null;
}
