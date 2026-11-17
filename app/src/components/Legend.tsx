import { EDGE_KINDS, GROUP_KINDS } from "@/lib/types";
import { EDGE_INFO, GROUP_INFO } from "@/lib/vocab";
import { EdgeSwatch } from "./canvas/edges";

const FRAME_STYLE: Record<string, React.CSSProperties> = {
  group: { background: "color-mix(in srgb, var(--foreground) 4%, transparent)", border: "1px solid var(--border)", borderRadius: 6 },
  layer: { background: "color-mix(in srgb, var(--tone-accent) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--tone-accent) 25%, transparent)", borderRadius: 5 },
  option: { border: "1.5px dashed color-mix(in srgb, var(--foreground) 35%, transparent)", borderRadius: 7 },
  boundary: { border: "2px dashed color-mix(in srgb, var(--tone-bad) 45%, var(--foreground) 20%)", borderRadius: 3 },
};

/** How to read lines and frames. Shown in the side sheet (More menu or ⌘K). */
export function LegendBody() {
  return (
    <div className="space-y-4">
      <div>
        <div className="pb-1 text-[12px] font-medium text-muted-foreground">Lines</div>
        {EDGE_KINDS.map((k) => (
          <div key={k} className="flex items-center gap-3 py-1.5">
            <EdgeSwatch kind={k} w={44} />
            <div className="w-[72px] shrink-0 text-[13px] font-medium">{EDGE_INFO[k].name}</div>
            <div className="text-[13px] text-muted-foreground">{EDGE_INFO[k].reads}</div>
          </div>
        ))}
        <div className="pt-1 text-[12.5px] text-muted-foreground">Arrowheads at both ends mean it goes both ways.</div>
      </div>
      <div>
        <div className="pb-1 text-[12px] font-medium text-muted-foreground">Frames</div>
        {GROUP_KINDS.map((g) => (
          <div key={g} className="flex items-center gap-3 py-1.5">
            <div className="h-[18px] w-[44px] shrink-0" style={FRAME_STYLE[g]} />
            <div className="w-[72px] shrink-0 text-[13px] font-medium">{GROUP_INFO[g].name}</div>
            <div className="text-[13px] text-muted-foreground">{GROUP_INFO[g].reads}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
