// Placeholder iconography (emoji) — swappable for real art later without
// touching call sites. Buildings/processes have no icon columns in the DB yet,
// so the mapping lives here client-side (see frontend_design_options.md D6).

// Building emoji keyed by building_code (from buildings_catalogue).
const BUILDING_ICONS: Record<string, string> = {
  B_SHED: '🛖',
  B_WELL: '⛲',
  B_FIELD: '🌾',
  B_RETORT: '⚗️',
  B_LOGI1: '📦',
  B_ROAST: '♨️',
  B_CHEM_FAC: '🧪',
  B_FURNACE: '🔥',
  B_FOUNDRY: '🏭',
  B_GLASSW: '🫙',
  B_DIST_SMALL: '🥃',
  B_MILL: '🧵',
  B_TOWER: '🗼',
  B_GRAVEL: '🪨',
  B_ORE_PROC: '⛏️',
  B_MTL_SHAPE: '🛠️',
  B_WATERTREAT: '🚰',
  B_ELECTRLYS: '⚡',
};

export function buildingIcon(code: string | null | undefined): string {
  if (!code) return '🏭';
  return BUILDING_ICONS[code] ?? '🏭';
}

// Process emoji keyed by proc_category (from process_catalogue).
const PROCESS_CATEGORY_ICONS: Record<string, string> = {
  general: '⚙️',
  logistics: '🚚',
  alkali: '🧼',
  acid: '🧪',
  metallurgy: '⚒️',
  manufacturing: '🏗️',
  coal_chemistry: '🪨',
  ammonia: '💨',
};

export function processIcon(category: string | null | undefined): string {
  if (!category) return '⚙️';
  return PROCESS_CATEGORY_ICONS[category] ?? '⚙️';
}

// Material phase → identity (icon, css var suffix, label).
export type PhaseKey = 'solid' | 'fluid' | 'gas';

export function phaseKey(phase: string | null | undefined): PhaseKey {
  const p = (phase ?? '').toLowerCase();
  if (p === 'fluid' || p === 'liquid') return 'fluid';
  if (p === 'gas') return 'gas';
  return 'solid';
}

export function phaseIcon(phase: string | null | undefined): string {
  switch (phaseKey(phase)) {
    case 'fluid': return '💧';
    case 'gas': return '💨';
    default: return '🧱';
  }
}

export function phaseLabel(phase: string | null | undefined): string {
  switch (phaseKey(phase)) {
    case 'fluid': return 'Fluid';
    case 'gas': return 'Gas';
    default: return 'Solid';
  }
}

/** Which storage pool a phase consumes: solid→dry, fluid→fluid, gas→gas. */
export function phaseStoragePool(phase: string | null | undefined): 'dry' | 'fluid' | 'gas' {
  const k = phaseKey(phase);
  return k === 'solid' ? 'dry' : k;
}
