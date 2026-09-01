/**
 * Ask before a delete that the user cannot easily undo.
 *
 * Trashing one or a few conversations is routine and stays silent — Gmail's
 * Trash holds them for 30 days. A large sweep is asked about because it is
 * usually a mis-selection, and a permanent delete is always asked about
 * because nothing brings it back.
 */
export const BULK_DELETE_CONFIRM_THRESHOLD = 10;

export async function confirmDelete(
  count: number,
  permanent: boolean,
): Promise<boolean> {
  if (count <= 0) return false;
  if (!permanent && count < BULK_DELETE_CONFIRM_THRESHOLD) return true;

  const subject =
    count === 1 ? "this conversation" : `these ${count} conversations`;
  const message = permanent
    ? `Permanently delete ${subject}? This cannot be undone.`
    : `Move ${subject} to Trash?`;

  try {
    const { confirm } = await import("@tauri-apps/plugin-dialog");
    return await confirm(message, {
      title: permanent ? "Delete permanently" : "Delete conversations",
      kind: "warning",
      okLabel: permanent ? "Delete permanently" : "Move to Trash",
      cancelLabel: "Cancel",
    });
  } catch (err) {
    // No dialog means no informed consent — leave the mail alone
    console.error("Could not show the delete confirmation:", err);
    return false;
  }
}
