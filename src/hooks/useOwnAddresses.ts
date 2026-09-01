import { useEffect, useMemo, useState } from "react";
import { collectOwnAddresses } from "@/services/accounts/ownAddresses";
import { useAccountStore } from "@/stores/accountStore";

/**
 * Every address the user sends from across the given accounts, lowercased.
 *
 * Used wherever a view has to tell the user's own messages apart from the
 * other side's — the chat thread's left/right split, the "me:" marker in the
 * list. Returns an empty set until the aliases have loaded, which reads as
 * "nothing is mine yet" rather than mislabelling anything.
 */
export function useOwnAddresses(accountIds: string[]): Set<string> {
  const accounts = useAccountStore((s) => s.accounts);
  const scopeKey = accountIds.join(",");
  const [addresses, setAddresses] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    collectOwnAddresses(accounts, scopeKey ? scopeKey.split(",") : []).then((result) => {
      if (!cancelled) setAddresses(result);
    });
    return () => { cancelled = true; };
  }, [accounts, scopeKey]);

  const key = addresses.join(",");
  return useMemo(
    () => new Set(addresses.map((a) => a.toLowerCase())),
    [key], // eslint-disable-line react-hooks/exhaustive-deps
  );
}
