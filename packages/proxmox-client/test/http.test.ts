import { describe, it, expect, afterEach } from "vitest";
import { startFakeProxmoxServer, type FakeProxmoxServer } from "./fakeServer.js";
import { ProxmoxHttpClient } from "../src/http.js";
import { ProxmoxAuthError } from "../src/errors.js";

let server: FakeProxmoxServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe("ProxmoxHttpClient", () => {
  it("logs in and stores a ticket on success", async () => {
    server = await startFakeProxmoxServer();
    const client = new ProxmoxHttpClient({ host: "127.0.0.1", port: server.port, tlsFingerprint: server.fingerprint });

    const ticket = await client.login("testuser", "correct-password", "pam");
    expect(ticket.username).toBe("testuser@pam");
    expect(ticket.ticket).toBe("PVE:testuser@pam:FAKETICKET");
    expect(client.getTicket()).toEqual(ticket);
  });

  it("throws ProxmoxAuthError on invalid credentials without leaking details", async () => {
    server = await startFakeProxmoxServer();
    const client = new ProxmoxHttpClient({ host: "127.0.0.1", port: server.port, tlsFingerprint: server.fingerprint });

    await expect(client.login("testuser", "wrong-password", "pam")).rejects.toBeInstanceOf(ProxmoxAuthError);
  });

  it("attaches the ticket cookie and CSRF header on subsequent authenticated requests", async () => {
    server = await startFakeProxmoxServer();
    const client = new ProxmoxHttpClient({ host: "127.0.0.1", port: server.port, tlsFingerprint: server.fingerprint });
    await client.login("testuser", "correct-password", "pam");

    const echo = await client.post<{ cookie: string; csrf: string }>("/echo");
    expect(echo.cookie).toContain("PVEAuthCookie=PVE:testuser@pam:FAKETICKET");
    expect(echo.csrf).toBe("FAKECSRF");
  });

  it("refuses to make authenticated requests before login", async () => {
    server = await startFakeProxmoxServer();
    const client = new ProxmoxHttpClient({ host: "127.0.0.1", port: server.port, tlsFingerprint: server.fingerprint });
    await expect(client.get("/echo")).rejects.toBeInstanceOf(ProxmoxAuthError);
  });

  it("rejects the connection outright if the server's certificate fingerprint changes (pin violation)", async () => {
    server = await startFakeProxmoxServer();
    const client = new ProxmoxHttpClient({ host: "127.0.0.1", port: server.port, tlsFingerprint: "00".repeat(32) });
    await expect(client.login("testuser", "correct-password", "pam")).rejects.toThrow();
  });
});
