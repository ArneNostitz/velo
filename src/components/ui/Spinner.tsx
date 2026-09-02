import { Loader2 } from "lucide-react";

interface SpinnerProps {
  size?: number;
  /** What is happening, for assistive tech. */
  label?: string;
  className?: string;
}

/**
 * Something is happening here.
 *
 * A control that is waiting on a server used to look identical to one that
 * was idle, which reads as "nothing is happening" — and then as "it is
 * broken". Any element that is connecting, syncing, sending or refreshing
 * shows one of these until it is not.
 */
export function Spinner({ size = 14, label = "Working…", className = "" }: SpinnerProps) {
  return (
    <Loader2
      size={size}
      aria-label={label}
      role="status"
      className={`animate-spin shrink-0 ${className}`}
    />
  );
}
