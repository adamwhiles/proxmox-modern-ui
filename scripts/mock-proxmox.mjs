// Standalone mock Proxmox VE API server used only for local demoing/preview — NOT part of the app
// or its test suite. Mimics just enough of the real REST API surface to populate the dashboard.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import { X509Certificate, createHash, createCipheriv, randomBytes } from "node:crypto";
import selfsigned from "selfsigned";
import { WebSocketServer } from "ws";

const PORT = 18006;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certPath = path.join(__dirname, ".mock-proxmox-cert.json");

// Cache the cert across restarts — otherwise every restart rotates the TLS fingerprint and
// breaks any cluster already pinned to this mock server (the pinning check is working correctly
// in that case; this just avoids re-registering the cluster after every restart during dev).
let pems;
if (fs.existsSync(certPath)) {
  pems = JSON.parse(fs.readFileSync(certPath, "utf8"));
} else {
  pems = selfsigned.generate([{ name: "commonName", value: "127.0.0.1" }], { days: 3650, keySize: 2048 });
  fs.writeFileSync(certPath, JSON.stringify({ cert: pems.cert, private: pems.private }));
}
const fingerprint = createHash("sha256").update(new X509Certificate(pems.cert).raw).digest("hex").toUpperCase();
const formatted = fingerprint.match(/.{2}/g).join(":");

const NODE = "pve-node1";

/** Guests created via the wizard during this run, layered on top of the static seed data below. */
const createdGuests = []; // { type, vmid, name, status }

const networkInterfaces = [
  { iface: "vmbr0", type: "bridge", active: 1, autostart: 1, address: "192.168.1.10", netmask: "255.255.255.0" },
  { iface: "eno1", type: "eth", active: 1, autostart: 1 },
];

const clusterStorage = [
  { storage: "local", type: "dir", content: "iso,vztmpl,backup", shared: 0, disable: 0, path: "/var/lib/vz" },
  { storage: "local-lvm", type: "lvmthin", content: "images,rootdir", shared: 0, disable: 0, vgname: "pve", thinpool: "data" },
];

const sdnZones = [];
const sdnVnets = [];

/** vncticket -> { kind: "vnc" | "shell" }, consumed by the vncwebsocket upgrade handler below. */
const consoleTickets = new Map();

// Mutable in-memory config store so PUT /config and /resize calls are actually reflected back.
const configs = {
  "qemu/100": {
    name: "web-server", cores: 2, sockets: 1, cpu: "x86-64-v2-AES", memory: 2048, balloon: 0,
    agent: "1", onboot: "1", tags: "prod;web", scsi0: "local-lvm:vm-100-disk-0,size=32G,cache=none,ssd=0,iothread=1",
    net0: "virtio,bridge=vmbr0,firewall=1", bios: "seabios", machine: "pc", scsihw: "virtio-scsi-pci", ostype: "l26",
  },
  "qemu/101": {
    name: "db-server", cores: 4, sockets: 1, cpu: "x86-64-v2-AES", memory: 4096, balloon: 0,
    agent: "0", onboot: "0", tags: "", scsi0: "local-lvm:vm-101-disk-0,size=64G,cache=none,ssd=0,iothread=1",
    net0: "virtio,bridge=vmbr0,firewall=1", bios: "seabios", machine: "pc", scsihw: "virtio-scsi-pci", ostype: "l26",
  },
  "lxc/200": {
    hostname: "nginx-proxy", cores: 1, memory: 512, swap: 512, onboot: "1",
    rootfs: "local-lvm:vm-200-disk-0,size=8G", net0: "name=eth0,bridge=vmbr0,ip=dhcp,firewall=1",
  },
};

function json(res, code, data) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify({ data }));
}

