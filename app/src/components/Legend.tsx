import { BookOpen } from "lucide-react";
import { EDGE_KINDS, GROUP_KINDS } from "@/lib/types";
import { EDGE_INFO, GROUP_INFO } from "@/lib/vocab";
import { EdgeSwatch } from "./canvas/edges";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";

const FRAME_STYLE: Record<string, React.CSSProperties> = {
  group: { background: "color-mix(in srgb, var(--foreground) 4%, transparent)", border: "1px solid var(--border)", borderRadius: 6 },
  layer: { background: "color-mix(in srgb, var(--tone-accent) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--tone-accent) 25%, transparent)", borderRadius: 5 },
  option: { border: "1.5px dashed color-mix(in srgb, var(--foreground) 35%, transparent)", borderRadius: 7 },
  boundary: { border: "2px dashed color-mix(in srgb, var(--tone-bad) 45%, var(--foreground) 20%)", borderRadius: 3 },
};

export function Legend() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="no-drag text-muted-foreground"><BookOpen className="size-3.5" /> Legend</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] p-0">
        <div className="px-4 pb-2 pt-3.5">
          <div className="text-[13px] font-semibold">How to read a visual</div>
          <div className="text-[12px] text-muted-foreground">Click any box or line to see what it means.</div>
        </div>
        <div className="px-2 pb-2">
          <div className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Lines</div>
          {EDGE_KINDS.map((k) => (
            <div key={k} className="flex items-center gap-3 rounded-md px-2 py-1.5">
              <EdgeSwatch kind={k} w={52} />
              <div className="w-[76px] shrink-0 text-[12.5px] font-medium">{EDGE_INFO[k].name}</div>
              <div className="text-[12.5px] text-muted-foreground">{EDGE_INFO[k].reads}</div>
            </div>
          ))}
          <div className="px-2 py-1 text-[11.5px] text-muted-foreground">Arrowheads at both ends mean it goes both ways.</div>
          <div className="px-2 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Frames</div>
          {GROUP_KINDS.map((g) => (
            <div key={g} className="flex items-center gap-3 rounded-md px-2 py-1.5">
              <div className="h-[18px] w-[52px] shrink-0" style={FRAME_STYLE[g]} />
              <div className="w-[76px] shrink-0 text-[12.5px] font-medium">{GROUP_INFO[g].name}</div>
              <div className="text-[12.5px] text-muted-foreground">{GROUP_INFO[g].reads}</div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
