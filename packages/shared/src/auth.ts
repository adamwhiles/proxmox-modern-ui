import { z } from "zod";

export const LoginInputSchema = z.object({
  clusterId: z.string().uuid(),
  username: z.string().min(1),
  password: z.string().min(1),
  realm: z.string().min(1).default("pam"),
  /** TOTP code, required if the Proxmox user has two-factor auth enabled. */
  otp: z.string().optional(),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const AppUserSchema = z.object({
  /** The app session is identified by the primary cluster's authenticated Proxmox user. */
  username: z.string(),
  realm: z.string(),
  isAppAdmin: z.boolean(),
});
export type AppUser = z.infer<typeof AppUserSchema>;
