import { describe, it, expect } from "vitest";
import { CreateClusterInputSchema } from "./cluster.js";

describe("CreateClusterInputSchema", () => {
  const valid = {
    name: "Home Lab",
    host: "pve.local",
    port: 8006,
    defaultRealm: "pam",
    tlsFingerprint: "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99",
  };

  it("accepts a well-formed cluster registration", () => {
    expect(CreateClusterInputSchema.parse(valid)).toMatchObject(valid);
  });

  it("rejects a fingerprint that isn't colon-separated hex", () => {
    expect(() => CreateClusterInputSchema.parse({ ...valid, tlsFingerprint: "not-a-fingerprint" })).toThrow();
  });

  it("rejects a fingerprint with the wrong number of octets", () => {
    expect(() => CreateClusterInputSchema.parse({ ...valid, tlsFingerprint: "AA:BB:CC" })).toThrow();
  });

  it("defaults port and realm when omitted", () => {
    const { port, defaultRealm, ...rest } = valid;
    const parsed = CreateClusterInputSchema.parse(rest);
    expect(parsed.port).toBe(8006);
    expect(parsed.defaultRealm).toBe("pam");
  });
});
