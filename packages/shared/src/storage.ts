import { z } from "zod";

export const StorageTypeSchema = z.enum(["dir", "nfs", "cifs", "lvmthin"]);
export type StorageType = z.infer<typeof StorageTypeSchema>;

export const StorageContentTypeSchema = z.enum(["images", "rootdir", "vztmpl", "iso", "backup", "snippets"]);
export type StorageContentType = z.infer<typeof StorageContentTypeSchema>;

const baseStorageFields = {
  clusterId: z.string().uuid(),
  storageId: z.string().min(1).max(32),
  content: z.array(StorageContentTypeSchema).min(1),
  nodes: z.string().optional(), // comma-separated node names; empty = all nodes
  shared: z.boolean().default(false),
  disable: z.boolean().default(false),
};

export const CreateStorageInputSchema = z.discriminatedUnion("type", [
  z.object({ ...baseStorageFields, type: z.literal("dir"), path: z.string().min(1) }),
  z.object({
    ...baseStorageFields,
    type: z.literal("nfs"),
    server: z.string().min(1),
    export: z.string().min(1),
  }),
  z.object({
    ...baseStorageFields,
    type: z.literal("cifs"),
    server: z.string().min(1),
    share: z.string().min(1),
    username: z.string().optional(),
    password: z.string().optional(),
    domain: z.string().optional(),
  }),
  z.object({
    ...baseStorageFields,
    type: z.literal("lvmthin"),
    vgname: z.string().min(1),
    thinpool: z.string().min(1),
  }),
]);
export type CreateStorageInput = z.infer<typeof CreateStorageInputSchema>;

export const UpdateStorageInputSchema = z.object({
  content: z.array(StorageContentTypeSchema).optional(),
  disable: z.boolean().optional(),
  nodes: z.string().optional(),
});
export type UpdateStorageInput = z.infer<typeof UpdateStorageInputSchema>;

export const DownloadUrlInputSchema = z.object({
  clusterId: z.string().uuid(),
  node: z.string().min(1),
  storage: z.string().min(1),
  content: z.enum(["iso", "vztmpl"]),
  filename: z.string().min(1),
  url: z.string().url(),
});
export type DownloadUrlInput = z.infer<typeof DownloadUrlInputSchema>;
