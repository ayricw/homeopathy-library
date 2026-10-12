// Cloudflare Access check, applied to every request (website, API and files)
// outside local development. Cloudflare Access already blocks unauthenticated
// visitors at the edge; this is a second, fail-closed layer in the Worker:
// if Access is not configured, or the token is missing, invalid, or for an
// email address that is not on the allow-list, the request is refused.
// See https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface AccessConfig {
  TEAM_DOMAIN?: string; // e.g. https://your-team.cloudflareaccess.com
  POLICY_AUD?: string; // the Access application's AUD tag
  ALLOWED_EMAILS?: string; // comma-separated; a Worker secret, never in Git
}

export type AccessResult = { ok: true; email: string } | { ok: false; status: 403 | 500; reason: string };

const jwksCache = new Map<string, JWTVerifyGetKey>();

function remoteKeys(teamDomain: string): JWTVerifyGetKey {
  let keys = jwksCache.get(teamDomain);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, keys);
  }
  return keys;
}

export function allowedEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function checkAccess(request: Request, config: AccessConfig, keys?: JWTVerifyGetKey): Promise<AccessResult> {
  const teamDomain = config.TEAM_DOMAIN?.replace(/\/+$/, "");
  const emails = allowedEmails(config.ALLOWED_EMAILS);
  if (!teamDomain || !/^https:\/\/[\w-]+\.cloudflareaccess\.com$/.test(teamDomain) || !config.POLICY_AUD || emails.size === 0) {
    return { ok: false, status: 500, reason: "Access is not configured for this deployment yet." };
  }
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return { ok: false, status: 403, reason: "Sign-in required." };
  try {
    const { payload } = await jwtVerify(token, keys ?? remoteKeys(teamDomain), {
      issuer: teamDomain,
      audience: config.POLICY_AUD,
    });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    if (!email || !emails.has(email)) return { ok: false, status: 403, reason: "This account is not allowed." };
    return { ok: true, email };
  } catch {
    return { ok: false, status: 403, reason: "Sign-in token is invalid or expired." };
  }
}
