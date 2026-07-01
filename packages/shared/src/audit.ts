import { z } from "zod";

export const AuditLogEntrySchema = z.object({
  id: z.number().int(),
  timestamp: z.string().datetime(),
  clusterId: z.string().uuid().nullable(),
  proxmoxUser: z.string(),
  action: z.string(),
  target: z.string().nullable(),
  upid: z.string().nullable(),
  result: z.enum(["success", "failure"]),
  detail: z.string().nullable(),
});
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;
