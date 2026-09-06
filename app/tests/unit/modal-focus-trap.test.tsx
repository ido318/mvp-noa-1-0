import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "@/components/dashboard/ui/modal";

afterEach(() => {
  cleanup();
});

describe("Modal focus trap", () => {
  it("moves focus to the first focusable element on open", async () => {
    render(
      <Modal open onClose={vi.fn()} title="כותרת">
        <button type="button">שמור</button>
        <button type="button">בטל</button>
      </Modal>,
    );

    // Close button renders before the children, so it's first in tab order.
    expect(await screen.findByRole("button", { name: "סגור" })).toHaveFocus();
  });

  it("wraps Tab from the last focusable element back to the first", async () => {
    render(
      <Modal open onClose={vi.fn()} title="כותרת">
        <button type="button">שמור</button>
      </Modal>,
    );

    const closeButton = await screen.findByRole("button", { name: "סגור" });
    const saveButton = screen.getByRole("button", { name: "שמור" });

    saveButton.focus();
    expect(saveButton).toHaveFocus();

    fireEvent.keyDown(saveButton, { key: "Tab" });
    expect(closeButton).toHaveFocus();
  });

  it("wraps Shift+Tab from the first focusable element to the last", async () => {
    render(
      <Modal open onClose={vi.fn()} title="כותרת">
        <button type="button">שמור</button>
      </Modal>,
    );

    const closeButton = await screen.findByRole("button", { name: "סגור" });
    const saveButton = screen.getByRole("button", { name: "שמור" });

    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    expect(saveButton).toHaveFocus();
  });

  it("restores focus to the trigger element on close", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "פתח";
    document.body.appendChild(trigger);
    trigger.focus();
    expect(trigger).toHaveFocus();

    const { rerender } = render(
      <Modal open onClose={vi.fn()} title="כותרת">
        <button type="button">שמור</button>
      </Modal>,
    );
    await screen.findByRole("button", { name: "סגור" });

    rerender(
      <Modal open={false} onClose={vi.fn()} title="כותרת">
        <button type="button">שמור</button>
      </Modal>,
    );

    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
