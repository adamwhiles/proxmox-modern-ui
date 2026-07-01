import https from "node:https";
import { X509Certificate, createHash } from "node:crypto";
import selfsigned from "selfsigned";

export interface FakeProxmoxServer {
  server: https.Server;
  port: number;
  fingerprint: string;
  close: () => Promise<void>;
}

/**
 * A minimal HTTPS server that mimics just enough of the Proxmox REST API for tests:
 * POST /api2/json/access/ticket, and an authenticated echo endpoint used to verify
 * ticket/CSRF headers are sent correctly on subsequent requests.
 */
export async function startFakeProxmoxServer(
  handler?: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void,
): Promise<FakeProxmoxServer> {
  const pems = selfsigned.generate([{ name: "commonName", value: "127.0.0.1" }], { days: 1, keySize: 2048 });
  const { cert, private: key } = pems;
  const fingerprint = createHash("sha256")
    .update(new X509Certificate(cert).raw)
    .digest("hex")
    .toUpperCase();

  const server = https.createServer({ cert, key }, (req, res) => {
    if (handler) return handler(req, res);
    defaultHandler(req, res);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    server,
    port,
    fingerprint,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function defaultHandler(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    if (req.url === "/api2/json/access/ticket" && req.method === "POST") {
      const params = new URLSearchParams(body);
      const username = params.get("username");
      const password = params.get("password");
      if (username === "testuser@pam" && password === "correct-password") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            data: { ticket: "PVE:testuser@pam:FAKETICKET", CSRFPreventionToken: "FAKECSRF", username: "testuser@pam" },
          }),
        );
        return;
      }
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: null }));
      return;
    }

    if (req.url === "/api2/json/echo") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          data: {
            cookie: req.headers.cookie ?? null,
            csrf: req.headers["csrftpreventiontoken"] ?? req.headers["csrfpreventiontoken"] ?? null,
          },
        }),
      );
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ errors: { message: "not found" } }));
  });
}