function fakeRrdData(timeframe) {
  const points = timeframe === "week" ? 168 : timeframe === "day" ? 96 : 60;
  const stepSeconds = timeframe === "week" ? 3600 : timeframe === "day" ? 900 : 60;
  const now = Math.floor(Date.now() / 1000);
  return Array.from({ length: points }, (_, i) => {
    const t = now - (points - i) * stepSeconds;
    const wave = (Math.sin(i / 6) + 1) / 2;
    return {
      time: t,
      cpu: Math.max(0, wave * 0.6 + Math.random() * 0.1),
      mem: Math.round((0.3 + wave * 0.4) * 2147483648),
      maxmem: 2147483648,
      netin: Math.round(wave * 500000 + Math.random() * 50000),
      netout: Math.round(wave * 200000 + Math.random() * 30000),
      diskread: Math.round(wave * 100000),
      diskwrite: Math.round(wave * 80000),
    };
  });
}

const server = https.createServer({ cert: pems.cert, key: pems.private }, (req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const url = new URL(req.url, "https://localhost");
    console.log(req.method, url.pathname);

    if (url.pathname === "/api2/json/access/ticket" && req.method === "POST") {
      const params = new URLSearchParams(body);
      const username = params.get("username");
      const password = params.get("password");
      if (username === "root@pam" && password === "demo1234") {
        return json(res, 200, { ticket: "PVE:root@pam:DEMOTICKET", CSRFPreventionToken: "DEMOCSRF", username: "root@pam" });
      }
      res.writeHead(401, { "content-type": "application/json" });
      return res.end(JSON.stringify({ data: null }));
    }

    if (url.pathname === "/api2/json/cluster/resources") {
      return json(res, 200, [
        { id: `node/${NODE}`, type: "node", node: NODE, status: "online", cpu: 0.12, maxcpu: 8, mem: 4200000000, maxmem: 16000000000, uptime: 375000 },
        { id: "qemu/100", type: "qemu", node: NODE, vmid: 100, name: configs["qemu/100"].name, status: "running", cpu: 0.05, maxcpu: 2, mem: 900000000, maxmem: configs["qemu/100"].memory * 1024 * 1024, uptime: 120000, disk: 5000000000, maxdisk: 21474836480 },
        { id: "qemu/101", type: "qemu", node: NODE, vmid: 101, name: configs["qemu/101"].name, status: "stopped", cpu: 0, maxcpu: 4, mem: 0, maxmem: configs["qemu/101"].memory * 1024 * 1024, uptime: 0, disk: 0, maxdisk: 42949672960 },
        { id: "lxc/200", type: "lxc", node: NODE, vmid: 200, name: configs["lxc/200"].hostname, status: "running", cpu: 0.01, maxcpu: 1, mem: 128000000, maxmem: configs["lxc/200"].memory * 1024 * 1024, uptime: 500000, disk: 800000000, maxdisk: 8589934592 },
        { id: "storage/local-lvm", type: "storage", node: NODE, status: "available" },
        ...createdGuests.map((g) => ({
          id: `${g.type}/${g.vmid}`, type: g.type, node: NODE, vmid: g.vmid, name: g.name, status: g.status,
          cpu: 0, maxcpu: 1, mem: 0, maxmem: 536870912, uptime: 0, disk: 0, maxdisk: 8589934592,
        })),
      ]);
    }

    if (url.pathname === "/api2/json/nodes") {
      return json(res, 200, [{ node: NODE, status: "online", cpu: 0.12, maxcpu: 8, mem: 4200000000, maxmem: 16000000000, uptime: 375000 }]);
    }

    if (url.pathname === `/api2/json/nodes/${NODE}/qemu` && req.method === "GET") {
      return json(res, 200, [
        { vmid: 100, name: configs["qemu/100"].name, status: "running", cpu: 0.05, mem: 900000000, maxmem: configs["qemu/100"].memory * 1024 * 1024 },
        { vmid: 101, name: configs["qemu/101"].name, status: "stopped", cpu: 0, mem: 0, maxmem: configs["qemu/101"].memory * 1024 * 1024 },
        ...createdGuests.filter((g) => g.type === "qemu").map((g) => ({ vmid: g.vmid, name: g.name, status: g.status, cpu: 0, mem: 0, maxmem: 536870912 })),
      ]);
    }
    if (url.pathname === `/api2/json/nodes/${NODE}/lxc` && req.method === "GET") {
      return json(res, 200, [
        { vmid: 200, name: configs["lxc/200"].hostname, status: "running", cpu: 0.01, mem: 128000000, maxmem: configs["lxc/200"].memory * 1024 * 1024 },
        ...createdGuests.filter((g) => g.type === "lxc").map((g) => ({ vmid: g.vmid, name: g.name, status: g.status, cpu: 0, mem: 0, maxmem: 536870912 })),
      ]);
    }
    if (url.pathname === `/api2/json/nodes/${NODE}/qemu` && req.method === "POST") {
      const params = new URLSearchParams(body);
      const vmid = Number(params.get("vmid"));
      const name = params.get("name") || `vm-${vmid}`;
      configs[`qemu/${vmid}`] = Object.fromEntries(params);
      createdGuests.push({ type: "qemu", vmid, name, status: "stopped" });
      return json(res, 201, `UPID:${NODE}:00000010:00000011:00000000:qmcreate:${vmid}:root@pam:`);
    }
    if (url.pathname === `/api2/json/nodes/${NODE}/lxc` && req.method === "POST") {
      const params = new URLSearchParams(body);
      const vmid = Number(params.get("vmid"));
      const hostname = params.get("hostname") || `ct-${vmid}`;
      configs[`lxc/${vmid}`] = Object.fromEntries(params);
      createdGuests.push({ type: "lxc", vmid, name: hostname, status: "stopped" });
      return json(res, 201, `UPID:${NODE}:00000012:00000013:00000000:vzcreate:${vmid}:root@pam:`);
    }
    if (url.pathname === `/api2/json/nodes/${NODE}/storage` && req.method === "GET") {
      return json(res, 200, clusterStorage.map((s) => ({
        storage: s.storage, type: s.type, content: s.content, used: 12000000000, total: 100000000000, avail: 88000000000,
      })));
    }
    if (url.pathname === `/api2/json/nodes/${NODE}/storage/local/content`) {
      const content = url.searchParams.get("content");
      if (content === "iso") return json(res, 200, [{ volid: "local:iso/debian-12.7-amd64-netinst.iso", size: 700000000 }, { volid: "local:iso/ubuntu-24.04-live-server-amd64.iso", size: 2100000000 }]);
      if (content === "vztmpl") return json(res, 200, [{ volid: "local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst", size: 130000000 }, { volid: "local:vztmpl/alpine-3.20-default_20240823_amd64.tar.xz", size: 3200000 }]);
      return json(res, 200, []);
    }
    if (/\/storage\/[^/]+\/content$/.test(url.pathname) && url.pathname !== `/api2/json/nodes/${NODE}/storage/local/content`) {
      return json(res, 200, []);
    }
    if (url.pathname === "/api2/json/cluster/backup") {
      return json(res, 200, [{ id: "backup-nightly", schedule: "02:00", storage: "local", vmid: "100,101,200", enabled: 1 }]);
    }

    // -- cluster status (quorum) --
    if (url.pathname === "/api2/json/cluster/status") {
      return json(res, 200, [
        { id: "cluster", type: "cluster", name: "demo-cluster", nodes: 1, quorate: 1, version: 1 },
        { id: `node/${NODE}`, type: "node", name: NODE, online: 1, local: 1, nodeid: 1 },
      ]);
    }

    // -- node status/rrddata --
    if (url.pathname === `/api2/json/nodes/${NODE}/status` && req.method === "GET") {
      return json(res, 200, {
        status: "online", uptime: 375000, cpu: 0.12, cpuinfo: { cpus: 8, model: "Mock CPU" },
        memory: { used: 4200000000, total: 16000000000, free: 11800000000 },
        loadavg: ["0.52", "0.61", "0.58"], pveversion: "pve-manager/8.2.4/faa83925c9641325",
      });
    }
    if (url.pathname === `/api2/json/nodes/${NODE}/rrddata`) {
      return json(res, 200, fakeRrdData(url.searchParams.get("timeframe") ?? "hour").map((p) => ({ time: p.time, cpu: p.cpu, memused: p.mem, memtotal: p.maxmem })));
    }

    // -- cluster-wide storage config CRUD --
    if (url.pathname === "/api2/json/storage" && req.method === "GET") {
      return json(res, 200, clusterStorage);
    }
    if (url.pathname === "/api2/json/storage" && req.method === "POST") {
      const params = Object.fromEntries(new URLSearchParams(body));
      clusterStorage.push({ ...params, shared: Number(params.shared ?? 0), disable: Number(params.disable ?? 0) });
      return json(res, 200, null);
    }
    const storageIdMatch = url.pathname.match(/^\/api2\/json\/storage\/([^/]+)$/);
    if (storageIdMatch) {
      const s = clusterStorage.find((x) => x.storage === storageIdMatch[1]);
      if (req.method === "PUT" && s) {
        const params = Object.fromEntries(new URLSearchParams(body));
        Object.assign(s, params, { disable: params.disable !== undefined ? Number(params.disable) : s.disable });
        return json(res, 200, null);
      }
      if (req.method === "DELETE") {
        const idx = clusterStorage.findIndex((x) => x.storage === storageIdMatch[1]);
        if (idx >= 0) clusterStorage.splice(idx, 1);
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ data: null }));
      }
    }

    // -- node network interface CRUD --
    if (url.pathname === `/api2/json/nodes/${NODE}/network` && req.method === "GET") {
      return json(res, 200, networkInterfaces);
    }
    if (url.pathname === `/api2/json/nodes/${NODE}/network` && req.method === "POST") {
      const params = Object.fromEntries(new URLSearchParams(body));
      networkInterfaces.push({ ...params, active: 0, pending: 1, autostart: Number(params.autostart ?? 1) });
      return json(res, 200, null);
    }
    if (url.pathname === `/api2/json/nodes/${NODE}/network` && req.method === "PUT") {
      // bare PUT (no iface segment) = apply pending changes
      for (const iface of networkInterfaces) {
        iface.active = 1;
        delete iface.pending;
      }
      return json(res, 200, `UPID:${NODE}:00000020:00000021:00000000:srvreload:networking:root@pam:`);
    }
    const ifaceMatch = url.pathname.match(new RegExp(`^/api2/json/nodes/${NODE}/network/([^/]+)$`));
    if (ifaceMatch) {
      const iface = networkInterfaces.find((x) => x.iface === ifaceMatch[1]);
      if (req.method === "PUT" && iface) {
        const params = Object.fromEntries(new URLSearchParams(body));
        Object.assign(iface, params, { pending: 1 });
        return json(res, 200, null);
      }
      if (req.method === "DELETE") {
        const idx = networkInterfaces.findIndex((x) => x.iface === ifaceMatch[1]);
        if (idx >= 0) networkInterfaces.splice(idx, 1);
        return json(res, 200, null);
      }
    }

    // -- SDN zones/vnets --
    if (url.pathname === "/api2/json/cluster/sdn/zones" && req.method === "GET") {
      return json(res, 200, sdnZones);
    }
    if (url.pathname === "/api2/json/cluster/sdn/zones" && req.method === "POST") {
      sdnZones.push(Object.fromEntries(new URLSearchParams(body)));
      return json(res, 200, null);
    }
    const zoneMatch = url.pathname.match(/^\/api2\/json\/cluster\/sdn\/zones\/([^/]+)$/);
    if (zoneMatch && req.method === "DELETE") {
      const idx = sdnZones.findIndex((z) => z.zone === zoneMatch[1]);
      if (idx >= 0) sdnZones.splice(idx, 1);
      return json(res, 200, null);
    }
    if (url.pathname === "/api2/json/cluster/sdn/vnets" && req.method === "GET") {
      return json(res, 200, sdnVnets);
    }
    if (url.pathname === "/api2/json/cluster/sdn/vnets" && req.method === "POST") {
      sdnVnets.push(Object.fromEntries(new URLSearchParams(body)));
      return json(res, 200, null);
    }
    const vnetMatch = url.pathname.match(/^\/api2\/json\/cluster\/sdn\/vnets\/([^/]+)$/);
    if (vnetMatch && req.method === "DELETE") {
      const idx = sdnVnets.findIndex((v) => v.vnet === vnetMatch[1]);
      if (idx >= 0) sdnVnets.splice(idx, 1);
      return json(res, 200, null);
    }
    if (url.pathname === "/api2/json/cluster/sdn" && req.method === "PUT") {
      return json(res, 200, `UPID:${NODE}:00000030:00000031:00000000:sdnapply::root@pam:`);
    }

    // -- per-guest config / resize / rrddata --
    const configMatch = url.pathname.match(new RegExp(`^/api2/json/nodes/${NODE}/(qemu|lxc)/(\\d+)/config$`));
    if (configMatch) {
      const key = `${configMatch[1]}/${configMatch[2]}`;
      if (req.method === "GET") return json(res, 200, configs[key] ?? {});
      if (req.method === "PUT") {
        Object.assign(configs[key], JSON.parse(bodyToJson(body)));
        return json(res, 200, null);
      }
    }
    const resizeMatch = url.pathname.match(new RegExp(`^/api2/json/nodes/${NODE}/(qemu|lxc)/(\\d+)/resize$`));
    if (resizeMatch && req.method === "PUT") {
      const key = `${resizeMatch[1]}/${resizeMatch[2]}`;
      const params = new URLSearchParams(body);
      const disk = params.get("disk");
      const size = params.get("size");
      if (configs[key][disk]) {
        configs[key][disk] = configs[key][disk].replace(/size=\d+G/, `size=${size}`);
      }
      return json(res, 200, `UPID:${NODE}:00000002:00000003:00000000:resize:${resizeMatch[2]}:root@pam:`);
    }
    const rrdMatch = url.pathname.match(new RegExp(`^/api2/json/nodes/${NODE}/(qemu|lxc)/(\\d+)/rrddata$`));
    if (rrdMatch) {
      return json(res, 200, fakeRrdData(url.searchParams.get("timeframe") ?? "hour"));
    }

    // -- console tickets (VNC display + shell) --
    const vncproxyMatch = url.pathname.match(new RegExp(`^/api2/json/nodes/${NODE}/(qemu|lxc)/(\\d+)/vncproxy$`));
    if (vncproxyMatch && req.method === "POST") {
      const ticket = `VNCTICKET-${randomBytes(8).toString("hex")}`;
      consoleTickets.set(ticket, { kind: "vnc" });
      return json(res, 200, { port: "5900", ticket, cert: formatted });
    }
    const termproxyMatch = url.pathname.match(new RegExp(`^/api2/json/nodes/${NODE}/(qemu|lxc)/(\\d+)/termproxy$`));
    if (termproxyMatch && req.method === "POST") {
      const ticket = `TERMTICKET-${randomBytes(8).toString("hex")}`;
      consoleTickets.set(ticket, { kind: "shell" });
      return json(res, 200, {
        port: "5900",
        ticket,
        upid: `UPID:${NODE}:00000040:00000041:00000000:vncshell:${termproxyMatch[2]}:root@pam:`,
      });
    }

    if (/\/status\/(start|stop|shutdown|reboot|reset)$/.test(url.pathname)) {
      return json(res, 200, `UPID:${NODE}:00000001:00000002:00000000:qmstart:100:root@pam:`);
    }
    if (url.pathname.endsWith("/snapshot") && req.method === "GET") {
      return json(res, 200, [{ name: "current" }]);
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ errors: { message: `not found: ${url.pathname}` } }));
  });
});

