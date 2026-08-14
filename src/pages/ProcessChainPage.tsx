import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { Card, Badge, StatTile, MaterialChip } from '../components/ui';
import { RecipeCard } from '../components/game/RecipeCard';
import { ChainGraph } from '../components/chain/ChainGraph';
import { buildChainGraph, traceFlow } from '../lib/processChain';
import type { ChainMaterialNode, ChainProcessNode } from '../lib/processChain';
import { phaseLabel, processIcon } from '../lib/icons';
import { formatNumber } from '../lib/format';

const ZOOM_MIN = 0.35;
const ZOOM_MAX = 1.4;
const ZOOM_STEP = 0.15;

export function ProcessChainPage() {
  const {
    buildingsInventory, materialsInventory, npcBuyers,
    processCatalogue, materialsCatalogue, processInputs, processOutputs,
    isProcessUnlocked, cataloguesLoaded, playerLoaded,
  } = useGame();

  const [includeNextStep, setIncludeNextStep] = useState(false);
  const [onlyResearched, setOnlyResearched] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mainRef = useRef<HTMLDivElement>(null);
  const lastShape = useRef<string>('');

  // proc_id -> how many buildings run it.
  const installed = useMemo(() => {
    const m = new Map<number, number>();
    buildingsInventory.forEach((b) => {
      if (!b.b_proc_installed) return;
      m.set(b.b_proc_installed, (m.get(b.b_proc_installed) ?? 0) + 1);
    });
    return m;
  }, [buildingsInventory]);

  const inventory = useMemo(() => {
    const m = new Map<number, number>();
    materialsInventory.forEach((r) => m.set(r.res_id, r.amount));
    return m;
  }, [materialsInventory]);

  const sellableResIds = useMemo(
    () => new Set(npcBuyers.map((n) => n.buy_res_id)),
    [npcBuyers],
  );

  const graph = useMemo(() => buildChainGraph({
    installed, processCatalogue, materialsCatalogue, processInputs, processOutputs,
    inventory, sellableResIds, isProcessUnlocked, includeNextStep, onlyResearched,
  }), [
    installed, processCatalogue, materialsCatalogue, processInputs, processOutputs,
    inventory, sellableResIds, isProcessUnlocked, includeNextStep, onlyResearched,
  ]);

  // Hover wins over selection so you can probe the map without losing your pin.
  const activeId = hoverId ?? selectedId;
  const trace = useMemo(
    () => (activeId && graph.byId.has(activeId) ? traceFlow(graph, activeId) : null),
    [graph, activeId],
  );

  const fitToWidth = useCallback(() => {
    const el = mainRef.current;
    if (!el || graph.width <= 0) return;
    const avail = el.clientWidth - 4;
    setZoom(Math.min(1, Math.max(ZOOM_MIN, Math.round((avail / graph.width) * 100) / 100)));
  }, [graph.width]);

  // Re-fit only when the layout actually changes shape — not on every data
  // refresh, which would otherwise stomp on a manual zoom.
  useEffect(() => {
    const shape = `${graph.nodes.length}:${graph.width}:${graph.height}`;
    if (shape === lastShape.current) return;
    lastShape.current = shape;
    fitToWidth();
  }, [graph, fitToWidth]);

  // Drop a stale selection when the node disappears from the graph.
  useEffect(() => {
    if (selectedId && !graph.byId.has(selectedId)) setSelectedId(null);
  }, [graph, selectedId]);

  const selected = selectedId ? graph.byId.get(selectedId) ?? null : null;

  if (!cataloguesLoaded || !playerLoaded) {
    return <div className="loading">Loading process chain…</div>;
  }

  const { stats } = graph;

  return (
    <div className="ui-page">
      <div className="ui-page-head">
        <h2>🕸️ Process Chain</h2>
        <span className="ui-sub">
          What your factory can make, from raw supply down to finished materials.
        </span>
      </div>

      {installed.size === 0 ? (
        <Card pad>
          <div className="ui-empty">
            No processes installed yet — install one on the{' '}
            <Link className="xlink" to="/factory">Factory</Link> tab and the chain will appear here.
          </div>
        </Card>
      ) : (
        <>
          <section className="ui-section">
            <div className="ui-grid ui-grid--tiles">
              <StatTile icon="🚰" label="Input streams" value={stats.sources}
                sub="processes making material from nothing" />
              <StatTile icon="⚙️" label="Installed processes" value={stats.processes}
                sub={stats.previewed > 0 ? `+${stats.previewed} one step away` : undefined} />
              <StatTile icon="🧪" label="Materials" value={stats.materials} />
              <StatTile icon="📥" label="Must be sourced" value={stats.external}
                tone={stats.external > 0 ? 'warning' : 'default'}
                sub="no installed process makes these" />
              <StatTile icon="🎯" label="End products" value={stats.terminal} tone="success"
                sub="nothing on the map consumes them" />
              <StatTile icon="♻️" label="Recycle links" value={stats.loops} />
            </div>
          </section>

          <div className="chain-toolbar">
            <label className="chain-switch">
              <input type="checkbox" checked={includeNextStep}
                onChange={(e) => setIncludeNextStep(e.target.checked)} />
              Show processes one step away
            </label>
            {includeNextStep && (
              <label className="chain-switch chain-switch--sub">
                <input type="checkbox" checked={onlyResearched}
                  onChange={(e) => setOnlyResearched(e.target.checked)} />
                researched only
              </label>
            )}
            <span className="spacer" />
            <div className="chain-zoom">
              <button className="ui-btn ui-btn--sm" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}>−</button>
              <span className="chain-zoom__value">{Math.round(zoom * 100)}%</span>
              <button className="ui-btn ui-btn--sm" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}>＋</button>
              <button className="ui-btn ui-btn--sm" onClick={fitToWidth}>Fit</button>
            </div>
          </div>

          <div className="chain-layout">
            <div className="chain-main" ref={mainRef}>
              <ChainGraph
                graph={graph}
                trace={trace}
                selectedId={selectedId}
                zoom={zoom}
                onSelect={setSelectedId}
                onHover={setHoverId}
              />
              <div className="chain-legend" style={{ marginTop: 'var(--sp-3)' }}>
                <span className="chain-legend__item"><span className="chain-legend__key chain-legend__key--extract" />extraction</span>
                <span className="chain-legend__item"><span className="chain-legend__key chain-legend__key--purchase" />bought in</span>
                <span className="chain-legend__item"><span className="chain-legend__key chain-legend__key--transform" />process</span>
                <span className="chain-legend__item"><span className="chain-legend__key chain-legend__key--external" />sourced externally</span>
                <span className="chain-legend__item"><span className="chain-legend__key chain-legend__key--terminal" />end product</span>
                <span className="chain-legend__item"><span className="chain-legend__line" />recycle / loop return</span>
                {includeNextStep && (
                  <span className="chain-legend__item"><span className="chain-legend__key chain-legend__key--ghost" />one step away</span>
                )}
              </div>
            </div>

            <aside className="chain-panel">
              <Card pad>
                {!selected ? (
                  <>
                    <div className="chain-panel__title">Nothing selected</div>
                    <p className="chain-panel__hint" style={{ marginTop: 'var(--sp-2)' }}>
                      Hover a node to light up everything up- and downstream of it. Click to pin
                      the selection and see its details here.
                    </p>
                    <p className="chain-panel__hint" style={{ marginTop: 'var(--sp-2)' }}>
                      Loops in the chemistry (lime slacking, the Leblanc soda cycle, Solvay
                      ammonia) are real. Return flows are drawn as dashed orange arrows, and a
                      material a process both consumes and regenerates shows as ♻ on the process
                      itself.
                    </p>
                  </>
                ) : selected.kind === 'process' ? (
                  <ProcessPanel node={selected} />
                ) : (
                  <MaterialPanel
                    node={selected}
                    graph={graph}
                    onPick={(id) => setSelectedId(id)}
                  />
                )}
              </Card>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

// ---- Detail panels ----------------------------------------------------------

function ProcessPanel({ node }: { node: ChainProcessNode }) {
  const { materialsCatalogue } = useGame();
  const recycled = node.recycles
    .map((r) => materialsCatalogue.get(r)?.res_name ?? `#${r}`)
    .join(', ');

  return (
    <>
      <div className="chain-panel__head">
        <span className="chain-panel__title">
          {processIcon(node.category)} {node.name}
        </span>
      </div>
      <div className="ui-cluster" style={{ marginTop: 'var(--sp-2)' }}>
        {node.ghost
          ? <Badge tone="primary">one step away</Badge>
          : <Badge tone="success" dot>installed ×{node.installCount}</Badge>}
        {node.locked && <Badge tone="warning">🔒 needs tech</Badge>}
        {node.role === 'extract' && <Badge tone="info">extraction</Badge>}
        {node.role === 'purchase' && <Badge tone="warning">bought in</Badge>}
      </div>

      <div className="chain-panel__group">
        <RecipeCard procId={node.procId} hideHeader />
      </div>

      {node.recycles.length > 0 && (
        <div className="chain-panel__group">
          <div className="chain-panel__label">♻ Recycled internally</div>
          <p className="chain-panel__hint">
            <strong>{recycled}</strong> is both consumed and regenerated here, so the net draw is
            smaller than the recipe suggests.
          </p>
        </div>
      )}

      <div className="chain-panel__group">
        <Link className="xchip" to={`/process-encyclopedia#proc-${node.procId}`}>
          📚 Open in Encyclopedia
        </Link>
      </div>
    </>
  );
}

function MaterialPanel({
  node, graph, onPick,
}: {
  node: ChainMaterialNode;
  graph: ReturnType<typeof buildChainGraph>;
  onPick: (id: string) => void;
}) {
  const producers = graph.edges
    .filter((e) => e.kind === 'produce' && e.to === node.id)
    .map((e) => graph.byId.get(e.from))
    .filter((n): n is ChainProcessNode => n?.kind === 'process');
  const consumers = graph.edges
    .filter((e) => e.kind === 'consume' && e.from === node.id)
    .map((e) => graph.byId.get(e.to))
    .filter((n): n is ChainProcessNode => n?.kind === 'process');

  const roleNote =
    node.role === 'external'
      ? 'Nothing on this map produces it — buy it on the market or from stock.'
      : node.role === 'terminal'
        ? 'Nothing on this map consumes it — sell it, or it just piles up.'
        : 'Produced and consumed inside your chain.';

  const procRow = (list: ChainProcessNode[], label: string) => (
    <div className="chain-panel__group">
      <div className="chain-panel__label">{label}</div>
      {list.length === 0 ? (
        <div className="chain-panel__hint">none on this map</div>
      ) : (
        <div className="chain-panel__list">
          {list.map((p) => (
            <button key={p.id} type="button" className="xchip" onClick={() => onPick(p.id)}>
              {processIcon(p.category)} {p.name}{p.ghost ? ' (+1)' : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="chain-panel__head">
        <MaterialChip name={node.name} color1={node.color1} color2={node.color2} />
      </div>
      <div className="ui-cluster" style={{ marginTop: 'var(--sp-2)' }}>
        <Badge>{phaseLabel(node.phase)}</Badge>
        <Badge tone={node.amount > 0 ? 'success' : 'neutral'}>stock {formatNumber(node.amount)}</Badge>
        {node.role === 'external' && <Badge tone="info">sourced externally</Badge>}
        {node.role === 'terminal' && <Badge tone="success">end product</Badge>}
        {node.sellable && <Badge tone="warning">💰 NPC buyer</Badge>}
      </div>
      <p className="chain-panel__hint" style={{ marginTop: 'var(--sp-2)' }}>{roleNote}</p>
      {procRow(producers, 'Produced by')}
      {procRow(consumers, 'Consumed by')}
    </>
  );
}
