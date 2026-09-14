import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import InventoryPage from "@/app/dashboard/inventory/page";

function meResponse(): Response {
  return {
    ok: true,
    json: async () => ({ data: { profile: { defaultClinicId: "clinic-1" }, memberships: [] } }),
  } as Response;
}

function inventoryResponse(items: unknown[]): Response {
  return { ok: true, json: async () => ({ data: { items } }) } as Response;
}

describe("InventoryPage loading/empty states", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a distinct empty state, not a bare table, when there are no items", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/me")) return Promise.resolve(meResponse());
      return Promise.resolve(inventoryResponse([]));
    });

    render(<InventoryPage />);

    expect(await screen.findByText("אין פריטי מלאי עדיין")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("labels the add-item fields instead of relying on placeholder text alone", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/me")) return Promise.resolve(meResponse());
      return Promise.resolve(inventoryResponse([]));
    });

    render(<InventoryPage />);

    expect(screen.getByLabelText("שם פריט")).toBeInTheDocument();
    expect(screen.getByLabelText("כמות")).toBeInTheDocument();
  });
});
