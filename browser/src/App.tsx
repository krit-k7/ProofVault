import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildDemoTree, demoReserves, nextSlot } from './demo/demoTree';
import { usePorSession } from './hooks/usePorSession';
import { VERIFIER_MISMATCH_MESSAGE } from './contractStorage.js';
import { formatLovelace } from './por/PorBrowserClient';
import { PrivacyPanel } from './components/PrivacyPanel';
import { WalletBar } from './components/WalletBar';

function formatActionError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.trim()) return error.message;
    const cause =
      'cause' in error && error.cause !== undefined ? formatActionError(error.cause) : '';
    if (cause) return cause;
    const name = error.name !== 'Error' ? error.name : 'Error';
    return `${name} (no message) — open DevTools → Console for full details`;
  }
  if (typeof error === 'object' && error !== null) {
    const tagged = error as { _tag?: string; cause?: { message?: string; name?: string } };
    if (tagged._tag) {
      const inner = tagged.cause?.message ?? tagged.cause?.name;
      return inner ? `${tagged._tag}: ${inner}` : tagged._tag;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

export function App() {
  const session = usePorSession();
  const [insolvent, setInsolvent] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const demo = useMemo(() => buildDemoTree(insolvent), [insolvent]);
  const reserves = useMemo(
    () => demoReserves(demo.totalLiabilities, insolvent),
    [demo.totalLiabilities, insolvent],
  );

  const run = async (label: string, fn: () => Promise<void>) => {
    setActionError(null);
    try {
      await fn();
    } catch (error) {
      console.error(`[por-browser] ${label} failed`, error);
      setActionError(`${label}: ${formatActionError(error)}`);
    }
  };

  return (
    <div className="app">
      <div className="app-topnav">
        <Link to="/" className="app-topnav__back">
          ← Home
        </Link>
        <span className="app-topnav__label">Live eligibility app · Midnight Preprod</span>
      </div>

      <WalletBar
        phase={session.walletPhase}
        error={session.walletError}
        readiness={session.walletReadiness}
        networkId={session.walletReadiness?.networkId ?? import.meta.env.VITE_NETWORK_ID}
        contractAddress={session.contractAddress}
        busy={session.busy ?? (session.contractJoining ? 'Joining contract…' : null)}
        connectedWalletName={session.connectedWalletName}
        availableWallets={session.availableWallets}
        selectedWalletInstallId={session.selectedWalletInstallId}
        onSelectWallet={session.setSelectedWalletInstallId}
        onConnect={() => void run('connect', session.connect)}
        onDisconnect={() => void run('disconnect', session.disconnect)}
        onRefreshWallet={() => void run('refresh wallet', session.refreshWallet)}
      />

      {session.joinError ? (
        <p className="wallet-readiness-banner">
          {session.joinError}{' '}
          {session.joinError === VERIFIER_MISMATCH_MESSAGE ? (
            <button
              type="button"
              className="btn btn--ghost"
              disabled={!!session.busy}
              onClick={() => {
                session.forgetStoredContract();
                setActionError(null);
              }}
            >
              Clear stored contract
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--ghost"
              disabled={session.contractJoining || !session.providers}
              onClick={() => void run('rejoin', session.rejoinContract)}
            >
              Rejoin contract
            </button>
          )}
        </p>
      ) : null}

      {session.walletReadiness?.warning ? (
        <p className="wallet-readiness-banner">{session.walletReadiness.warning}</p>
      ) : null}

      {import.meta.env.VITE_PROOF_SERVER_URL ? (
        <p className="wallet-readiness-banner">
          Proving via local Docker proof server ({import.meta.env.VITE_PROOF_SERVER_URL}). Wallet
          still handles connect / balance / submit. Keep Docker running:{' '}
          <span className="mono">docker start midnight-proof-server</span>
        </p>
      ) : null}

      <ol className="app-quick-steps">
        <li>Connect wallet (Preprod)</li>
        <li>Deploy fresh contract</li>
        <li>Check eligibility</li>
        <li>Refresh ledger → privacy panel</li>
      </ol>

      <main className="layout" id="try-it">
        <section className="panel">
          <header>
            <h2>Eligibility sandbox</h2>
            <p>
              Prove a private liability total meets a public reserves threshold. Reserves are{' '}
              {insolvent ? 'set below' : 'set above'} liabilities so you can test eligible vs not
              eligible.
            </p>
          </header>
          <div className="scenario-stats">
            <div>
              <span className="label">Private total (witness)</span>
              <strong>{formatLovelace(demo.totalLiabilities)}</strong>
            </div>
            <div>
              <span className="label">Public threshold (reserves)</span>
              <strong>{formatLovelace(reserves)}</strong>
            </div>
            <div>
              <span className="label">Expected eligibility</span>
              <strong className={insolvent ? 'text-failed' : 'text-verified'}>
                {insolvent ? 'Not eligible' : 'Eligible'}
              </strong>
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={insolvent}
              onChange={(e) => setInsolvent(e.target.checked)}
            />
            Fail eligibility (reserves &lt; private total)
          </label>
          <div className="action-row">
            <button
              type="button"
              className="btn btn--primary"
              disabled={
                !session.providers ||
                !!session.busy ||
                session.contractJoining ||
                (session.walletReadiness !== null && !session.walletReadiness.ready)
              }
              onClick={() => void run('deploy', () => session.deploy(demo.witnessInputs))}
            >
              Deploy fresh contract
            </button>
            <button
              type="button"
              className="btn"
              disabled={
                !session.deployed ||
                !!session.busy ||
                session.contractJoining ||
                (session.walletReadiness !== null && !session.walletReadiness.ready)
              }
              onClick={() =>
                void run('prove', () =>
                  session.prove(reserves, nextSlot(session.ledger?.reservesSlot ?? null)),
                )
              }
            >
              Check eligibility (proveSolvency)
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={!session.contractAddress || !!session.busy}
              onClick={() => void run('refresh', session.refresh)}
            >
              Refresh ledger
            </button>
          </div>
          {actionError ? <p className="error-banner">{actionError}</p> : null}
          {session.lastTx ? (
            <p className="success-banner">
              Proof submitted — tx {session.lastTx.txId.slice(0, 16)}… (block{' '}
              {session.lastTx.blockHeight})
            </p>
          ) : null}
        </section>

        <PrivacyPanel
          totalLiabilities={demo.totalLiabilities}
          customerCount={demo.customerCount}
          ledger={session.ledger}
        />
      </main>

      <footer className="footer">
        <p>
          Observers learn pass/fail + reserves + commitment root — not the private liability total or
          per-customer balances.{' '}
          <Link to="/#privacy">Privacy model on home →</Link>
        </p>
      </footer>
    </div>
  );
}
