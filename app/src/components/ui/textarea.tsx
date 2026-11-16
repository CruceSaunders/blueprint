import * as React from "react";
import { cn } from "@/lib/utils";
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn("flex min-h-24 w-full rounded-md border bg-card px-2.5 py-2 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30", className)} {...props} />;
}
export { Textarea };
