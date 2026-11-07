import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { AUDIENCE, trustedClaims } from "./model";
const keys = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
export async function verifySecurityWorkflow(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw Error("Missing workflow token");
  const { payload } = await jwtVerify(token, keys, { issuer: "https://token.actions.githubusercontent.com", audience: AUDIENCE, algorithms: ["RS256"], maxTokenAge: "10m" });
  if (!trustedClaims(payload)) throw Error("Untrusted workflow");
  return payload;
}
