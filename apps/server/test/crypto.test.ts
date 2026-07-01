import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { encryptJson, decryptJson, timingSafeEqual, randomToken } from "../src/security/crypto.js";

const KEY = crypto.randomBytes(32).toString("hex");
const OTHER_KEY = crypto.randomBytes(32).toString("hex");

describe("encryptJson / decryptJson", () => {
  it("round-trips arbitrary JSON values", () => {
    const value = { clusters: { abc: { ticket: "secret-ticket" } }, csrfToken: "xyz" };
    const encrypted = encryptJson(value, KEY);
    expect(encrypted).not.toContain("secret-ticket");
    expect(decryptJson(encrypted, KEY)).toEqual(value);
  });

  it("fails to decrypt with the wrong key (data is unreadable without the exact key)", () => {
    const encrypted = encryptJson({ a: 1 }, KEY);
    expect(() => decryptJson(encrypted, OTHER_KEY)).toThrow();
  });

  it("detects tampering via the GCM auth tag", () => {
    const encrypted = encryptJson({ a: 1 }, KEY);
    const buf = Buffer.from(encrypted, "base64url");
    buf[buf.length - 1] ^= 0xff; // flip a bit in the ciphertext
    const tampered = buf.toString("base64url");
    expect(() => decryptJson(tampered, KEY)).toThrow();
  });

  it("rejects keys that are not exactly 32 bytes", () => {
    expect(() => encryptJson({ a: 1 }, "tooshort")).toThrow();
  });
});

describe("timingSafeEqual", () => {
  it("returns true only for identical strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
  });

  it("returns false (not throws) for different-length inputs", () => {
    expect(timingSafeEqual("short", "a-much-longer-string")).toBe(false);
  });
});

describe("randomToken", () => {
  it("produces unique, non-empty tokens", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });
});
