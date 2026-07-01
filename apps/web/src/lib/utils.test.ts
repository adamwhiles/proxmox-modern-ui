import { describe, it, expect } from "vitest";
import { formatBytes, formatPercent, formatUptime, cn } from "./utils";

describe("formatBytes", () => {
  it("renders human-readable units", () => {
    expect(formatBytes(0)).toBe("-");
    expect(formatBytes(512)).toBe("512.0 B");
    expect(formatBytes(1024)).toBe("1.0 KiB");
    expect(formatBytes(1024 * 1024 * 3.5)).toBe("3.5 MiB");
  });

  it("handles undefined gracefully", () => {
    expect(formatBytes(undefined)).toBe("-");
  });
});

describe("formatUptime", () => {
  it("formats seconds into days/hours/minutes", () => {
    expect(formatUptime(90)).toBe("1m");
    expect(formatUptime(3660)).toBe("1h 1m");
    expect(formatUptime(90000)).toBe("1d 1h");
  });

  it("handles undefined/zero gracefully", () => {
    expect(formatUptime(undefined)).toBe("-");
    expect(formatUptime(0)).toBe("-");
  });
});

describe("formatPercent", () => {
  it("converts a fraction to a percentage string", () => {
    expect(formatPercent(0.5)).toBe("50.0%");
    expect(formatPercent(0)).toBe("0.0%");
  });

  it("handles undefined gracefully", () => {
    expect(formatPercent(undefined)).toBe("-");
  });
});

describe("cn", () => {
  it("merges class names and resolves tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", undefined, "font-bold")).toBe("text-sm font-bold");
  });
});
