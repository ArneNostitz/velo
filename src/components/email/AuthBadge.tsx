import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import type { AuthResult } from "@/services/gmail/authParser";

interface AuthBadgeProps {
  authResults: string | null;
}

/**
 * SPF/DKIM/DMARC at a glance, with the three results behind a tooltip.
 *
 * The tooltip goes through `ui/Tooltip` rather than an absolutely positioned
 * span of its own: the badge sits inside the header's truncating name line,
 * whose `overflow: hidden` clipped the bubble away entirely — all that
 * reached the screen was a hint of its shadow. `Tooltip` portals to the body,
 * so no ancestor's overflow can reach it.
 */
export function AuthBadge({ authResults }: AuthBadgeProps) {
  if (!authResults) return null;

  let parsed: AuthResult;
  try {
    parsed = JSON.parse(authResults) as AuthResult;
  } catch {
    return null;
  }

  const { aggregate, spf, dkim, dmarc } = parsed;

  const iconProps = { size: 14, className: "shrink-0" };

  let icon: React.ReactNode;
  let colorClass: string;
  let label: string;

  switch (aggregate) {
    case "pass":
      icon = <ShieldCheck {...iconProps} />;
      colorClass = "text-success";
      label = "Authentication passed";
      break;
    case "warning":
      icon = <ShieldAlert {...iconProps} />;
      colorClass = "text-warning";
      label = "Authentication warning";
      break;
    case "fail":
      icon = <ShieldX {...iconProps} />;
      colorClass = "text-danger";
      label = "Authentication failed";
      break;
    default:
      icon = <ShieldQuestion {...iconProps} />;
      colorClass = "text-text-tertiary";
      label = "Authentication unknown";
      break;
  }

  const detail = (result: { result: string; detail?: string | null }) =>
    `${result.result}${result.detail ? ` (${result.detail})` : ""}`;

  return (
    <Tooltip
      content={
        <span className="block whitespace-pre-line">
          {`${label}\nSPF: ${detail(spf)}\nDKIM: ${detail(dkim)}\nDMARC: ${detail(dmarc)}`}
        </span>
      }
    >
      <span
        className={`inline-flex items-center ${colorClass}`}
        aria-label={label}
        role="img"
      >
        {icon}
      </span>
    </Tooltip>
  );
}
