import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { checkAccess } from "../worker/access";

const TEAM = "https://example-team.cloudflareaccess.com";
const AUD = "test-aud-tag";
const config = { TEAM_DOMAIN: TEAM, POLICY_AUD: AUD, ALLOWED_EMAILS: "Reader@Example.com, second@example.com" };

let keys: ReturnType<typeof createLocalJWKSet>;
let sign: (claims: Record<string, unknown>, opts?: { iss?: string; aud?: string; exp?: string }) => Promise<string>;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
  keys = createLocalJWKSet({ keys: [jwk] });
  sign = (claims, opts = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(opts.iss ?? TEAM)
      .setAudience(opts.aud ?? AUD)
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? "5m")
      .sign(privateKey);
});

const req = (token?: string) => new Request("https://x.workers.dev/", { headers: token ? { "cf-access-jwt-assertion": token } : {} });

describe("checkAccess", () => {
  it("fails closed when Access is not configured", async () => {
    for (const c of [{}, { ...config, POLICY_AUD: "" }, { ...config, ALLOWED_EMAILS: " , " }, { ...config, TEAM_DOMAIN: "https://evil.example.com" }]) {
      expect(await checkAccess(req(await sign({ email: "reader@example.com" })), c, keys)).toMatchObject({ ok: false, status: 500 });
    }
  });
  it("refuses requests without a token", async () => {
    expect(await checkAccess(req(), config, keys)).toMatchObject({ ok: false, status: 403 });
  });
  it("accepts an allowed email (case-insensitive)", async () => {
    expect(await checkAccess(req(await sign({ email: "reader@example.com" })), config, keys)).toEqual({ ok: true, email: "reader@example.com" });
  });
  it("refuses an email that is not on the list", async () => {
    expect(await checkAccess(req(await sign({ email: "someone@example.com" })), config, keys)).toMatchObject({ ok: false, status: 403 });
  });
  it("refuses tokens for another application or issuer, or expired ones", async () => {
    expect(await checkAccess(req(await sign({ email: "reader@example.com" }, { aud: "other" })), config, keys)).toMatchObject({ ok: false });
    expect(await checkAccess(req(await sign({ email: "reader@example.com" }, { iss: "https://other.cloudflareaccess.com" })), config, keys)).toMatchObject({ ok: false });
    expect(await checkAccess(req(await sign({ email: "reader@example.com" }, { exp: "-1m" })), config, keys)).toMatchObject({ ok: false });
  });
  it("refuses a token signed with a different key", async () => {
    const { privateKey } = await generateKeyPair("RS256");
    const forged = await new SignJWT({ email: "reader@example.com" })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(TEAM)
      .setAudience(AUD)
      .setExpirationTime("5m")
      .sign(privateKey);
    expect(await checkAccess(req(forged), config, keys)).toMatchObject({ ok: false, status: 403 });
  });
});