/** The app sends config-update bodies as JSON (see apiFetch); form-encoded bodies are used elsewhere. */
function bodyToJson(raw) {
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    return JSON.stringify(Object.fromEntries(new URLSearchParams(raw)));
  }
}

// -- console websocket relay (mimics Proxmox's vncwebsocket for both VNC display and shell) --
// Echoes back the "binary" subprotocol, mirroring real Proxmox's vncwebsocket handshake — the
// backend relay requests it and (per RFC 6455 / the `ws` client) expects it echoed back.
const wss = new WebSocketServer({ noServer: true, handleProtocols: () => "binary" });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "https://localhost");
  const match = url.pathname.match(new RegExp(`^/api2/json/nodes/${NODE}/(qemu|lxc)/(\\d+)/vncwebsocket$`));
  const info = match && consoleTickets.get(url.searchParams.get("vncticket") ?? "");
  if (!info) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    if (info.kind === "vnc") handleVncSocket(ws, url.searchParams.get("vncticket"));
    else handleShellSocket(ws, url.searchParams.get("vncticket"));
  });
});

/** Classic VNC Authentication (RFB security type 2) uses each password byte with its bits
 * reversed as a DES-ECB key — a quirk inherited from the original RealVNC implementation. Real
 * Proxmox VNC displays require this (using the vncproxy ticket as the password), so the mock
 * implements it for real rather than accepting "None", to actually prove the frontend's
 * credential-passing (see VncConsole.tsx) works against real VNC auth, not just skip it. */
