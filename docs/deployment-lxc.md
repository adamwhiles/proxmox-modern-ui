# Deploying to a Proxmox LXC container

This runs the app directly with Node.js inside an unprivileged LXC container — no Docker/nesting
required, which keeps things simpler and avoids the AppArmor/nesting quirks of Docker-in-LXC.

## 1. Create the container

Debian 12 or Ubuntu 24.04, unprivileged, 1-2 vCPU / 2GB RAM / 4GB disk for the build step. The
running app itself is light (well under 512MB), but `pnpm install` (native-compiles
`better-sqlite3` via node-gyp/g++) and the Vite/Rollup production build both want real memory
headroom — 512MB is enough to cause severe thrashing or OOM kills during the build, which can look
like a network/download problem rather than a memory one. Scale the container back down to
512MB-1GB after the build if you want a leaner steady-state footprint (`pct set <vmid> --memory
768`), or just leave it at 2GB.

```
pct create <vmid> local:vztmpl/debian-12-standard_*.tar.zst \
  --hostname proxmox-ui \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --rootfs local-lvm:4 \
  --memory 2048 \
  --unprivileged 1 \
  --features nesting=0
pct start <vmid>
```

(Or just use this app's own Create LXC wizard once you have an initial instance running somewhere —
a little self-hosting bootstrap problem, so the first one has to be created the normal way.)

## 2. Install Node.js, pnpm, and native build tools

`better-sqlite3` compiles from source, so build tools are required.

```
pct exec <vmid> -- bash -c '
  apt-get update && apt-get install -y curl git python3 make g++ openssh-server
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  corepack enable
'
```

## 3. Get the code onto the container

Pick whichever is easiest for you:

- **From a git remote** (recommended if you push this repo to GitHub/GitLab):
  ```
  pct exec <vmid> -- git clone <your-repo-url> /opt/proxmox-ui
  ```
- **Direct copy from your workstation** (no remote needed):
  ```
  rsync -a --exclude node_modules --exclude apps/web/dist --exclude apps/server/data \
    ./ root@<container-ip>:/opt/proxmox-ui/
  ```

## 4. Install dependencies and build

```
pct exec <vmid> -- bash -c '
  cd /opt/proxmox-ui
  pnpm install --frozen-lockfile
  pnpm --filter @proxmox-ui/web run build
'
```

## 5. Configure environment

```
pct exec <vmid> -- bash -c '
  cd /opt/proxmox-ui/apps/server
  cp ../../.env.example .env
'
```

Edit `/opt/proxmox-ui/apps/server/.env` and set, at minimum:

- `NODE_ENV=production`
- `APP_ENCRYPTION_KEY` / `COOKIE_SECRET` — generate each with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `SETUP_TOKEN` — a temporary secret; remove it again once your first cluster is registered
- `APP_ADMIN_USERS` — e.g. `root@pam`
- `DATABASE_PATH=/opt/proxmox-ui/apps/server/data/app.sqlite`

If you already have a working `app.sqlite` from local testing (with clusters already registered),
copy it to that `DATABASE_PATH` instead of starting fresh — it carries over registered clusters,
their pinned TLS fingerprints, and the audit log.

## 6. Run it as a systemd service

Copy [`deploy/proxmox-ui.service`](../deploy/proxmox-ui.service) in:

```
pct exec <vmid> -- bash -c '
  useradd -r -d /opt/proxmox-ui -s /usr/sbin/nologin proxmox-ui
  chown -R proxmox-ui:proxmox-ui /opt/proxmox-ui
'
pct push <vmid> deploy/proxmox-ui.service /etc/systemd/system/proxmox-ui.service
pct exec <vmid> -- bash -c '
  systemctl daemon-reload
  systemctl enable --now proxmox-ui
  systemctl status proxmox-ui --no-pager
'
```

The app listens on `http://<container-ip>:3000` — check `journalctl -u proxmox-ui -f` if it doesn't
come up.

## 7. First-run bootstrap (skip if you copied over an existing `app.sqlite`)

With `SETUP_TOKEN` set, register your first cluster by calling the API directly (there's no UI for
this yet since the UI itself needs a session, which needs a registered cluster). It's a two-step
TOFU flow: probe the host to see the certificate it presents, confirm the fingerprint out-of-band,
then register with that fingerprint pinned.

```
# 1. Probe — returns the fingerprint + cert details Proxmox is presenting right now
curl -X POST http://<container-ip>:3000/api/clusters/probe \
  -H "content-type: application/json" \
  -H "x-setup-token: <your SETUP_TOKEN>" \
  -d '{"host":"<proxmox-host-ip>","port":8006}'

# 2. Verify the returned tlsFingerprint matches your Proxmox host's actual cert
#    (run on the Proxmox host itself): pvenode cert info

# 3. Register, pinning that confirmed fingerprint
curl -X POST http://<container-ip>:3000/api/clusters \
  -H "content-type: application/json" \
  -H "x-setup-token: <your SETUP_TOKEN>" \
  -d '{"name":"Production","host":"<proxmox-host-ip>","port":8006,"defaultRealm":"pam","tlsFingerprint":"<fingerprint from step 1, colon-separated>"}'
```

Once you've registered it and logged in as an `APP_ADMIN_USERS` user, remove `SETUP_TOKEN` from
`.env` and restart the service.

## 8. TLS / reverse proxy (recommended before exposing beyond your LAN)

The app itself speaks plain HTTP and expects TLS termination in front of it (per the security
design — see the security spine notes in the repo). Put Caddy, nginx, or Traefik in front:

```
# Caddy example (/etc/caddy/Caddyfile)
proxmox-ui.yourlan.example {
  reverse_proxy <container-ip>:3000
}
```

For pure LAN use, plain HTTP to the container is fine short-term, but session cookies are marked
`Secure` in production, meaning **login will silently fail over plain HTTP** unless you terminate
TLS somewhere in front (even a self-signed cert via Caddy's internal CA works). Don't skip this
step.

## Updating later

```
pct exec <vmid> -- bash -c '
  cd /opt/proxmox-ui
  git pull   # or re-rsync
  pnpm install --frozen-lockfile
  pnpm --filter @proxmox-ui/web run build
  systemctl restart proxmox-ui
'
```
