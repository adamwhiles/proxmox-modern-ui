import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import path from "node:path";
import os from "node:os";

// config.ts reads env vars at import time, so they must be set before the dynamic import below
// (static imports are hoisted and would run first, defeating this).
process.env.APP_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
process.env.COOKIE_SECRET = crypto.randomBytes(32).toString("hex");
process.env.DATABASE_PATH = path.join(os.tmpdir(), `appadmin-test-${crypto.randomUUID()}.sqlite`);
process.env.APP_ADMIN_USERS = "root@pam,alice@pve";
process.env.SETUP_TOKEN = "the-setup-token";

const { isAppAdmin, canBootstrapWithSetupToken } = await import("../src/security/appAdmin.js");
const { ensureSchema } = await import("../src/db/client.js");
const { createCluster } = await import("../src/db/repositories/clusters.js");

ensureSchema();

describe("isAppAdmin", () => {
  it("recognizes identities in APP_ADMIN_USERS", () => {
    expect(isAppAdmin("root", "pam")).toBe(true);
    expect(isAppAdmin("alice", "pve")).toBe(true);
  });

  it("rejects identities not in the list", () => {
    expect(isAppAdmin("mallory", "pam")).toBe(false);
    expect(isAppAdmin("root", "pve")).toBe(false); // realm must match exactly too
  });
});

describe("canBootstrapWithSetupToken", () => {
  it("accepts the correct token while the registry is empty", () => {
    expect(canBootstrapWithSetupToken("the-setup-token")).toBe(true);
  });

  it("rejects a wrong or missing token", () => {
    expect(canBootstrapWithSetupToken("wrong-token")).toBe(false);
    expect(canBootstrapWithSetupToken(undefined)).toBe(false);
  });

  it("closes the bootstrap window once a cluster has been registered", () => {
    createCluster({
      name: "test",
      host: "127.0.0.1",
      port: 8006,
      defaultRealm: "pam",
      tlsFingerprint: "AA:BB".repeat(16).slice(0, 95),
    });
    expect(canBootstrapWithSetupToken("the-setup-token")).toBe(false);
  });
});
