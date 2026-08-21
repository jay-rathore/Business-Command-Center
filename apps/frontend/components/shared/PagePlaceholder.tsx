import { Hammer } from "lucide-react";

export function PagePlaceholder({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-tint text-accent-strong">
        <Hammer className="h-6 w-6" />
      </div>
      <h2 className="font-display text-lg font-semibold text-text-primary">{title}</h2>
      <p className="max-w-sm text-sm text-text-muted">
        Part of Phase 1 — the app shell, auth, and navigation are ready; this module&apos;s dashboard, data table
        and API wiring are being built next.
      </p>
    </div>
  );
}
