import { config } from "../config.js";
import { countClusters } from "../db/repositories/clusters.js";
import { timingSafeEqual } from "./crypto.js";

/** Whether this Proxmox identity is allowed to manage the cluster registry & app-wide settings. */
export function isAppAdmin(username: string, realm: string): boolean {
  if (config.appAdminUsers.length === 0) return false;
  return config.appAdminUsers.includes(`${username}@${realm}`);
}

/**
 * Resolves the chicken-and-egg bootstrap problem: you can't log in via a cluster that isn't
 * registered yet, and app-admin is defined in terms of a Proxmox identity. The very first cluster
 * may instead be registered with a one-time SETUP_TOKEN, before any session exists.
 */
export function canBootstrapWithSetupToken(providedToken: string | undefined): boolean {
  if (countClusters() > 0) return false; // bootstrap window closes once any cluster is registered
  if (!config.setupToken || !providedToken) return false;
  return timingSafeEqual(providedToken, config.setupToken);
}
