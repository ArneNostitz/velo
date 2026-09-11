import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface SpamBannerProps {
  onNotSpam: () => void;
  restoring?: boolean;
}

export function SpamBanner({ onNotSpam, restoring = false }: SpamBannerProps) {
  return (
    <div
      className="flex items-center gap-3 border-b border-danger/30 bg-danger/10 px-6 py-3"
      role="status"
    >
      <AlertTriangle size={18} className="shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-danger">This is spam</p>
        <p className="mt-0.5 text-xs text-text-secondary">
          This conversation is in your Spam folder. Be careful with links and attachments.
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={onNotSpam}
        disabled={restoring}
        className="shrink-0 border border-danger/30 bg-bg-primary text-danger hover:bg-danger/5 hover:text-danger"
      >
        {restoring ? "Moving…" : "Not spam"}
      </Button>
    </div>
  );
}
