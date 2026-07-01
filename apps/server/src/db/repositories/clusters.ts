import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { clusters } from "../schema.js";
import type { Cluster, CreateClusterInput } from "@proxmox-ui/shared";

export function listClusters(): Cluster[] {
  return db.select().from(clusters).all() as Cluster[];
}

export function getCluster(id: string): Cluster | undefined {
  return db.select().from(clusters).where(eq(clusters.id, id)).get() as Cluster | undefined;
}

export function countClusters(): number {
  return db.select().from(clusters).all().length;
}

export function createCluster(input: CreateClusterInput): Cluster {
  const record: Cluster = {
    id: randomUUID(),
    name: input.name,
    host: input.host,
    port: input.port,
    tlsFingerprint: input.tlsFingerprint,
    defaultRealm: input.defaultRealm,
    createdAt: new Date().toISOString(),
  };
  db.insert(clusters).values(record).run();
  return record;
}

export function deleteCluster(id: string): void {
  db.delete(clusters).where(eq(clusters.id, id)).run();
}
