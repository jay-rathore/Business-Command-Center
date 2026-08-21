import { AlertOctagon, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Something went wrong",
  description = "This data couldn't be loaded. Check your connection and try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-critical-tint text-critical">
        <AlertOctagon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="mt-1 max-w-xs text-xs text-text-muted">{description}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
