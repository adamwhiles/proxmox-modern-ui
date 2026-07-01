import https from "node:https";
import { X509Certificate, createHash } from "node:crypto";
import selfsigned from "selfsigned";

export interface FakeProxmoxServer {
  port: number;
  fingerprint: string;
  close: () => Promise<void>;
}

/** Minimal stand-in for a Proxmox host's /access/ticket endpoint, used to exercise the real login flow end-to-end. */
export async function startFakeProxmoxServer(): Promise<FakeProxmoxServer> {
  const pems = selfsigned.generate([{ name: "commonName", value: "127.0.0.1" }], { days: 1, keySize: 2048 });
  const fingerprint = createHash("sha256").update(new X509Certificate(pems.cert).raw).digest("hex").toUpperCase();

  const server = https.createServer({ cert: pems.cert, key: pems.private }, (req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      if (req.url === "/api2/json/access/ticket" && req.method === "POST") {
        const params = new URLSearchParams(body);
        if (params.get("username") === "testuser@pam" && params.get("password") === "correct-password") {
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
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ errors: { message: "not found" } }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return { port, fingerprint, close: () => new Promise((resolve) => server.close(() => resolve())) };
}
