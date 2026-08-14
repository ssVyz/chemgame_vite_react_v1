import { useMemo } from 'react';
import type { ChainGraph as Graph, ChainNode, ChainEdge, FlowTrace } from '../../lib/processChain';
import { processIcon, phaseIcon } from '../../lib/icons';
import { formatCompact } from '../../lib/format';

interface ChainGraphProps {
  graph: Graph;
  /** Highlighted flow (hover or selection); null = nothing emphasised. */
  trace: FlowTrace | null;
  selectedId: string | null;
  zoom: number;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}

interface Geometry { d: string; mx: number; my: number; }

/** Cubic-bezier midpoint (de Casteljau at t = 0.5). */
const mid = (p0: number, p1: number, p2: number, p3: number) => (p0 + 3 * p1 + 3 * p2 + p3) / 8;

function geometry(a: ChainNode, b: ChainNode, feedback: boolean): Geometry {
  if (feedback) {
    // Loop-closing edge: leaves the top of the lower node and sweeps around the
    // side back into the bottom of the node it feeds.
    const x1 = a.x + a.w / 2, y1 = a.y;
    const x2 = b.x + b.w / 2, y2 = b.y + b.h;
    const side = x1 >= x2 ? 1 : -1;
    const bow = side * (70 + 14 * Math.abs(a.layer - b.layer));
    const c1x = x1 + bow, c1y = y1 - 34;
    const c2x = x2 + bow, c2y = y2 + 34;
    return {
      d: `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`,
      mx: mid(x1, c1x, c2x, x2),
      my: mid(y1, c1y, c2y, y2),
    };
  }
  const x1 = a.x + a.w / 2, y1 = a.y + a.h;
  const x2 = b.x + b.w / 2, y2 = b.y;
  const span = Math.max(1, b.layer - a.layer);
  const dy = Math.max(22, (y2 - y1) / 3);
  // Edges that skip rows bow sideways so they do not lie across the nodes in
  // between.
  const bow = span > 2 ? (x2 >= x1 ? 1 : -1) * Math.min(150, 34 * span) : 0;
  const c1x = x1 + bow, c1y = y1 + dy;
  const c2x = x2 + bow, c2y = y2 - dy;
  return {
    d: `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`,
    mx: mid(x1, c1x, c2x, x2),
    my: mid(y1, c1y, c2y, y2),
  };
}

function edgeTone(e: ChainEdge, hi: boolean, dim: boolean): { cls: string; marker: string } {
  if (hi) return { cls: 'chain-edge chain-edge--hi', marker: 'ch-arrow-hi' };
  if (e.feedback) return {
    cls: `chain-edge chain-edge--loop${dim ? ' is-dim' : ''}`,
    marker: dim ? 'ch-arrow-dim' : 'ch-arrow-loop',
  };
  if (e.ghost) return {
    cls: `chain-edge chain-edge--ghost${dim ? ' is-dim' : ''}`,
    marker: 'ch-arrow-dim',
  };
  return { cls: `chain-edge${dim ? ' is-dim' : ''}`, marker: dim ? 'ch-arrow-dim' : 'ch-arrow' };
}

export function ChainGraph({ graph, trace, selectedId, zoom, onSelect, onHover }: ChainGraphProps) {
  const materialName = useMemo(() => {
    const m = new Map<number, string>();
    graph.nodes.forEach((n) => { if (n.kind === 'material') m.set(n.resId, n.name); });
    return m;
  }, [graph]);

  const stageW = Math.ceil(graph.width * zoom);
  const stageH = Math.ceil(graph.height * zoom);

  return (
    <div className="chain-viewport">
      <div className="chain-stage" style={{ width: stageW, height: stageH }}>
        <div
          className="chain-stage__inner"
          style={{ width: graph.width, height: graph.height, transform: `scale(${zoom})` }}
        >
          <svg className="chain-edges" width={graph.width} height={graph.height} aria-hidden="true">
            <defs>
              {[
                ['ch-arrow', 'var(--chain-edge)'],
                ['ch-arrow-hi', 'var(--color-primary)'],
                ['ch-arrow-loop', 'var(--color-warning)'],
                ['ch-arrow-dim', 'var(--chain-edge-dim)'],
              ].map(([id, fill]) => (
                <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={fill} />
                </marker>
              ))}
            </defs>

            {graph.edges.map((e) => {
              const a = graph.byId.get(e.from)!;
              const b = graph.byId.get(e.to)!;
              const g = geometry(a, b, e.feedback);
              const hi = !!trace?.edges.has(e.id);
              const dim = !!trace && !hi;
              const { cls, marker } = edgeTone(e, hi, dim);
              return (
                <g key={e.id}>
                  <path className={cls} d={g.d} markerEnd={`url(#${marker})`} />
                  {hi && (
                    <text className="chain-edge__label" x={g.mx} y={g.my}>
                      {formatCompact(e.amount)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {graph.nodes.map((n) => {
            const hi = !!trace?.nodes.has(n.id);
            const dim = !!trace && !hi;
            const selected = n.id === selectedId;
            const classes = [
              'chain-node',
              `chain-node--${n.kind}`,
              `chain-node--${n.role}`,
              n.ghost ? 'is-ghost' : '',
              hi ? 'is-hi' : '',
              dim ? 'is-dim' : '',
              selected ? 'is-selected' : '',
            ].filter(Boolean).join(' ');

            const common = {
              className: classes,
              style: { left: n.x, top: n.y, width: n.w, height: n.h },
              onMouseEnter: () => onHover(n.id),
              onMouseLeave: () => onHover(null),
              onClick: () => onSelect(selected ? null : n.id),
            };

            if (n.kind === 'material') {
              const swatch = n.color1 && n.color2
                ? `linear-gradient(135deg, ${n.color1} 0 50%, ${n.color2} 50% 100%)`
                : (n.color1 ?? n.color2 ?? 'var(--color-surface-3)');
              return (
                <button key={n.id} type="button" {...common}
                  title={`${n.name} — stock ${n.amount.toLocaleString()}`}>
                  <span className="chain-mat__swatch" style={{ background: swatch }} />
                  <span className="chain-node__body">
                    <span className="chain-node__name">{n.name}</span>
                    <span className="chain-node__meta">
                      {phaseIcon(n.phase)} {formatCompact(n.amount)}
                      {n.role === 'external' && <span className="chain-tag">supply</span>}
                      {n.role === 'terminal' && <span className="chain-tag">end</span>}
                      {n.sellable && <span className="chain-tag chain-tag--sell">💰</span>}
                    </span>
                  </span>
                </button>
              );
            }

            const recycled = n.recycles.map((r) => materialName.get(r) ?? `#${r}`).join(', ');
            return (
              <button key={n.id} type="button" {...common}
                title={n.ghost ? `${n.name} — not installed (one step away)` : n.name}>
                <span className="chain-proc__icon">{processIcon(n.category)}</span>
                <span className="chain-node__body">
                  <span className="chain-node__name">{n.name}</span>
                  <span className="chain-node__meta">
                    {n.role === 'purchase' ? 'buys in' : n.role === 'extract' ? 'extracts' : n.category}
                    {n.installCount > 1 && <span className="chain-tag">×{n.installCount}</span>}
                    {n.ghost && <span className="chain-tag chain-tag--ghost">+1 step</span>}
                    {n.ghost && n.locked && <span className="chain-tag chain-tag--lock">🔒</span>}
                    {n.recycles.length > 0 && (
                      <span className="chain-tag chain-tag--loop" title={`Recycles ${recycled}`}>♻</span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
