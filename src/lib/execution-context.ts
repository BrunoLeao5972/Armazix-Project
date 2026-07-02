// Request-scoped ExecutionContext tracker via WeakMap.
// Safe for concurrent requests in the same isolate because each Request
// object is unique — no cross-request state leak possible.
//
// Usage:
//   server.ts:    bindCtx(request, ctx)
//   handlers:     waitUntil(request, backgroundPromise)

type CF_Ctx = { waitUntil(p: Promise<unknown>): void };

const _map = new WeakMap<Request, CF_Ctx>();

export function bindCtx(request: Request, ctx: CF_Ctx): void {
  _map.set(request, ctx);
}

/** Schedule a background promise that must complete before the isolate shuts down. */
export function waitUntil(request: Request, promise: Promise<unknown>): void {
  _map.get(request)?.waitUntil(
    promise.catch(e => console.error("[waitUntil] unhandled:", e)),
  );
}
