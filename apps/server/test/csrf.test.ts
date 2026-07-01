import { describe, it, expect } from "vitest";
import type { FastifyRequest } from "fastify";
import { requiresCsrfCheck, verifyCsrf } from "../src/security/csrf.js";
import type { SessionData } from "../src/security/sessionStore.js";

function fakeRequest(overrides: Partial<FastifyRequest>): FastifyRequest {
  return overrides as FastifyRequest;
}

const session: SessionData = { clusters: {}, csrfToken: "correct-token" };

describe("requiresCsrfCheck", () => {
  it("does not require CSRF checks for safe methods", () => {
    expect(requiresCsrfCheck(fakeRequest({ method: "GET" }))).toBe(false);
    expect(requiresCsrfCheck(fakeRequest({ method: "HEAD" }))).toBe(false);
    expect(requiresCsrfCheck(fakeRequest({ method: "OPTIONS" }))).toBe(false);
  });

  it("requires CSRF checks for state-changing methods", () => {
    expect(requiresCsrfCheck(fakeRequest({ method: "POST" }))).toBe(true);
    expect(requiresCsrfCheck(fakeRequest({ method: "PUT" }))).toBe(true);
    expect(requiresCsrfCheck(fakeRequest({ method: "DELETE" }))).toBe(true);
  });
});

describe("verifyCsrf", () => {
  it("passes when there is no session yet (e.g. the login request itself)", () => {
    expect(verifyCsrf(fakeRequest({ session: null, headers: {} }))).toBe(true);
  });

  it("rejects a mutating request with no CSRF header", () => {
    expect(verifyCsrf(fakeRequest({ session, headers: {} }))).toBe(false);
  });

  it("rejects a mutating request with a wrong CSRF header", () => {
    expect(verifyCsrf(fakeRequest({ session, headers: { "x-csrf-token": "wrong-token" } }))).toBe(false);
  });

  it("accepts a mutating request whose header matches the session token", () => {
    expect(verifyCsrf(fakeRequest({ session, headers: { "x-csrf-token": "correct-token" } }))).toBe(true);
  });
});
