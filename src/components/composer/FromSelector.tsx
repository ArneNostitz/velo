import type { Identity } from "@/services/accounts/identities";

interface FromSelectorProps {
  identities: Identity[];
  selectedEmail: string;
  selectedAccountId: string | null;
  onChange: (identity: Identity) => void;
}

/** An address alone is ambiguous — the same alias can sit on two accounts. */
function key(identity: { accountId: string; email: string }): string {
  return `${identity.accountId}|${identity.email}`;
}

function label(identity: Identity): string {
  return identity.displayName
    ? `${identity.displayName} <${identity.email}>`
    : identity.email;
}

/**
 * Dropdown for choosing the address a message is sent from.
 *
 * Lists every identity the user has — each account's own address plus its
 * verified send-as aliases — grouped by mailbox, since picking one from
 * another account also switches which mailbox sends the message. Hidden when
 * there is only one address to choose from.
 */
export function FromSelector({
  identities,
  selectedEmail,
  selectedAccountId,
  onChange,
}: FromSelectorProps) {
  if (identities.length <= 1) return null;

  // Keep the accounts in the order they were collected in
  const accountIds = [...new Set(identities.map((i) => i.accountId))];
  const multipleAccounts = accountIds.length > 1;
  const selected =
    identities.find(
      (i) => i.email === selectedEmail && i.accountId === selectedAccountId,
    ) ?? identities.find((i) => i.email === selectedEmail);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-tertiary w-8 shrink-0">
        From
      </span>
      <select
        value={selected ? key(selected) : ""}
        onChange={(e) => {
          const identity = identities.find((i) => key(i) === e.target.value);
          if (identity) onChange(identity);
        }}
        className="flex-1 bg-transparent text-sm text-text-primary outline-none cursor-pointer hover:bg-bg-hover rounded px-1 py-0.5 -ml-1 border-none"
      >
        {multipleAccounts
          ? accountIds.map((accountId) => {
              const group = identities.filter((i) => i.accountId === accountId);
              return (
                <optgroup key={accountId} label={group[0]?.accountEmail ?? ""}>
                  {group.map((identity) => (
                    <option key={key(identity)} value={key(identity)}>
                      {label(identity)}
                    </option>
                  ))}
                </optgroup>
              );
            })
          : identities.map((identity) => (
              <option key={key(identity)} value={key(identity)}>
                {label(identity)}
              </option>
            ))}
      </select>
    </div>
  );
}