function reverseBits(byte) {
  let out = 0;
  for (let i = 0; i < 8; i++) out = (out << 1) | ((byte >> i) & 1);
  return out;
}
function vncAuthKey(password) {
  const key = Buffer.alloc(8);
  const pw = Buffer.from(password, "utf8");
  for (let i = 0; i < 8; i++) key[i] = reverseBits(i < pw.length ? pw[i] : 0);
  return key;
}
function vncAuthResponse(challenge, password) {
  // Node's default OpenSSL 3 provider doesn't expose single-DES ("des-ecb") — only 3DES variants.
  // 3DES-ECB with all three sub-keys equal to the same 8-byte key is mathematically identical to
  // single DES (the decrypt-with-K2 step cancels the preceding encrypt-with-K1 when K1 == K2), so
  // this produces the exact same result a real single-DES VNC-Auth implementation would.
  const key8 = vncAuthKey(password);
  const cipher = createCipheriv("des-ede3-ecb", Buffer.concat([key8, key8, key8]), null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(challenge), cipher.final()]);
}

/** Minimal RFB 3.8 server handshake (security type "None") + a solid animated framebuffer, just
 * enough for noVNC's RFB client to reach "connected" and paint something — proves the websocket
 * relay end to end without needing a real VNC server. */
function handleVncSocket(ws, expectedPassword) {
  const width = 640;
  const height = 480;
  let stage = "version";
  let buf = Buffer.alloc(0);
  let frame = 0;
  let challenge = null;

  ws.send(Buffer.from("RFB 003.008\n", "ascii"));

  ws.on("message", (data) => {
    buf = Buffer.concat([buf, Buffer.from(data)]);
    let progressed = true;
    while (progressed) progressed = pump();
  });

  function pump() {
    if (stage === "version") {
      if (buf.length < 12) return false;
      buf = buf.subarray(12);
      ws.send(Buffer.from([1, 2])); // 1 security type offered: 2 = VNC Authentication
      stage = "security-select";
      return true;
    }
    if (stage === "security-select") {
      if (buf.length < 1) return false;
      buf = buf.subarray(1);
      challenge = randomBytes(16);
      ws.send(challenge);
      stage = "security-response";
      return true;
    }
    if (stage === "security-response") {
      if (buf.length < 16) return false;
      const response = buf.subarray(0, 16);
      buf = buf.subarray(16);
      const expected = vncAuthResponse(challenge, expectedPassword);
      if (!response.equals(expected)) {
        ws.send(Buffer.from([0, 0, 0, 1])); // SecurityResult: failed
        ws.close(1008, "VNC authentication failed");
        return false;
      }
      ws.send(Buffer.from([0, 0, 0, 0])); // SecurityResult: OK
      stage = "client-init";
      return true;
    }
    if (stage === "client-init") {
      if (buf.length < 1) return false;
      buf = buf.subarray(1);
      sendServerInit();
      stage = "normal";
      return true;
    }
    return pumpNormalMessage();
  }

  function sendServerInit() {
    const header = Buffer.alloc(2 + 2 + 16 + 4);
    header.writeUInt16BE(width, 0);
    header.writeUInt16BE(height, 2);
    header.writeUInt8(32, 4); // bits-per-pixel
    header.writeUInt8(24, 5); // depth
    header.writeUInt8(0, 6); // big-endian-flag
    header.writeUInt8(1, 7); // true-color-flag
    header.writeUInt16BE(255, 8); // red-max
    header.writeUInt16BE(255, 10); // green-max
    header.writeUInt16BE(255, 12); // blue-max
    header.writeUInt8(16, 14); // red-shift
    header.writeUInt8(8, 15); // green-shift
    // blue-shift (0) and 3 padding bytes are already zero
    const name = Buffer.from("mock-console");
    header.writeUInt32BE(name.length, 20);
    ws.send(Buffer.concat([header, name]));
  }

  function pumpNormalMessage() {
    if (buf.length < 1) return false;
    const msgType = buf.readUInt8(0);
    const sizes = { 0: 20, 2: null, 3: 10, 4: 8, 5: 6, 6: null };
    if (msgType === 2) {
      // SetEncodings: type(1) + pad(1) + count(2) + 4*count
      if (buf.length < 4) return false;
      const total = 4 + buf.readUInt16BE(2) * 4;
      if (buf.length < total) return false;
      buf = buf.subarray(total);
      return true;
    }
    if (msgType === 6) {
      // ClientCutText: type(1) + pad(3) + length(4) + text
      if (buf.length < 8) return false;
      const total = 8 + buf.readUInt32BE(4);
      if (buf.length < total) return false;
      buf = buf.subarray(total);
      return true;
    }
    const size = sizes[msgType];
    if (size == null) {
      // Unrecognized message type — drop the buffer rather than looping forever out of sync.
      buf = Buffer.alloc(0);
      return false;
    }
    if (buf.length < size) return false;
    const isUpdateRequest = msgType === 3;
    buf = buf.subarray(size);
    if (isUpdateRequest) sendFramebufferUpdate();
    return true;
  }

  function sendFramebufferUpdate() {
    frame += 1;
    const pixels = Buffer.alloc(width * height * 4);
    const wash = (frame * 3) % 256;
    for (let i = 0; i < width * height; i++) {
      pixels.writeUInt8(wash, i * 4); // R
      pixels.writeUInt8(90, i * 4 + 1); // G
      pixels.writeUInt8(160, i * 4 + 2); // B
    }
    const rect = Buffer.alloc(12);
    rect.writeUInt16BE(0, 0);
    rect.writeUInt16BE(0, 2);
    rect.writeUInt16BE(width, 4);
    rect.writeUInt16BE(height, 6);
    rect.writeInt32BE(0, 8); // Raw encoding
    ws.send(Buffer.concat([Buffer.from([0, 0, 0, 1]), rect, pixels]));
  }
}

