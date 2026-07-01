import { z } from "zod";

export const GuestTypeSchema = z.enum(["qemu", "lxc"]);
export type GuestType = z.infer<typeof GuestTypeSchema>;

export const GuestActionSchema = z.enum([
  "start",
  "stop",
  "shutdown",
  "reboot",
  "reset",
  "suspend",
  "resume",
]);
export type GuestAction = z.infer<typeof GuestActionSchema>;

export const GuestRefSchema = z.object({
  clusterId: z.string().uuid(),
  node: z.string().min(1),
  vmid: z.number().int().positive(),
  type: GuestTypeSchema,
});
export type GuestRef = z.infer<typeof GuestRefSchema>;

// ---- QEMU (VM) creation — mirrors the tabs of Proxmox's own "Create VM" wizard ----

export const QemuBiosSchema = z.enum(["seabios", "ovmf"]);
export const QemuMachineSchema = z.enum(["pc", "q35"]);
export const QemuScsiHwSchema = z.enum(["virtio-scsi-pci", "virtio-scsi-single", "lsi", "megasas"]);
export const QemuDiskBusSchema = z.enum(["scsi", "sata", "virtio", "ide"]);
export const QemuDiskCacheSchema = z.enum(["none", "writethrough", "writeback", "unsafe", "directsync"]);
export const QemuCpuTypeSchema = z.enum(["x86-64-v2-AES", "kvm64", "host", "qemu64", "x86-64-v3"]);
export const QemuNetModelSchema = z.enum(["virtio", "e1000", "rtl8139", "vmxnet3"]);

export const CreateQemuInputSchema = z.object({
  // General
  clusterId: z.string().uuid(),
  node: z.string().min(1),
  vmid: z.number().int().positive(),
  name: z.string().min(1).max(64).optional(),
  pool: z.string().optional(),
  tags: z.string().optional(),
  startOnBoot: z.boolean().default(false),

  // OS
  ostype: z.string().default("l26"),
  isoStorage: z.string().optional(),
  isoFile: z.string().optional(),

  // System
  bios: QemuBiosSchema.default("seabios"),
  machine: QemuMachineSchema.default("pc"),
  scsihw: QemuScsiHwSchema.default("virtio-scsi-pci"),
  qemuAgent: z.boolean().default(true),

  // Disk
  storage: z.string().min(1),
  diskGiB: z.number().int().min(1).default(8),
  diskBus: QemuDiskBusSchema.default("scsi"),
  diskCache: QemuDiskCacheSchema.default("none"),
  ssdEmulation: z.boolean().default(false),
  discard: z.boolean().default(false),
  ioThread: z.boolean().default(true),

  // CPU
  sockets: z.number().int().min(1).max(4).default(1),
  cores: z.number().int().min(1).max(128).default(1),
  cpuType: QemuCpuTypeSchema.default("x86-64-v2-AES"),

  // Memory
  memoryMiB: z.number().int().min(16).default(2048),
  balloonMiB: z.number().int().min(0).default(0),

  // Network
  bridge: z.string().min(1).default("vmbr0"),
  vlanTag: z.number().int().min(1).max(4094).optional(),
  netModel: QemuNetModelSchema.default("virtio"),
  firewall: z.boolean().default(true),
});
export type CreateQemuInput = z.infer<typeof CreateQemuInputSchema>;

/** Fields editable after creation via PUT config — a subset of CreateQemuInput plus resize. */
export const UpdateQemuConfigInputSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  cores: z.number().int().min(1).max(128).optional(),
  sockets: z.number().int().min(1).max(4).optional(),
  cpuType: QemuCpuTypeSchema.optional(),
  memoryMiB: z.number().int().min(16).optional(),
  balloonMiB: z.number().int().min(0).optional(),
  qemuAgent: z.boolean().optional(),
  onboot: z.boolean().optional(),
  tags: z.string().optional(),
  /** Grow the named disk (e.g. "scsi0") to this absolute size; Proxmox does not support shrinking online. */
  diskResizeGiB: z.number().int().min(1).optional(),
  diskKey: z.string().optional(),
});
export type UpdateQemuConfigInput = z.infer<typeof UpdateQemuConfigInputSchema>;

// ---- LXC (container) creation — mirrors Proxmox's "Create CT" wizard ----

export const CreateLxcInputSchema = z.object({
  // General
  clusterId: z.string().uuid(),
  node: z.string().min(1),
  vmid: z.number().int().positive(),
  hostname: z.string().min(1).max(64).optional(),
  pool: z.string().optional(),
  unprivileged: z.boolean().default(true),
  startOnBoot: z.boolean().default(false),
  password: z.string().min(5),

  // Template
  ostemplate: z.string().min(1),

  // Disk
  storage: z.string().min(1),
  diskGiB: z.number().int().min(1).default(8),

  // CPU
  cores: z.number().int().min(1).max(128).default(1),

  // Memory
  memoryMiB: z.number().int().min(16).default(512),
  swapMiB: z.number().int().min(0).default(512),

  // Network
  bridge: z.string().min(1).default("vmbr0"),
  vlanTag: z.number().int().min(1).max(4094).optional(),
  useDhcp: z.boolean().default(true),
  ipAddressCidr: z.string().optional(),
  gateway: z.string().optional(),
  firewall: z.boolean().default(true),

  // DNS
  nameserver: z.string().optional(),
  searchDomain: z.string().optional(),
});
export type CreateLxcInput = z.infer<typeof CreateLxcInputSchema>;

export const UpdateLxcConfigInputSchema = z.object({
  hostname: z.string().min(1).max(64).optional(),
  cores: z.number().int().min(1).max(128).optional(),
  memoryMiB: z.number().int().min(16).optional(),
  swapMiB: z.number().int().min(0).optional(),
  onboot: z.boolean().optional(),
  /** Grow the rootfs to at least this size; Proxmox does not support shrinking online. */
  diskResizeGiB: z.number().int().min(1).optional(),
});
export type UpdateLxcConfigInput = z.infer<typeof UpdateLxcConfigInputSchema>;

export const GuestSnapshotSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  snaptime: z.number().optional(),
  parent: z.string().optional(),
});
export type GuestSnapshot = z.infer<typeof GuestSnapshotSchema>;

export const GuestRrdDataPointSchema = z.object({
  time: z.number(),
  cpu: z.number().optional(),
  mem: z.number().optional(),
  maxmem: z.number().optional(),
  disk: z.number().optional(),
  maxdisk: z.number().optional(),
  netin: z.number().optional(),
  netout: z.number().optional(),
  diskread: z.number().optional(),
  diskwrite: z.number().optional(),
});
export type GuestRrdDataPoint = z.infer<typeof GuestRrdDataPointSchema>;
