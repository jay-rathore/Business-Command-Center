"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScanBusinessCardDialog } from "./ScanBusinessCardDialog";

export function ScanBusinessCardView() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-text-primary">Scan Business Card</h1>
        <p className="text-sm text-text-muted">Turn a photographed or uploaded business card into an offline-marketing lead.</p>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 rounded-sm border border-dashed border-border bg-surface py-16 text-center">
        <ScanLine className="h-10 w-10 text-text-muted" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-text-primary">Capture a business card to create a lead</p>
          <p className="max-w-sm text-xs text-text-muted">
            Upload an image or take a photo — AI extracts the contact details, you review and edit them, then a new lead is
            created automatically.
          </p>
        </div>
        <Button type="button" onClick={() => setDialogOpen(true)}>
          Scan Business Card
        </Button>
      </div>

      <ScanBusinessCardDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
