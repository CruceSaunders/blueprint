import { EdgeLine, EdgeSwatch, type Kind } from "./edge-glyph";

// The nine relationship kinds. Names and plain-words meanings are the app's own (app/src/lib/vocab.ts EDGE_INFO),
// shown the way its detail panel shows them. Pick one to watch its line draw between two cards.
// Pattern adapted from 21st.dev "Feature List Showcase" (select an item, reveal its description).
// Selection is wired by the inline script in components/behaviour.tsx; without JS the first kind stays shown.
export const KINDS: [Kind, string][] = [
  ["flow", "A then B, or A feeds B"],
  ["increases", "More A → more B"],
  ["decreases", "More A → less B"],
  ["requires", "A needs B to exist or work"],
  ["becomes", "A turns into B"],
  ["equals", "A is the same thing as B"],
  ["versus", "A or B: a tradeoff"],
  ["blocks", "A prevents B"],
  ["relates", "Connected; nature not specified"],
];
const START = 1;

function MiniCard({ x, label }: { x: number; label: string }) {
  return (
    <g>
      <rect x={x} y={34} width={104} height={52} rx={12} fill="var(--card)" stroke="var(--line-strong)" strokeWidth={1} />
      <text x={x + 52} y={66} textAnchor="middle" fill="var(--ink)" fontSize={18} fontWeight={600} fontFamily="inherit">
        {label}
      </text>
    </g>
  );
}

export function Kinds() {
  return (
    <div className="mt-10" data-kinds>
      <ul aria-label="The nine kinds of line" className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
        {KINDS.map(([kind], i) => (
          <li key={kind}>
            <button
              type="button"
              data-kind={kind}
              aria-pressed={i === START}
              className="kind flex min-h-[64px] w-full flex-col items-start justify-center gap-1.5 rounded-xl px-3 py-2.5 text-left"
            >
              <span className="text-[1.0625rem] font-semibold tracking-tight sm:text-[1.125rem]">{kind}</span>
              <EdgeSwatch kind={kind} />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-8 grid items-center gap-6 rounded-[14px] border border-line bg-bg-2 p-5 sm:p-8 md:grid-cols-[1.4fr_1fr]">
        <div className="relative">
          {KINDS.map(([kind], i) => (
            <div key={kind} data-stage={kind} hidden={i !== START} className="stage">
              <svg viewBox="0 0 560 120" className="w-full" role="img" aria-label={`Two cards, A and B, joined by a ${kind} line`}>
                <MiniCard x={16} label="A" />
                <MiniCard x={440} label="B" />
                <g className="stage-line">
                  <EdgeLine kind={kind} x1={128} x2={432} y={60} />
                </g>
              </svg>
            </div>
          ))}
        </div>
        <p aria-live="polite" className="text-lead">
          <span className="font-semibold" data-kind-name>
            {KINDS[START][0]}
          </span>
          <span className="text-muted">: </span>
          <span className="text-muted" data-kind-reads>
            {KINDS[START][1]}
          </span>
        </p>
      </div>
      {/* Every meaning stays in the HTML for crawlers and for readers without JS. */}
      <dl className="sr-only">
        {KINDS.map(([kind, reads]) => (
          <div key={kind}>
            <dt>{kind}</dt>
            <dd>{reads}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
