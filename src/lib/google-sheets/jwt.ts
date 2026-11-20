import "server-only";
import { createSign } from "node:crypto";

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

/** Sign a Google service-account assertion (RS256 JWT). Pure; no network. */
export function signServiceAccountJwt(input: {
  clientEmail: string;
  privateKey: string;
  scope: string;
  nowSeconds: number;
  lifetimeSeconds?: number;
}): string {
  const { clientEmail, privateKey, scope, nowSeconds, lifetimeSeconds = 3600 } = input;
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: clientEmail,
      scope,
      aud: GOOGLE_TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + lifetimeSeconds,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  // The signer error message can echo key-parsing details; callers wrap it without the original text.
  const signature = signer.sign(privateKey);
  return `${unsigned}.${b64url(signature)}`;
}
