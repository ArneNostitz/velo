/**
 * Which folder a thread "lives in", as a person would name it.
 *
 * Search hits come from the whole mailbox, so a result list mixes inbox mail
 * with things in Trash, Spam or Drafts and nothing on the row said which —
 * a mail found in Trash looked exactly like one in the inbox. Gmail's model
 * is labels, not folders, so this picks the one label that best answers
 * "where is it": the destructive ones first (a trashed thread may still carry
 * INBOX), then the mailbox proper, then a user label, else it is archived.
 */
export type ThreadFolderId =
  | "trash"
  | "spam"
  | "drafts"
  | "snoozed"
  | "inbox"
  | "sent"
  | "label"
  | "archive";

export interface ThreadFolder {
  id: ThreadFolderId;
  name: string;
}

const SYSTEM: Array<[labelId: string, folder: ThreadFolder]> = [
  ["TRASH", { id: "trash", name: "Trash" }],
  ["SPAM", { id: "spam", name: "Spam" }],
  ["DRAFT", { id: "drafts", name: "Drafts" }],
  ["SNOOZED", { id: "snoozed", name: "Snoozed" }],
  ["INBOX", { id: "inbox", name: "Inbox" }],
  ["SENT", { id: "sent", name: "Sent" }],
];

// Labels that say something about a thread but not where it is
const NOT_A_PLACE = new Set(["STARRED", "UNREAD", "IMPORTANT", "CHAT"]);

/**
 * @param labelNames user labels by id, for naming a thread filed under one
 */
export function threadFolder(
  labelIds: readonly string[],
  labelNames?: ReadonlyMap<string, string>,
): ThreadFolder {
  const ids = new Set(labelIds);
  for (const [labelId, folder] of SYSTEM) {
    if (ids.has(labelId)) return folder;
  }
  for (const id of labelIds) {
    if (NOT_A_PLACE.has(id) || id.startsWith("CATEGORY_")) continue;
    const name = labelNames?.get(id);
    if (name) return { id: "label", name };
  }
  return { id: "archive", name: "Archive" };
}
