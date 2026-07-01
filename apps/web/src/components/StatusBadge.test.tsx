import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the running status", () => {
    render(<StatusBadge status="running" />);
    expect(screen.getByText("running")).toBeInTheDocument();
  });

  it("renders the stopped status", () => {
    render(<StatusBadge status="stopped" />);
    expect(screen.getByText("stopped")).toBeInTheDocument();
  });

  it("renders unknown when no status is provided", () => {
    render(<StatusBadge />);
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });
});
