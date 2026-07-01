import { desc } from "drizzle-orm";
import { db } from "../client.js";
import { auditLog } from "../schema.js";

export interface AuditEntryInput {
  clusterId: string | null;
  proxmoxUser: string;
  action: string;
  target?: string | null;
  upid?: string | null;
  result: "success" | "failure";
  detail?: string | null;
}

export function recordAudit(entry: AuditEntryInput): void {
  db.insert(auditLog)
    .values({
      timestamp: new Date().toISOString(),
      clusterId: entry.clusterId,
      proxmoxUser: entry.proxmoxUser,
      action: entry.action,
      target: entry.target ?? null,
      upid: entry.upid ?? null,
      result: entry.result,
      detail: entry.detail ?? null,
    })
    .run();
}

export function listAuditLog(limit = 200) {
  return db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(limit).all();
}
