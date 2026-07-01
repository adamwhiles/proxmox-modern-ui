import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import path from "node:path";
import os from "node:os";
import { formatFingerprint } from "@proxmox-ui/proxmox-client";
import { startFakeProxmoxServer, type FakeProxmoxServer } from "./helpers/fakeProxmoxServer.js";

// Env must be set before the dynamic import of app.ts, since config.ts reads it at module load time.
process.env.APP_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
process.env.COOKIE_SECRET = crypto.randomBytes(32).toString("hex");
process.env.DATABASE_PATH = path.join(os.tmpdir(), `auth-integration-${crypto.randomUUID()}.sqlite`);
process.env.SETUP_TOKEN = "integration-setup-token";
process.env.APP_ADMIN_USERS = "";

const { buildApp } = await import("../src/app.js");

let app: Awaited<ReturnType<typeof buildApp>>;
let proxmox: FakeProxmoxServer;
let clusterId: string;

function extractCookie(setCookieHeaders: string[] | undefined, name: string): string | undefined {
  const header = setCookieHeaders?.find((h) => h.startsWith(`${name}=`));
  return header?.split(";")[0]?.split("=")[1];
}

beforeAll(async () => {
  proxmox = await startFakeProxmoxServer();
  app = await buildApp();

  const registerRes = await app.inject({
    method: "POST",
    url: "/api/clusters",
    headers: { "x-setup-token": "integration-setup-token" },
    payload: {
      name: "Fake Cluster",
      host: "127.0.0.1",
      port: proxmox.port,
      defaultRealm: "pam",
      tlsFingerprint: formatFingerprint(proxmox.fingerprint),
    },
  });
  expect(registerRes.statusCode).toBe(201);
  clusterId = registerRes.json().id;
});

afterAll(async () => {
  await app.close();
  await proxmox.close();
});

describe("cluster bootstrap", () => {
  it("refuses to register a second cluster without a valid admin session or setup token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/clusters",
      payload: { name: "x", host: "127.0.0.1", port: 8006, defaultRealm: "pam", tlsFingerprint: formatFingerprint(proxmox.fingerprint) },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("login", () => {
  it("rejects invalid credentials with a generic 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { clusterId, username: "testuser", password: "wrong-password", realm: "pam" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Invalid credentials");
  });

  it("succeeds with valid credentials and sets an HttpOnly session cookie plus a readable CSRF cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { clusterId, username: "testuser", password: "correct-password", realm: "pam" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().username).toBe("testuser@pam");

    const cookies = res.cookies;
    const sidCookie = cookies.find((c) => c.name === "sid");
    const csrfCookie = cookies.find((c) => c.name === "csrf_token");
    expect(sidCookie?.httpOnly).toBe(true);
    expect(sidCookie?.sameSite).toBe("Strict");
    expect(csrfCookie?.httpOnly).toBeFalsy();
  });
});

describe("CSRF protection", () => {
  let sessionCookie: string;
  let csrfToken: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { clusterId, username: "testuser", password: "correct-password", realm: "pam" },
    });
    sessionCookie = res.cookies.find((c) => c.name === "sid")!.value;
    csrfToken = res.cookies.find((c) => c.name === "csrf_token")!.value;
  });

  it("blocks a state-changing request without the CSRF header even with a valid session cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: { sid: sessionCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it("allows the request once the correct CSRF header is echoed back", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: { sid: sessionCookie },
      headers: { "x-csrf-token": csrfToken },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("login rate limiting", () => {
  it("locks out further attempts after repeated failures from the same client", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 7 }, () =>
        app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { clusterId, username: "testuser", password: "wrong-password", realm: "pam" },
        }),
      ),
    );
    const statusCodes = attempts.map((r) => r.statusCode);
    expect(statusCodes).toContain(429);
  });
});
