import { describe, it, expect, vi, beforeEach } from "vitest";

const confirmDialog = vi.fn();
vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: (...args: unknown[]) => confirmDialog(...args),
}));

const { confirmDelete, BULK_DELETE_CONFIRM_THRESHOLD } = await import("./confirmDelete");

describe("confirmDelete", () => {
  beforeEach(() => {
    confirmDialog.mockReset();
    confirmDialog.mockResolvedValue(true);
  });

  it("does not ask for a small trash", async () => {
    await expect(confirmDelete(3, false)).resolves.toBe(true);
    expect(confirmDialog).not.toHaveBeenCalled();
  });

  it("asks once the sweep gets large", async () => {
    await expect(confirmDelete(BULK_DELETE_CONFIRM_THRESHOLD, false)).resolves.toBe(true);
    expect(confirmDialog).toHaveBeenCalledOnce();
  });

  it("always asks before a permanent delete", async () => {
    await expect(confirmDelete(1, true)).resolves.toBe(true);
    expect(confirmDialog).toHaveBeenCalledOnce();
    expect(String(confirmDialog.mock.calls[0]?.[0])).toContain("cannot be undone");
  });

  it("passes a refusal through", async () => {
    confirmDialog.mockResolvedValue(false);
    await expect(confirmDelete(50, false)).resolves.toBe(false);
  });

  it("refuses when the dialog cannot be shown", async () => {
    confirmDialog.mockRejectedValue(new Error("no dialog"));
    await expect(confirmDelete(50, false)).resolves.toBe(false);
  });

  it("refuses an empty selection", async () => {
    await expect(confirmDelete(0, true)).resolves.toBe(false);
    expect(confirmDialog).not.toHaveBeenCalled();
  });
});
