"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useDrawerStore } from "@/lib/stores/drawerStore";
import { drawerRegistry } from "./drawer-registry";

export function Drawer() {
  const { isOpen, type, data, close } = useDrawerStore();
  const Renderer = type ? drawerRegistry[type] : null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent>{Renderer && data ? <Renderer data={data} /> : null}</SheetContent>
    </Sheet>
  );
}
