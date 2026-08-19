import { useState } from 'react';
import { gameClient } from '../../api/gameClient';
import { useGame } from '../../context/GameContext';
import type { PlayerClaim } from '../../types';
import { Card, Badge, MaterialChip } from '../ui';
import { formatNumber, formatMinutes, formatSeconds } from '../../lib/format';
import { claimStage, canDelete, isAwaitingServer, STAGE_META, rarityMeta } from '../../lib/claims';
import type { ActionStatus } from '../../lib/status';

interface Props {
  claim: PlayerClaim;
  /** Shared clock from the page, so every card ticks together. */
  now: number;
  notify: (s: ActionStatus) => void;
  refresh: () => Promise<void>;
}

export function ClaimCard({ claim, now, notify, refresh }: Props) {
  const { claimsCatalogue, claimOutputsCatalogue, claimOutputs, materialsCatalogue } = useGame();
  const [busy, setBusy] = useState(false);

  const cat = claimsCatalogue.get(claim.claim_id);
  const stage = claimStage(claim, now);
  const meta = STAGE_META[stage];
  const rarity = rarityMeta(cat?.claim_rarity);

  // Before purchase the deposit is only a catalogue promise; afterwards the
  // player's own rows are the truth, because they are what gets drawn down.
  const template = claimOutputsCatalogue.get(claim.claim_id) ?? [];
  const owned = claimOutputs.get(claim.this_claim_id) ?? [];

  const remainingTotal = owned.reduce((sum, o) => sum + o.amount_remaining, 0);
  const startTotal = template.reduce((sum, o) => sum + o.start_amount, 0);
  const depleted = claim.claim_bought && owned.length > 0 && remainingTotal === 0;

  // One shape for both sources so the chip list does not have to care which.
  const rows = claim.claim_bought
    ? owned.map((o) => ({ matId: o.mat_id, amount: o.amount_remaining }))
    : template.map((t) => ({ matId: t.mat_id, amount: t.start_amount }));

  const timer =
    claim.finishes_at && (stage === 'surveying' || stage === 'running')
      ? formatSeconds(Math.round((new Date(claim.finishes_at).getTime() - now) / 1000))
      : null;

  const name = cat?.claim_name ?? `Claim ${claim.claim_id}`;

  const act = async (
    fn: () => Promise<{ success: boolean; error?: string }>,
    ok: string,
    failPrefix: string,
  ) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (r.success) { notify({ type: 'success', message: ok }); await refresh(); }
    else notify({ type: 'error', message: `${failPrefix}: ${r.error}` });
  };

  const handleBuy = () => {
    if (!cat) return;
    if (!window.confirm(
      `Buy "${name}" for ${formatNumber(cat.claim_price)} cash?\n\n` +
      `Each mining cycle then costs ${formatNumber(cat.exploit_cost)} and takes ${formatMinutes(cat.cycle_duration)}.`,
    )) return;
    act(() => gameClient.buy_claim(claim.this_claim_id), `Bought ${name}`, 'Purchase failed');
  };

  const handleDelete = () => {
    const warning = claim.claim_bought
      ? `Abandon "${name}"?\n\nThe remaining deposit is lost and there is no refund. This frees a claim slot.`
      : `Discard "${name}"?\n\nYou will not be able to buy it later. This frees a claim slot.`;
    if (!window.confirm(warning)) return;
    act(() => gameClient.delete_claim(claim.this_claim_id),
      claim.claim_bought ? `Abandoned ${name}` : `Discarded ${name}`, 'Delete failed');
  };

  const handleAutorun = () => {
    if (claim.autorun) {
      act(() => gameClient.deactivate_claim_autorun(claim.this_claim_id), 'Autorun disabled', 'Failed');
    } else {
      act(() => gameClient.activate_claim_autorun(claim.this_claim_id), 'Autorun enabled', 'Failed');
    }
  };

  return (
    <Card pad hover>
      <div className="claimcard">
        <div className="claimcard__head">
          <span className="claimcard__title">
            <span className="ui-icon ui-icon--md">{rarity.icon}</span>
            <strong>{stage === 'surveying' || stage === 'survey_done' ? 'Unknown site' : name}</strong>
            <span className="claimcard__id">#{claim.this_claim_id}</span>
          </span>
          <Badge tone={meta.tone} dot>{meta.label}</Badge>
        </div>

        {/* A hidden claim must not leak what was rolled — the card stays blank
            until the server reveals it. */}
        {stage === 'surveying' && (
          <>
            <div className="claimcard__timer">⏳ {timer}</div>
            <div className="claimcard__empty">Prospectors are still surveying this site.</div>
          </>
        )}

        {isAwaitingServer(stage) && (
          <div className="claimcard__waiting">
            {stage === 'survey_done'
              ? '⏱ Survey complete — the site is revealed on the next server pass.'
              : '⏱ Cycle complete — the yield is banked on the next server pass.'}
          </div>
        )}

        {stage !== 'surveying' && stage !== 'survey_done' && (
          <>
            <div className="ui-cluster">
              <Badge tone={rarity.tone}>{rarity.label}</Badge>
              {cat && !claim.claim_bought && <Badge>💰 {formatNumber(cat.claim_price)}</Badge>}
              {cat && <Badge>⚙️ {formatNumber(cat.exploit_cost)}/cycle</Badge>}
              {cat && <Badge>⏱ {formatMinutes(cat.cycle_duration)}</Badge>}
              {claim.claim_bought && claim.autorun && <Badge tone="primary" dot>Autorun</Badge>}
              {depleted && <Badge tone="danger">Depleted</Badge>}
            </div>

            {timer && stage === 'running' && <div className="claimcard__timer">⏳ {timer}</div>}

            {/* Deposit: the catalogue template while deciding, the player's own
                remaining amounts once owned. */}
            <div className="claimcard__deposit">
              <div className="claimcard__deposit-label">
                {claim.claim_bought
                  ? `Deposit remaining${startTotal > 0 ? ` — ${formatNumber(remainingTotal)} of ${formatNumber(startTotal)}` : ''}`
                  : 'Deposit'}
              </div>
              <div className="ui-cluster">
                {rows.map(({ matId, amount }) => {
                  const mat = materialsCatalogue.get(matId);
                  const perCycle = template.find((t) => t.mat_id === matId)?.yield_per_cycle;
                  return (
                    <MaterialChip
                      key={matId}
                      name={mat?.res_name ?? `#${matId}`}
                      color1={mat?.res_color1}
                      color2={mat?.res_color2}
                      amount={amount}
                      title={perCycle != null
                        ? `${mat?.res_name ?? matId} — ${formatNumber(amount)} left, ${formatNumber(perCycle)} per cycle`
                        : undefined}
                    />
                  );
                })}
                {rows.length === 0 && (
                  <span className="claimcard__empty">No output data for this claim.</span>
                )}
              </div>
            </div>

            <div className="claimcard__actions">
              {stage === 'revealed' && (
                <button className="ui-btn ui-btn--primary ui-btn--sm" onClick={handleBuy} disabled={busy}>
                  💰 Buy for {formatNumber(cat?.claim_price ?? 0)}
                </button>
              )}
              {claim.claim_bought && (
                <button className="ui-btn ui-btn--sm" onClick={handleAutorun} disabled={busy}>
                  {claim.autorun ? '⏹ Autorun off' : '🔄 Autorun on'}
                </button>
              )}
              <button
                className="ui-btn ui-btn--danger ui-btn--sm"
                onClick={handleDelete}
                disabled={busy || !canDelete(stage)}
                title={canDelete(stage) ? undefined : 'A claim can only be released while idle, never mid-survey or mid-cycle'}
              >
                {claim.claim_bought ? '🗑 Abandon' : '✖ Discard'}
              </button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
