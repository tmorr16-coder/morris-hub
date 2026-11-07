import { createRemoteJWKSet, jwtVerify } from "jose";
import { AUDIENCE, parseReport, trustedClaims } from "@/lib/security/model";
import { securityDb, sendSecurityAlerts } from "@/lib/security/server";
export const runtime = "nodejs";
export const maxDuration = 60;
const keys = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
export async function POST(request: Request) {
  let claims;
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) throw Error("Missing token");
    const { payload } = await jwtVerify(token, keys, { issuer: "https://token.actions.githubusercontent.com", audience: AUDIENCE, algorithms: ["RS256"], maxTokenAge: "10m" });
    if (!trustedClaims(payload)) throw Error("Untrusted workflow");
    claims = payload;
  } catch { return Response.json({ error: "Unauthorized workflow" }, { status: 401 }); }
  let report;
  try {
    // Stream limit also protects requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw Error("Missing body");
    let size = 0; const chunks: Uint8Array[] = [];
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 2_000_000) { await reader.cancel(); throw Error("Report too large"); } chunks.push(value); }
    report = parseReport(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (report.runId !== claims.run_id || String(report.attempt) !== claims.run_attempt || report.sha !== claims.sha) throw Error("Report does not match signed run");
  } catch { return Response.json({ error: "Invalid security report" }, { status: 400 }); }
  try {
    const { error } = await securityDb().rpc("ingest_security_report", { report });
    if (error) throw Error("Report persistence failed");
    // Retry notification work even for a duplicate report after a prior transient error.
    await sendSecurityAlerts();
    return Response.json({ accepted: true });
  } catch (e) {
    console.error("Security report processing failed", e instanceof Error ? e.message : "unknown");
    return Response.json({ error: "Security processing unavailable; retry report" }, { status: 503 });
  }
}
