import { useState } from "react";
import { getGravatarUrl } from "@/services/contacts/gravatar";

/**
 * Freemail domains whose favicon would show the provider's logo, not the
 * sender's identity — those senders fall straight back to the initial.
 */
const GENERIC_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "outlook.com", "outlook.de", "hotmail.com", "hotmail.de", "live.com", "live.de", "msn.com",
  "yahoo.com", "yahoo.de", "ymail.com",
  "icloud.com", "me.com", "mac.com",
  "aol.com", "protonmail.com", "proton.me", "pm.me",
  "gmx.at", "gmx.de", "gmx.net", "gmx.com", "web.de", "t-online.de", "freenet.de",
  "mail.com", "posteo.de", "mailbox.org", "fastmail.com", "zoho.com",
]);

type AvatarSource = "gravatar" | "favicon" | "initial";

// Remember what resolved per address so scrolling never re-requests dead URLs
const sourceCache = new Map<string, AvatarSource>();

function firstSource(address: string): AvatarSource {
  const cached = sourceCache.get(address);
  if (cached) return cached;
  return address ? "gravatar" : "initial";
}

function nextSource(current: AvatarSource, domain: string): AvatarSource {
  if (current === "gravatar" && domain && !GENERIC_DOMAINS.has(domain)) return "favicon";
  return "initial";
}

/**
 * Airmail-style sender avatar for the thread list: the sender's Gravatar
 * photo, then their domain's favicon (company logo), then the initial circle.
 */
export function SenderAvatar({
  email,
  name,
  isRead,
  className,
}: {
  email: string | null;
  name: string | null;
  isRead: boolean;
  className: string;
}) {
  const address = (email ?? "").trim().toLowerCase();
  const domain = address.includes("@") ? address.split("@")[1]! : "";

  const [state, setState] = useState<{ address: string; source: AvatarSource }>(() => ({
    address,
    source: firstSource(address),
  }));
  // Reset when this card is reused for a different sender (render-phase reset)
  if (state.address !== address) {
    setState({ address, source: firstSource(address) });
  }

  const handleError = () => {
    const source = nextSource(state.source, domain);
    sourceCache.set(address, source);
    setState({ address, source });
  };

  const handleLoad = () => {
    sourceCache.set(address, state.source);
  };

  const initial = (name?.[0] ?? email?.[0] ?? "?").toUpperCase();

  if (state.source === "gravatar") {
    return (
      <div className={`${className} rounded-full overflow-hidden bg-bg-tertiary`}>
        <img
          src={getGravatarUrl(address)}
          alt=""
          loading="lazy"
          onError={handleError}
          onLoad={handleLoad}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (state.source === "favicon") {
    return (
      <div className={`${className} rounded-full overflow-hidden bg-white flex items-center justify-center`}>
        <img
          src={`https://icons.duckduckgo.com/ip3/${domain}.ico`}
          alt=""
          loading="lazy"
          onError={handleError}
          onLoad={handleLoad}
          className="w-[70%] h-[70%] object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`${className} rounded-full flex items-center justify-center font-medium text-white ${
        isRead ? "bg-text-tertiary" : "bg-accent"
      }`}
    >
      {initial}
    </div>
  );
}
