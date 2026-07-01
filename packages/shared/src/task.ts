import { z } from "zod";

/** A Proxmox UPID (Unique Process ID) representing an async task. */
export const TaskRefSchema = z.object({
  clusterId: z.string().uuid(),
  node: z.string(),
  upid: z.string(),
});
export type TaskRef = z.infer<typeof TaskRefSchema>;

export const TaskStatusSchema = z.object({
  clusterId: z.string().uuid(),
  node: z.string(),
  upid: z.string(),
  type: z.string(),
  status: z.enum(["running", "stopped"]),
  exitstatus: z.string().optional(),
  user: z.string().optional(),
  starttime: z.number().optional(),
});
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
