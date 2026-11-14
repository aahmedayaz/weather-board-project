import { z } from 'zod';

/**
 * Zod v4 probes for `new Function` support on first use, to JIT-compile validators. Our CSP
 * forbids eval, so the probe throws — Zod catches it, but the browser still records a CSP
 * violation (a DevTools "issue" on every load). `jitless` skips the probe; under this CSP the
 * JIT could never be used anyway, so nothing is lost. Import this module before any schema
 * is parsed (it is the first import in main.tsx and sw.ts).
 */
z.config({ jitless: true });
