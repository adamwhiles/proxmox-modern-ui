import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const clusters = sqliteTable("clusters", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull().default(8006),
  tlsFingerprint: text("tls_fingerprint").notNull(),
  defaultRealm: text("default_realm").notNull().default("pam"),
  createdAt: text("created_at").notNull(),
});

/** Server-side session store. `data` is an AES-256-GCM-encrypted JSON blob — never plaintext at rest. */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  createdAt: integer("created_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: text("timestamp").notNull(),
  clusterId: text("cluster_id"),
  proxmoxUser: text("proxmox_user").notNull(),
  action: text("action").notNull(),
  target: text("target"),
  upid: text("upid"),
  result: text("result", { enum: ["success", "failure"] }).notNull(),
  detail: text("detail"),
});
