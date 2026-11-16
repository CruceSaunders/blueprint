import * as React from "react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
const DropdownMenu = DM.Root;
const DropdownMenuTrigger = DM.Trigger;
function DropdownMenuContent({ className, sideOffset = 4, ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content sideOffset={sideOffset} className={cn("z-50 min-w-44 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg", className)} {...props} />
    </DM.Portal>
  );
}
function DropdownMenuItem({ className, destructive, ...props }: React.ComponentProps<typeof DM.Item> & { destructive?: boolean }) {
  return <DM.Item className={cn("flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-accent [&_svg]:size-3.5 [&_svg]:text-muted-foreground", destructive && "text-destructive [&_svg]:text-destructive", className)} {...props} />;
}
function DropdownMenuSeparator(props: React.ComponentProps<typeof DM.Separator>) {
  return <DM.Separator className="-mx-1 my-1 h-px bg-border" {...props} />;
}
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator };
