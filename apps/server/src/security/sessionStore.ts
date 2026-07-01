import { randomUUID } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import type { ProxmoxTicket } from "@proxmox-ui/proxmox-client";
import { db } from "../db/client.js";
import { sessions } from "../db/schema.js";
import { config } from "../config.js";
import { decryptJson, encryptJson, randomToken } from "./crypto.js";

export interface SessionData {
  /** Per-cluster Proxmox tickets this browser session has authenticated to. */
  clusters: Record<string, { ticket: ProxmoxTicket }>;
  /** Anti-CSRF token, handed to the frontend via a readable cookie (double-submit pattern). */
  csrfToken: string;
  /** The "primary" identity used for app-admin checks — the first cluster the session logged into. */
  primaryUser?: { username: string; realm: string };
}

/**
 * Server-side session store, backed by SQLite. The session id in the browser's cookie is an opaque,
 * random, signed token; all actual session state (including encrypted Proxmox tickets) lives here.
 */
export function createSession(initial: Omit<SessionData, "csrfToken">): { id: string; data: SessionData } {
  const id = randomUUID();
  const now = Date.now();
  const data: SessionData = { ...initial, csrfToken: randomToken(24) };
  db.insert(sessions)
    .values({
      id,
      data: encryptJson(data, config.encryptionKey),
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + config.sessionAbsoluteTimeoutMs,
    })
    .run();
  return { id, data };
}

export function getSession(id: string): SessionData | null {
  const row = db.select().from(sessions).where(eq(sessions.id, id)).get();
  if (!row) return null;

  const now = Date.now();
  if (now > row.expiresAt || now - row.lastSeenAt > config.sessionIdleTimeoutMs) {
    destroySession(id);
    return null;
  }

  db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, id)).run();
  return decryptJson<SessionData>(row.data, config.encryptionKey);
}

export function updateSession(id: string, data: SessionData): void {
  db.update(sessions)
    .set({ data: encryptJson(data, config.encryptionKey), lastSeenAt: Date.now() })
    .where(eq(sessions.id, id))
    .run();
}

export function destroySession(id: string): void {
  db.delete(sessions).where(eq(sessions.id, id)).run();
}

/** Best-effort cleanup of expired sessions; call periodically. */
export function purgeExpiredSessions(): void {
  db.delete(sessions).where(lt(sessions.expiresAt, Date.now())).run();
}
