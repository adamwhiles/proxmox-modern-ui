import { describe, it, expect, afterEach } from "vitest";
import { request } from "undici";
import { startFakeProxmoxServer, type FakeProxmoxServer } from "./fakeServer.js";
import { createPinnedAgent, CertificateFingerprintMismatchError, formatFingerprint, normalizeFingerprint } from "../src/tls.js";

let server: FakeProxmoxServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe("createPinnedAgent", () => {
  it("connects successfully when the fingerprint matches", async () => {
    server = await startFakeProxmoxServer();
    const agent = createPinnedAgent(server.fingerprint);

    const res = await request(`https://127.0.0.1:${server.port}/api2/json/echo`, { dispatcher: agent });
    expect(res.statusCode).toBe(200);
  });

  it("refuses to connect when the fingerprint does not match (MITM protection)", async () => {
    server = await startFakeProxmoxServer();
    const wrongFingerprint = "00".repeat(32);
    const agent = createPinnedAgent(wrongFingerprint);

    await expect(request(`https://127.0.0.1:${server.port}/api2/json/echo`, { dispatcher: agent })).rejects.toThrow();
  });
});

describe("fingerprint helpers", () => {
  it("normalizes and reformats fingerprints consistently", () => {
    const colonForm = "AB:CD:EF:01".repeat(8).slice(0, 95);
    const normalized = normalizeFingerprint(colonForm);
    expect(normalized).not.toContain(":");
    expect(formatFingerprint(normalized)).toContain(":");
  });
});

it("exports a typed mismatch error", () => {
  const err = new CertificateFingerprintMismatchError("AA", "BB");
  expect(err.expected).toBe("AA");
  expect(err.actual).toBe("BB");
  expect(err.message).toContain("mismatch");
});
