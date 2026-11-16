import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";
const TooltipProvider = TooltipPrimitive.Provider;
function Tip({ label, side = "top", children }: { label: React.ReactNode; side?: "top" | "bottom" | "left" | "right"; children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Root delayDuration={350}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={6} className={cn("z-50 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground shadow")}>{label}</TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
export { TooltipProvider, Tip };