/** Fake interactive shell — echoes keystrokes and answers a handful of canned commands, enough to
 * prove the termproxy + websocket relay renders correctly in xterm.js. Parses Proxmox's real
 * termproxy wire format for client->server bytes (0:LEN:MSG data, 1:COLS:ROWS: resize, 2 ping) —
 * see https://github.com/proxmox/pve-xtermjs — server->client stays raw/unwrapped per that spec. */
function handleShellSocket(ws, expectedTicket) {
  const send = (s) => ws.send(Buffer.from(s, "utf8"));
  const prompt = "root@pve-node1:~# ";
  let line = "";
  let recvBuf = "";
  // Real termproxy requires "user@realm:ticket\n" as the very first message before anything else —
  // this is the exact handshake the relay was silently skipping (it only passed the ticket as a
  // vncwebsocket query param, which pveproxy uses to find/bridge to termproxy, but termproxy itself
  // separately reads a ticket line off the bridged connection and times out after 10s without it).
  // Mirroring that requirement here, instead of accepting input immediately, is what would have
  // caught this bug in mock-based testing.
  let authenticated = false;

  ws.on("message", (data, isBinary) => {
    // Real termproxy's line protocol is meaningless over a binary frame — surface it loudly here
    // instead of silently accepting it, since a text-vs-binary frame mismatch in the relay is
    // exactly the kind of bug that stays invisible if the mock doesn't care about frame type.
    if (isBinary) {
      console.log("WARNING: shell socket received a BINARY frame — real termproxy would likely ignore this:", data.toString("hex").slice(0, 40));
      return;
    }
    if (!authenticated) {
      const authLine = Buffer.from(data).toString("utf8");
      const match = authLine.match(/^([^:]+):(.+)\n$/);
      if (!match || match[2] !== expectedTicket) {
        console.log("WARNING: termproxy auth line missing/incorrect — real termproxy would time out after 10s:", JSON.stringify(authLine));
        return; // real termproxy just never sends OK and eventually gives up; mimic that instead of closing
      }
      authenticated = true;
      send("OK");
      send(`Welcome to the mock Proxmox shell console.\r\nType a command and press Enter.\r\n\r\n${prompt}`);
      return;
    }
    recvBuf += Buffer.from(data).toString("utf8");
    let progressed = true;
    while (progressed) progressed = pumpFrame();
  });

  function pumpFrame() {
    if (recvBuf.length === 0) return false;
    if (recvBuf[0] === "2") {
      recvBuf = recvBuf.slice(1);
      return true; // ping — no reply needed
    }
    if (recvBuf[0] === "1") {
      const match = recvBuf.match(/^1:(\d+):(\d+):/);
      if (!match) return false;
      recvBuf = recvBuf.slice(match[0].length);
      return true; // resize — mock doesn't need to react to it
    }
    if (recvBuf[0] === "0") {
      const header = recvBuf.match(/^0:(\d+):/);
      if (!header) return false;
      const len = Number(header[1]);
      const rest = recvBuf.slice(header[0].length);
      if (Buffer.byteLength(rest, "utf8") < len) return false; // wait for the rest of the message
      const msg = rest.slice(0, len);
      recvBuf = rest.slice(len);
      handleInput(msg);
      return true;
    }
    // Anything else is silently ignored per the real protocol, but drop it so we don't spin forever.
    recvBuf = "";
    return false;
  }

  function handleInput(text) {
    for (const ch of text) {
      if (ch === "\r" || ch === "\n") {
        send("\r\n");
        runCommand(line.trim());
        line = "";
      } else if (ch === "\x7f" || ch === "\b") {
        if (line.length > 0) {
          line = line.slice(0, -1);
          send("\b \b");
        }
      } else {
        line += ch;
        send(ch);
      }
    }
  }

  function runCommand(cmd) {
    switch (cmd) {
      case "":
        break;
      case "ls":
        send("bin  boot  dev  etc  home  lib  root  usr  var\r\n");
        break;
      case "whoami":
        send("root\r\n");
        break;
      case "pwd":
        send("/root\r\n");
        break;
      case "uname -a":
        send("Linux pve-node1 6.8.12-1-pve #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux (mock)\r\n");
        break;
      case "exit":
        send("logout\r\n");
        ws.close();
        return;
      default:
        send(`-bash: ${cmd}: command not found\r\n`);
    }
    send(prompt);
  }
}

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mock Proxmox server listening on https://127.0.0.1:${PORT}`);
  console.log(`TLS fingerprint: ${formatted}`);
  console.log(`Login with root@pam / demo1234`);
});
