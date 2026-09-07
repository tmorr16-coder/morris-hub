// Next.js instrumentation: the one place every uncaught server error passes
// through, on any route, in any module. Each one is written to the shared
// failure log so the platform status page shows the whole platform, not only
// the integrations that remember to report themselves.

import type { Instrumentation } from "next";

export async function register() {
  // Nothing to set up; the hook below is the point.
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    const { recordFailure } = await import("@/lib/system-events");
    const e = err as { message?: string; digest?: string; name?: string };
    await recordFailure({
      source: "app",
      subject: request.path,
      message: `${context.routeType} ${request.method} ${request.path}: ${e?.message ?? String(err)}`.slice(0, 500),
      detail: {
        name: e?.name ?? null,
        digest: e?.digest ?? null,
        routerKind: context.routerKind,
        routeType: context.routeType,
        renderSource: context.renderSource ?? null,
        revalidateReason: context.revalidateReason ?? null,
      },
    });
  } catch {
    // The logger must never take the request down with it.
  }
};
