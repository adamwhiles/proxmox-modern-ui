import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function requireEnv(name: string, devFallback?: () => string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV !== "production" && devFallback) {
    const generated = devFallback();
    console.warn(`[config] ${name} not set — generated an ephemeral dev value. Set it explicitly for production.`);
    return generated;
  }
  throw new Error(`Missing required environment variable: ${name}. Refusing to start in production without it.`);
}

// A stable-for-process ephemeral fallback so dev restarts within the same run don't rotate keys underfoot,
// while still forcing a real value in production.
const devEncryptionKey = crypto.randomBytes(32).toString("hex");
const devCookieSecret = crypto.randomBytes(32).toString("hex");

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  host: process.env.HOST ?? "0.0.0.0",
  port: Number(process.env.PORT ?? 3000),

  /** 32-byte hex key used for AES-256-GCM encryption of session data at rest. */
  encryptionKey: requireEnv("APP_ENCRYPTION_KEY", () => devEncryptionKey),
  /** Secret used to sign the session-id cookie. */
  cookieSecret: requireEnv("COOKIE_SECRET", () => devCookieSecret),

  /** One-time bootstrap token allowing the very first cluster to be registered (see security/appAdmin.ts). */
  setupToken: process.env.SETUP_TOKEN,

  /** Comma-separated list of "user@realm" allowed to manage the cluster registry & app settings. */
  appAdminUsers: (process.env.APP_ADMIN_USERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  databasePath: process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.sqlite"),

  sessionIdleTimeoutMs: 60 * 60 * 1000, // 1 hour idle timeout
  sessionAbsoluteTimeoutMs: 12 * 60 * 60 * 1000, // 12 hour absolute cap

  corsOrigin: process.env.CORS_ORIGIN, // unset = same-origin only (recommended default)
};

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
