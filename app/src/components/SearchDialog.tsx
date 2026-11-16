import { useEffect, useState } from "react";
import { Folder, Layers, RectangleHorizontal, Shapes } from "lucide-react";
import { api } from "@/lib/api";
import type { SearchHit, TreeProject, VisualIds } from "@/lib/types";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";

const ICON = { project: Folder, system: Layers, visual: Shapes, node: RectangleHorizontal };
const GROUP = { project: "Projects", system: "Systems", visual: "Visuals", node: "Things inside visuals" };

export function SearchDialog({ open, onOpenChange, tree, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; tree: TreeProject[]; onPick: (ids: VisualIds, nodeId?: string) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);
  useEffect(() => {
    const t = window.setTimeout(() => void api.search(q).then(setHits), 120);
    return () => window.clearTimeout(t);
  }, [q]);
  const pick = (h: SearchHit) => {
    let ids: VisualIds | null = null;
    if (h.visualId && h.systemId) ids = { projectId: h.projectId, systemId: h.systemId, visualId: h.visualId };
    else {
      const p = tree.find((x) => x.id === h.projectId);
      const s = h.systemId ? p?.systems.find((x) => x.id === h.systemId) : p?.systems.find((x) => x.visuals.length);
      const v = s?.primaryVisual ?? s?.visuals[0]?.id;
      if (p && s && v) ids = { projectId: p.id, systemId: s.id, visualId: v };
    }
    if (ids) onPick(ids, h.nodeId);
    onOpenChange(false);
  };
  const groups = (["project", "system", "visual", "node"] as const).map((t) => [t, hits.filter((h) => h.type === t)] as const).filter(([, l]) => l.length);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="top-[22%] max-w-xl translate-y-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Command shouldFilter={false}>
          <CommandInput value={q} onValueChange={setQ} placeholder="Search projects, systems and everything inside them…" />
          <CommandList>
            {q.trim() && <CommandEmpty>Nothing matches “{q}”.</CommandEmpty>}
            {!q.trim() && <div className="py-8 text-center text-[13px] text-muted-foreground">Type to search titles, notes and explanations.</div>}
            {groups.map(([t, list]) => (
              <CommandGroup key={t} heading={GROUP[t]}>
                {list.map((h, i) => {
                  const Icon = ICON[h.type];
                  return (
                    <CommandItem key={`${t}-${i}-${h.projectId}-${h.systemId}-${h.visualId}-${h.nodeId}`} value={`${t}-${i}`} onSelect={() => pick(h)}>
                      <Icon />
                      <div className="min-w-0">
                        <div className="truncate">{h.title}</div>
                        {h.context && <div className="truncate text-[11.5px] text-muted-foreground">{h.context}</div>}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
