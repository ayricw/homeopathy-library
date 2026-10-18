import { describe, expect, it } from "vitest";
import { cleanDate, cleanName, cleanVisit, importKey, nameContext, open, seal, MAX_VISIT_RUBRICS } from "../shared/clients";
import { clientsAllowed } from "../worker/clients";

const secret = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const other = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));

describe("client record encryption", () => {
  it("round-trips and never stores the plain text", async () => {
    const key = await importKey(secret);
    const sealed = await seal(key, nameContext("a"), "Jane Test");
    expect(sealed).toMatch(/^v1:/);
    expect(sealed).not.toContain("Jane");
    expect(await open(key, nameContext("a"), sealed)).toBe("Jane Test");
    expect(await seal(key, nameContext("a"), "Jane Test")).not.toBe(sealed); // fresh IV each time
  });

  it("refuses a value moved to another record, or opened with another key", async () => {
    const key = await importKey(secret);
    const sealed = await seal(key, nameContext("a"), "Jane Test");
    await expect(open(key, nameContext("b"), sealed)).rejects.toThrow();
    await expect(open(await importKey(other), nameContext("a"), sealed)).rejects.toThrow();
  });

  it("handles long notes and rejects a key that is not 32 bytes", async () => {
    const key = await importKey(secret);
    const long = "é".repeat(20_000);
    expect(await open(key, "x", await seal(key, "x", long))).toBe(long);
    await expect(importKey(undefined)).rejects.toThrow(/32 random bytes/);
    await expect(importKey("not base64!")).rejects.toThrow(/32 random bytes/);
    await expect(importKey(btoa("short"))).rejects.toThrow(/32 random bytes/);
  });
});

describe("client record validation", () => {
  it("cleans names", () => {
    expect(cleanName("  Jane   Test ")).toEqual({ ok: true, value: "Jane Test" });
    expect(cleanName("   ").ok).toBe(false);
    expect(cleanName(42).ok).toBe(false);
    expect(cleanName("x".repeat(101)).ok).toBe(false);
  });

  it("accepts only real dates", () => {
    expect(cleanDate("2026-10-18").ok).toBe(true);
    expect(cleanDate("2026-02-30").ok).toBe(false);
    expect(cleanDate("18/10/2026").ok).toBe(false);
  });

  it("checks visits and drops repeated rubrics", () => {
    expect(cleanVisit({ rubrics: ["Ear, pain", "Ear, pain "], notes: "n", remedy: " Puls. " })).toEqual({
      ok: true,
      value: { rubrics: ["Ear, pain"], method: "symptoms", notes: "n", remedy: "Puls." },
    });
    expect(cleanVisit({ rubrics: [1] }).ok).toBe(false);
    expect(cleanVisit({ method: "other" }).ok).toBe(false);
    expect(cleanVisit({ rubrics: Array.from({ length: MAX_VISIT_RUBRICS + 1 }, (_, i) => `R${i}`) }).ok).toBe(false);
    expect(cleanVisit({ notes: "x".repeat(20_001) }).ok).toBe(false);
  });
});

describe("who can use client records", () => {
  const db = {} as D1Database;
  const env = { CLIENTS: db, CLIENT_KEY: secret, CLIENT_EMAILS: "robyn@example.com", ENVIRONMENT: "dev" };
  it("allows only listed emails, and only when the database and key are set up", () => {
    expect(clientsAllowed(env, { local: false, email: "robyn@example.com" })).toBe(true);
    expect(clientsAllowed(env, { local: false, email: "other@example.com" })).toBe(false);
    expect(clientsAllowed(env, { local: false, email: null })).toBe(false);
    expect(clientsAllowed({ ...env, CLIENT_KEY: undefined }, { local: false, email: "robyn@example.com" })).toBe(false);
    expect(clientsAllowed({ ...env, CLIENT_EMAILS: undefined }, { local: false, email: "robyn@example.com" })).toBe(false);
    expect(clientsAllowed({ ...env, CLIENTS: undefined }, { local: true, email: null })).toBe(false);
    expect(clientsAllowed({ ...env, CLIENT_KEY: undefined }, { local: true, email: null })).toBe(true);
  });
});
