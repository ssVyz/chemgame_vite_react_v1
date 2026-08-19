// Claim lifecycle helpers.
//
// `finishes_at` on player_claims_inventory is multifunctional: it is the survey
// deadline before a claim is bought and the mining-cycle deadline afterwards.
// Reading it without first checking claim_bought / claim_idle is always a bug,
// so nothing outside this file should look at the raw flags — call claimStage()
// and switch on the result instead.

import type { PlayerClaim } from '../types';
import type { BadgeTone } from '../components/ui';

export type ClaimStage =
  | 'surveying'    // prospecting, timer still running
  | 'survey_done'  // timer elapsed, waiting for the server to reveal it
  | 'revealed'     // found and priced, player decides whether to buy
  | 'idle'         // owned, not mining
  | 'running'      // mining, timer still running
  | 'cycle_done';  // timer elapsed, waiting for the server to bank the yield

export function claimStage(claim: PlayerClaim, now: number = Date.now()): ClaimStage {
  const elapsed = claim.finishes_at != null && new Date(claim.finishes_at).getTime() <= now;

  if (!claim.claim_bought) {
    if (claim.claim_visible) return 'revealed';
    return elapsed ? 'survey_done' : 'surveying';
  }
  if (claim.claim_idle) return 'idle';
  return elapsed ? 'cycle_done' : 'running';
}

/**
 * The two "_done" stages are waiting on the cron job, not on the player. The
 * resolvers are service_role only, so the client cannot hurry them along —
 * the UI has to say so rather than looking stuck.
 */
export function isAwaitingServer(stage: ClaimStage): boolean {
  return stage === 'survey_done' || stage === 'cycle_done';
}

/** A claim that blocks a new survey: found or bought, but not yet decided on. */
export function isPending(claim: PlayerClaim): boolean {
  return !claim.claim_visible || !claim.claim_bought;
}

/** Mirrors delete_claim(): revealed-but-unbought, or bought-and-idle. */
export function canDelete(stage: ClaimStage): boolean {
  return stage === 'revealed' || stage === 'idle';
}

export const STAGE_META: Record<ClaimStage, { label: string; tone: BadgeTone }> = {
  surveying:   { label: 'Surveying',   tone: 'warning' },
  survey_done: { label: 'Ready',       tone: 'info' },
  revealed:    { label: 'Unclaimed',   tone: 'primary' },
  idle:        { label: 'Idle',        tone: 'success' },
  running:     { label: 'Mining',      tone: 'info' },
  cycle_done:  { label: 'Cycle ended', tone: 'info' },
};

export const RARITY_META: Record<number, { label: string; tone: BadgeTone; icon: string }> = {
  1: { label: 'Common', tone: 'neutral', icon: '🪨' },
  2: { label: 'Rare',   tone: 'info',    icon: '💎' },
  3: { label: 'Epic',   tone: 'primary', icon: '🌟' },
};

export function rarityMeta(rarity: number | undefined) {
  return RARITY_META[rarity ?? 1] ?? RARITY_META[1];
}
