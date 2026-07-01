import { buildApp } from "./app.js";
import { config } from "./config.js";
import { purgeExpiredSessions } from "./security/sessionStore.js";

async function main() {
  const app = await buildApp();

  setInterval(purgeExpiredSessions, 15 * 60 * 1000).unref();

  try {
    await app.listen({ host: config.host, port: config.port });
    app.log.info(`proxmox-modern-ui server listening on http://${config.host}:${config.port}`);
    if (!config.appAdminUsers.length) {
      app.log.warn(
        "APP_ADMIN_USERS is not set — no one can manage the cluster registry after initial setup. " +
          "Set it to a comma-separated list of user@realm identities.",
      );
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
