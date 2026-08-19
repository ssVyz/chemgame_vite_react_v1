import { useEffect, useMemo, useState } from 'react';
import { gameClient } from '../api/gameClient';
import { useGame } from '../context/GameContext';
import { Card, Badge } from '../components/ui';
import { ClaimCard } from '../components/game/ClaimCard';
import { formatNumber } from '../lib/format';
import { claimStage, isPending, isAwaitingServer } from '../lib/claims';
import type { ActionStatus } from '../lib/status';

export function ClaimsPage() {
  const { player, playerClaims, claimsCatalogue, playerLoaded, refreshPlayer } = useGame();

  const [status, setStatus] = useState<ActionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const notify = (s: ActionStatus) => setStatus(s);

  // Stable order: newest last, so a claim never jumps around as its state changes.
  const claims = useMemo(
    () => [...playerClaims].sort((a, b) => a.this_claim_id - b.this_claim_id),
    [playerClaims],
  );

  const stages = useMemo(
    () => claims.map((c) => ({ claim: c, stage: claimStage(c, now) })),
    [claims, now],
  );

  const anyTimer = stages.some(({ stage }) => stage === 'surveying' || stage === 'running');

  // Tick only while something is actually counting down.
  useEffect(() => {
    if (!anyTimer) return;
    const iv = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(iv);
  }, [anyTimer]);

  const maxClaims = player?.max_claims ?? 0;
  const used = claims.length;
  const hasFreeSlot = used < maxClaims;
  const pending = claims.find(isPending);
  const awaiting = stages.filter(({ stage }) => isAwaitingServer(stage)).length;

  // Mirror find_claim()'s own preconditions so the button explains itself
  // instead of the player discovering the rule through an error toast.
  let blockedReason: string | null = null;
  if (!hasFreeSlot) blockedReason = `All ${maxClaims} claim slots are in use — release one first`;
  else if (pending) blockedReason = 'Finish deciding on your current claim before prospecting again';

  const handleFind = async () => {
    setBusy(true);
    const r = await gameClient.find_claim();
    setBusy(false);
    if (r.success) { notify({ type: 'success', message: 'Prospecting started' }); await refreshPlayer(); }
    else notify({ type: 'error', message: `Could not start a survey: ${r.error}` });
  };

  if (!playerLoaded && claims.length === 0) {
    return <div className="loading">Loading claims…</div>;
  }

  const owned = stages.filter(({ claim }) => claim.claim_bought);
  const prospects = stages.filter(({ claim }) => !claim.claim_bought);

  return (
    <div className="ui-page">
      <div className="ui-page-head">
        <h2>⛏️ Claims</h2>
        <span className="ui-sub">
          Prospect for mining sites, buy the ones worth working, and let them run on autorun.
        </span>
      </div>

      <div className="factory-toolbar">
        <button
          className="ui-btn ui-btn--primary"
          onClick={handleFind}
          disabled={busy || !!blockedReason}
          title={blockedReason ?? undefined}
        >
          🔍 Find new claim
        </button>
        <Badge tone={hasFreeSlot ? 'success' : 'warning'}>
          {used} / {maxClaims} slots
        </Badge>
        {claimsCatalogue.size === 0 && <Badge tone="danger">Claims catalogue empty</Badge>}
        <span className="spacer" />
        {player && <Badge>💰 {formatNumber(player.player_cash)}</Badge>}
      </div>

      {blockedReason && <div className="claims-hint">{blockedReason}.</div>}

      {/* The resolvers are service_role only and run on the 5-minute cron, so
          the client genuinely cannot advance these — say so rather than
          leaving the player clicking Refresh at a card that looks stuck. */}
      {awaiting > 0 && (
        <div className="claims-hint">
          ⏱ {awaiting === 1 ? 'One claim has' : `${awaiting} claims have`} finished and{' '}
          {awaiting === 1 ? 'is' : 'are'} waiting on the next server pass (runs every 5 minutes).
        </div>
      )}

      {status && (
        <div className={`status-message ${status.type}`} style={{ marginBottom: 'var(--sp-4)' }}>{status.message}</div>
      )}

      <section className="ui-section">
        <div className="ui-section-title">
          Prospects <span className="ui-count">{prospects.length}</span>
        </div>
        {prospects.length === 0 ? (
          <Card pad>
            <div className="ui-empty">
              Nothing being surveyed — click “🔍 Find new claim” to send out prospectors.
            </div>
          </Card>
        ) : (
          <div className="ui-grid ui-grid--wide">
            {prospects.map(({ claim }) => (
              <ClaimCard key={claim.this_claim_id} claim={claim} now={now}
                notify={notify} refresh={refreshPlayer} />
            ))}
          </div>
        )}
      </section>

      <section className="ui-section">
        <div className="ui-section-title">
          Your claims <span className="ui-count">{owned.length}</span>
        </div>
        {owned.length === 0 ? (
          <Card pad><div className="ui-empty">You do not own any claims yet.</div></Card>
        ) : (
          <div className="ui-grid ui-grid--wide">
            {owned.map(({ claim }) => (
              <ClaimCard key={claim.this_claim_id} claim={claim} now={now}
                notify={notify} refresh={refreshPlayer} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
