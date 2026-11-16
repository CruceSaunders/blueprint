import * as React from "react";
import { Command as C } from "cmdk";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
function Command({ className, ...props }: React.ComponentProps<typeof C>) {
  return <C className={cn("flex h-full w-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground", className)} {...props} />;
}
function CommandInput({ className, ...props }: React.ComponentProps<typeof C.Input>) {
  return (
    <div className="flex items-center gap-2 border-b px-3">
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <C.Input className={cn("flex h-11 w-full bg-transparent py-3 text-[14px] outline-none placeholder:text-muted-foreground", className)} {...props} />
    </div>
  );
}
function CommandList({ className, ...props }: React.ComponentProps<typeof C.List>) {
  return <C.List className={cn("max-h-[360px] overflow-y-auto overflow-x-hidden p-1", className)} {...props} />;
}
const CommandEmpty = (props: React.ComponentProps<typeof C.Empty>) => <C.Empty className="py-8 text-center text-[13px] text-muted-foreground" {...props} />;
function CommandGroup({ className, ...props }: React.ComponentProps<typeof C.Group>) {
  return <C.Group className={cn("overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground", className)} {...props} />;
}
function CommandItem({ className, ...props }: React.ComponentProps<typeof C.Item>) {
  return <C.Item className={cn("relative flex cursor-default select-none items-center gap-2.5 rounded-md px-2 py-2 text-[13px] outline-none data-[selected=true]:bg-accent [&_svg]:size-4 [&_svg]:text-muted-foreground", className)} {...props} />;
}
export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem };
