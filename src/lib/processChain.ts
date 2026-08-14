// =============================================================================
// Process-chain graph: turns the factory's installed processes into a layered
// bipartite flow graph (materials <-> processes) laid out top-down.
//
// The chemistry graph is NOT a tree - it contains genuine recycle loops (lime
// slacking <-> causticization <-> lime kiln, the Leblanc soda loop, ammonia in
// Solvay, sand in water purification). Those are handled in two ways:
//
//   1. Self-recycle (a material that is both input and output of the SAME
//      process) never becomes an edge; it is recorded on the process node and
//      drawn as a small badge.
//   2. Longer loops are broken by a DFS that marks the closing edge as a
//      "feedback" edge. Feedback edges are excluded from layering (so every
//      forward edge points downwards) and drawn as dashed return arrows.
//
// Everything here is pure - no React, no network. Fed entirely from data the
// GameContext already holds.
// =============================================================================

import type {
  ProcessCatalogue,
  MaterialCatalogue,
  ProcessInput,
  ProcessOutput,
} from '../types';

// ---- Layout constants -------------------------------------------------------

const MAT_H = 48;
const PROC_H = 54;
const NODE_GAP_X = 18;
const ROW_GAP_Y = 62;
const CANVAS_PAD = 24;

const MAT_MIN_W = 132;
const MAT_MAX_W = 250;
const PROC_MIN_W = 150;
const PROC_MAX_W = 268;

/** Rough advance width per character; node widths are then set explicitly so
 *  the estimate becomes exact by construction (long labels get ellipsised). */
const CHAR_W = 6.7;

// ---- Types ------------------------------------------------------------------

/** How a material enters or leaves the displayed chain. */
export type MaterialRole =
  | 'external'      // consumed here, produced by nothing shown -> must be bought/stocked
  | 'intermediate'  // produced and consumed inside the chain
  | 'terminal';     // produced here, consumed by nothing shown -> end product or waste

/** Where a process sits in the supply story. */
export type ProcessRole =
  | 'extract'    // no inputs, wins material from the world (dig, well, collect)
  | 'purchase'   // no inputs, buys material for cash
  | 'transform'; // has inputs

interface NodeBase {
  id: string;
  layer: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** True when the node only exists because of the "+1 step" preview. */
  ghost: boolean;
}

export interface ChainProcessNode extends NodeBase {
  kind: 'process';
  procId: number;
  name: string;
  category: string;
  role: ProcessRole;
  /** How many buildings currently run this process (0 for previewed ones). */
  installCount: number;
  /** Tech requirement not yet researched. */
  locked: boolean;
  /** res_ids that are both consumed and produced by this process. */
  recycles: number[];
}

export interface ChainMaterialNode extends NodeBase {
  kind: 'material';
  resId: number;
  name: string;
  phase: string;
  color1: string | null;
  color2: string | null;
  role: MaterialRole;
  /** Current player stock. */
  amount: number;
  /** An NPC buyer purchases this material. */
  sellable: boolean;
}

export type ChainNode = ChainProcessNode | ChainMaterialNode;

export interface ChainEdge {
  id: string;
  from: string;
  to: string;
  kind: 'consume' | 'produce';
  amount: number;
  /** Loop-closing edge: points back upwards, drawn as a dashed return arrow. */
  feedback: boolean;
  ghost: boolean;
}

export interface ChainStats {
  sources: number;
  processes: number;
  previewed: number;
  materials: number;
  external: number;
  terminal: number;
  loops: number;
}

export interface ChainGraph {
  nodes: ChainNode[];
  edges: ChainEdge[];
  byId: Map<string, ChainNode>;
  /** Nodes grouped by layer, in left-to-right draw order. */
  layers: ChainNode[][];
  width: number;
  height: number;
  stats: ChainStats;
}

export interface BuildChainInput {
  /** proc_id -> number of buildings running it. */
  installed: Map<number, number>;
  processCatalogue: Map<number, ProcessCatalogue>;
  materialsCatalogue: Map<number, MaterialCatalogue>;
  processInputs: Map<number, ProcessInput[]>;
  processOutputs: Map<number, ProcessOutput[]>;
  /** res_id -> stock on hand. */
  inventory: Map<number, number>;
  /** res_ids some NPC buys. */
  sellableResIds: Set<number>;
  isProcessUnlocked: (procId: number) => boolean;
  /** Also show processes that become runnable with the materials on screen. */
  includeNextStep: boolean;
  /** When previewing, drop processes whose tech is not researched yet. */
  onlyResearched: boolean;
}

// ---- Helpers ----------------------------------------------------------------

const matId = (resId: number) => `m${resId}`;
const procNodeId = (procId: number) => `p${procId}`;

function estimateWidth(text: string, base: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, base + text.length * CHAR_W)));
}

/**
 * Zero-input processes come in two economically different flavours: digging it
 * out of the ground (free) and buying it (cash). The DB has no column for that,
 * so classify on the naming/category convention used by the catalogue.
 */
function sourceRole(proc: ProcessCatalogue): ProcessRole {
  if (/^buy\b/i.test(proc.proc_name) || proc.proc_category === 'logistics') return 'purchase';
  return 'extract';
}

// ---- Graph construction -----------------------------------------------------

export function buildChainGraph(input: BuildChainInput): ChainGraph {
  const {
    installed, processCatalogue, materialsCatalogue, processInputs, processOutputs,
    inventory, sellableResIds, isProcessUnlocked, includeNextStep, onlyResearched,
  } = input;

  const inputsOf = (procId: number) => processInputs.get(procId) ?? [];
  const outputsOf = (procId: number) => processOutputs.get(procId) ?? [];

  // --- 1. Which processes are on screen -------------------------------------
  const installedIds = Array.from(installed.keys())
    .filter((id) => processCatalogue.has(id))
    .sort((a, b) => a - b);

  // Every material the installed chain already touches. A process is "one step
  // away" when all of its inputs are drawn from this pool.
  const reachable = new Set<number>();
  installedIds.forEach((id) => {
    inputsOf(id).forEach((r) => reachable.add(r.res_id));
    outputsOf(id).forEach((r) => reachable.add(r.res_id));
  });

  const candidateIds: number[] = [];
  if (includeNextStep) {
    processCatalogue.forEach((_proc, procId) => {
      if (installed.has(procId)) return;
      if (onlyResearched && !isProcessUnlocked(procId)) return;
      const ins = inputsOf(procId);
      // Pure supply processes (buy/dig) are not "reached" from your materials -
      // they are independent supply options, so they stay out of the preview.
      if (ins.length === 0) return;
      if (!ins.every((r) => reachable.has(r.res_id))) return;
      candidateIds.push(procId);
    });
    candidateIds.sort((a, b) => a - b);
  }

  const procIds = [...installedIds, ...candidateIds];

  // --- 2. Nodes --------------------------------------------------------------
  const nodes: ChainNode[] = [];
  const byId = new Map<string, ChainNode>();
  const add = (n: ChainNode) => { nodes.push(n); byId.set(n.id, n); };

  const procNodes: ChainProcessNode[] = [];
  procIds.forEach((procId) => {
    const proc = processCatalogue.get(procId);
    if (!proc) return;
    const ins = inputsOf(procId);
    const outs = outputsOf(procId);
    const inRes = new Set(ins.map((r) => r.res_id));
    const recycles = outs.filter((r) => inRes.has(r.res_id)).map((r) => r.res_id);
    const node: ChainProcessNode = {
      kind: 'process',
      id: procNodeId(procId),
      procId,
      name: proc.proc_name,
      category: proc.proc_category,
      role: ins.length === 0 ? sourceRole(proc) : 'transform',
      installCount: installed.get(procId) ?? 0,
      locked: !isProcessUnlocked(procId),
      recycles,
      ghost: !installed.has(procId),
      layer: 0,
      x: 0, y: 0,
      w: estimateWidth(proc.proc_name, 34, PROC_MIN_W, PROC_MAX_W),
      h: PROC_H,
    };
    procNodes.push(node);
    add(node);
  });

  // Materials touched by any drawn process.
  const resIds = new Set<number>();
  procIds.forEach((procId) => {
    inputsOf(procId).forEach((r) => resIds.add(r.res_id));
    outputsOf(procId).forEach((r) => resIds.add(r.res_id));
  });

  // --- 3. Edges (self-recycles are folded into the process node) -------------
  const edges: ChainEdge[] = [];
  procNodes.forEach((pn) => {
    const recycled = new Set(pn.recycles);
    inputsOf(pn.procId).forEach((r) => {
      edges.push({
        id: `c${pn.procId}-${r.res_id}`,
        from: matId(r.res_id),
        to: pn.id,
        kind: 'consume',
        amount: r.amount,
        feedback: false,
        ghost: pn.ghost,
      });
    });
    outputsOf(pn.procId).forEach((r) => {
      if (recycled.has(r.res_id)) return; // shown as a badge on the node instead
      edges.push({
        id: `o${pn.procId}-${r.res_id}`,
        from: pn.id,
        to: matId(r.res_id),
        kind: 'produce',
        amount: r.amount,
        feedback: false,
        ghost: pn.ghost,
      });
    });
  });

  // --- 4. Material roles -----------------------------------------------------
  const producedBy = new Map<number, number[]>();
  const consumedBy = new Map<number, number[]>();
  procIds.forEach((procId) => {
    outputsOf(procId).forEach((r) => {
      const a = producedBy.get(r.res_id); if (a) a.push(procId); else producedBy.set(r.res_id, [procId]);
    });
    inputsOf(procId).forEach((r) => {
      const a = consumedBy.get(r.res_id); if (a) a.push(procId); else consumedBy.set(r.res_id, [procId]);
    });
  });

  Array.from(resIds).sort((a, b) => a - b).forEach((resId) => {
    const mat = materialsCatalogue.get(resId);
    const name = mat?.res_name ?? `#${resId}`;
    const producers = producedBy.get(resId) ?? [];
    const consumers = consumedBy.get(resId) ?? [];
    // A material produced only by ghost processes is itself a preview node.
    const realProducer = producers.some((id) => installed.has(id));
    const realConsumer = consumers.some((id) => installed.has(id));
    let role: MaterialRole;
    if (producers.length === 0) role = 'external';
    else if (consumers.length === 0) role = 'terminal';
    else role = 'intermediate';
    add({
      kind: 'material',
      id: matId(resId),
      resId,
      name,
      phase: mat?.res_phase ?? 'solid',
      color1: mat?.res_color1 ?? null,
      color2: mat?.res_color2 ?? null,
      role,
      amount: inventory.get(resId) ?? 0,
      sellable: sellableResIds.has(resId),
      ghost: !realProducer && !realConsumer,
      layer: 0,
      x: 0, y: 0,
      w: estimateWidth(name, 46, MAT_MIN_W, MAT_MAX_W),
      h: MAT_H,
    });
  });

  // Drop edges whose endpoints are missing (defensive: catalogue gaps).
  const liveEdges = edges.filter((e) => byId.has(e.from) && byId.has(e.to));

  // --- 5. Break cycles -------------------------------------------------------
  const out = new Map<string, ChainEdge[]>();
  nodes.forEach((n) => out.set(n.id, []));
  liveEdges.forEach((e) => out.get(e.from)!.push(e));

  // Deterministic DFS: start from the true sources (zero-input processes), then
  // externally supplied materials, then anything left over.
  const roots: string[] = [
    ...procNodes.filter((p) => p.role !== 'transform').map((p) => p.id),
    ...nodes.filter((n) => n.kind === 'material' && n.role === 'external').map((n) => n.id),
    ...nodes.map((n) => n.id),
  ];

  const state = new Map<string, 0 | 1 | 2>(); // 0/undefined = unseen, 1 = on stack, 2 = done
  const walk = (start: string) => {
    // Iterative DFS so deep chains can never blow the stack.
    const stack: { id: string; i: number }[] = [{ id: start, i: 0 }];
    state.set(start, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const list = out.get(top.id)!;
      if (top.i >= list.length) {
        state.set(top.id, 2);
        stack.pop();
        continue;
      }
      const edge = list[top.i++];
      const s = state.get(edge.to);
      if (s === 1) edge.feedback = true;   // closes a loop
      else if (s !== 2) {
        state.set(edge.to, 1);
        stack.push({ id: edge.to, i: 0 });
      }
    }
  };
  roots.forEach((id) => { if (!state.get(id)) walk(id); });

  const forward = liveEdges.filter((e) => !e.feedback);

  // --- 6. Layer assignment (longest path on the acyclic remainder) ----------
  // Processes land on even layers, materials on odd ones: sources start at 0,
  // externally supplied materials at 1, and every forward edge adds exactly 1.
  const indeg = new Map<string, number>();
  const fwdOut = new Map<string, ChainEdge[]>();
  nodes.forEach((n) => { indeg.set(n.id, 0); fwdOut.set(n.id, []); });
  forward.forEach((e) => {
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
    fwdOut.get(e.from)!.push(e);
  });

  const layerOf = new Map<string, number>();
  const queue: string[] = [];
  nodes.forEach((n) => {
    if ((indeg.get(n.id) ?? 0) === 0) {
      layerOf.set(n.id, n.kind === 'process' ? 0 : 1);
      queue.push(n.id);
    }
  });

  const pending = new Map(indeg);
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    const l = layerOf.get(id) ?? 0;
    fwdOut.get(id)!.forEach((e) => {
      layerOf.set(e.to, Math.max(layerOf.get(e.to) ?? 0, l + 1));
      const left = (pending.get(e.to) ?? 1) - 1;
      pending.set(e.to, left);
      if (left === 0) queue.push(e.to);
    });
  }
  // Anything the topological pass could not reach (shouldn't happen once cycles
  // are broken) still needs a sane home.
  nodes.forEach((n) => {
    if (!layerOf.has(n.id)) layerOf.set(n.id, n.kind === 'process' ? 0 : 1);
  });
  nodes.forEach((n) => { n.layer = layerOf.get(n.id)!; });

  // --- 7. Order within layers (barycentre sweeps to cut edge crossings) -----
  const maxLayer = nodes.reduce((m, n) => Math.max(m, n.layer), 0);
  const layers: ChainNode[][] = Array.from({ length: maxLayer + 1 }, () => []);
  nodes.forEach((n) => layers[n.layer].push(n));
  layers.forEach((row) => row.sort((a, b) => a.id.localeCompare(b.id)));

  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  nodes.forEach((n) => { preds.set(n.id, []); succs.set(n.id, []); });
  forward.forEach((e) => { preds.get(e.to)!.push(e.from); succs.get(e.from)!.push(e.to); });

  const indexIn = new Map<string, number>();
  const reindex = () => {
    layers.forEach((row) => row.forEach((n, i) => indexIn.set(n.id, i)));
  };
  reindex();

  const sweep = (rows: ChainNode[][], neighbours: Map<string, string[]>) => {
    rows.forEach((row) => {
      const bary = new Map<string, number>();
      row.forEach((n, i) => {
        const ns = neighbours.get(n.id)!;
        const idxs = ns.map((id) => indexIn.get(id)).filter((v): v is number => v != null);
        bary.set(n.id, idxs.length ? idxs.reduce((a, b) => a + b, 0) / idxs.length : i);
      });
      row.sort((a, b) => (bary.get(a.id)! - bary.get(b.id)!) || a.id.localeCompare(b.id));
      row.forEach((n, i) => indexIn.set(n.id, i));
    });
  };

  for (let pass = 0; pass < 4; pass++) {
    sweep(layers.slice(1), preds);                       // top-down
    sweep(layers.slice(0, -1).reverse(), succs);          // bottom-up
  }
  reindex();

  // --- 8. Coordinates --------------------------------------------------------
  const rowWidths = layers.map((row) =>
    row.reduce((sum, n, i) => sum + n.w + (i ? NODE_GAP_X : 0), 0));
  const contentW = Math.max(320, ...rowWidths);

  let y = CANVAS_PAD;
  layers.forEach((row, li) => {
    if (row.length === 0) return; // e.g. no source processes installed
    const rowH = row.reduce((m, n) => Math.max(m, n.h), 0);
    let x = CANVAS_PAD + (contentW - rowWidths[li]) / 2;
    row.forEach((n) => {
      n.x = Math.round(x);
      n.y = Math.round(y + (rowH - n.h) / 2);
      x += n.w + NODE_GAP_X;
    });
    y += rowH + ROW_GAP_Y;
  });

  const width = contentW + CANVAS_PAD * 2;
  const height = Math.max(0, y - ROW_GAP_Y) + CANVAS_PAD;

  // --- 9. Stats --------------------------------------------------------------
  const materialNodes = nodes.filter((n): n is ChainMaterialNode => n.kind === 'material');
  const stats: ChainStats = {
    sources: procNodes.filter((p) => p.role !== 'transform' && !p.ghost).length,
    processes: procNodes.filter((p) => !p.ghost).length,
    previewed: procNodes.filter((p) => p.ghost).length,
    materials: materialNodes.length,
    external: materialNodes.filter((m) => m.role === 'external').length,
    terminal: materialNodes.filter((m) => m.role === 'terminal').length,
    loops: liveEdges.filter((e) => e.feedback).length
      + procNodes.reduce((s, p) => s + p.recycles.length, 0),
  };

  return { nodes, edges: liveEdges, byId, layers, width, height, stats };
}

// ---- Flow tracing (hover / selection highlight) ------------------------------

export interface FlowTrace {
  nodes: Set<string>;
  edges: Set<string>;
}

/**
 * Everything upstream and downstream of `nodeId`, following edges in both
 * directions from the seed. Feedback edges are traversed too, so a recycle loop
 * lights up as the loop it really is.
 */
export function traceFlow(graph: ChainGraph, nodeId: string): FlowTrace {
  const outgoing = new Map<string, ChainEdge[]>();
  const incoming = new Map<string, ChainEdge[]>();
  graph.nodes.forEach((n) => { outgoing.set(n.id, []); incoming.set(n.id, []); });
  graph.edges.forEach((e) => {
    outgoing.get(e.from)?.push(e);
    incoming.get(e.to)?.push(e);
  });

  const nodes = new Set<string>([nodeId]);
  const edges = new Set<string>();

  const bfs = (adj: Map<string, ChainEdge[]>, step: (e: ChainEdge) => string) => {
    const seen = new Set<string>([nodeId]);
    const queue = [nodeId];
    while (queue.length) {
      const cur = queue.shift()!;
      (adj.get(cur) ?? []).forEach((e) => {
        edges.add(e.id);
        const next = step(e);
        nodes.add(next);
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      });
    }
  };

  bfs(outgoing, (e) => e.to);
  bfs(incoming, (e) => e.from);
  return { nodes, edges };
}
