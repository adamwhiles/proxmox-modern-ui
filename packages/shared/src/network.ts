import { z } from "zod";

const baseIfaceFields = {
  clusterId: z.string().uuid(),
  node: z.string().min(1),
  iface: z.string().min(1).max(20),
  autostart: z.boolean().default(true),
  address: z.string().optional(),
  netmask: z.string().optional(),
  gateway: z.string().optional(),
  comments: z.string().optional(),
};

export const CreateNetworkInterfaceInputSchema = z.discriminatedUnion("type", [
  z.object({ ...baseIfaceFields, type: z.literal("bridge"), bridgePorts: z.string().optional(), vlanAware: z.boolean().default(false) }),
  z.object({ ...baseIfaceFields, type: z.literal("vlan"), vlanRawDevice: z.string().min(1), vlanId: z.number().int().min(1).max(4094) }),
]);
export type CreateNetworkInterfaceInput = z.infer<typeof CreateNetworkInterfaceInputSchema>;

export const UpdateNetworkInterfaceInputSchema = z.object({
  clusterId: z.string().uuid(),
  node: z.string().min(1),
  iface: z.string().min(1),
  autostart: z.boolean().optional(),
  address: z.string().optional(),
  netmask: z.string().optional(),
  gateway: z.string().optional(),
  bridgePorts: z.string().optional(),
  comments: z.string().optional(),
});
export type UpdateNetworkInterfaceInput = z.infer<typeof UpdateNetworkInterfaceInputSchema>;

export const SdnZoneTypeSchema = z.enum(["simple", "vlan"]);

export const CreateSdnZoneInputSchema = z.object({
  clusterId: z.string().uuid(),
  zone: z.string().min(1).max(8),
  type: SdnZoneTypeSchema,
  bridge: z.string().optional(), // required for "vlan" zones
  nodes: z.string().optional(),
  mtu: z.number().int().optional(),
});
export type CreateSdnZoneInput = z.infer<typeof CreateSdnZoneInputSchema>;

export const CreateSdnVnetInputSchema = z.object({
  clusterId: z.string().uuid(),
  vnet: z.string().min(1).max(8),
  zone: z.string().min(1),
  tag: z.number().int().min(1).max(4094).optional(),
  alias: z.string().optional(),
});
export type CreateSdnVnetInput = z.infer<typeof CreateSdnVnetInputSchema>;
