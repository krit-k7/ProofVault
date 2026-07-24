import type { WalletPhase } from '../hooks/usePorSession';
import type { DetectedWallet } from '../wallet/walletConnector';
import { formatDust, type WalletReadiness } from '../wallet/walletReadiness';

interface WalletBarProps {
  phase: WalletPhase;
  error: string | null;
  readiness: WalletReadiness | null;
  networkId: string;
  contractAddress: string | null;
  busy: string | null;
  connectedWalletName: string | null;
  availableWallets: DetectedWallet[];
  selectedWalletInstallId: string | null;
  onSelectWallet: (installId: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefreshWallet: () => void;
}

function trunc(addr: string): string {
  return addr.length <= 28 ? addr : `${addr.slice(0, 16)}…${addr.slice(-8)}`;
}

function walletLabel(wallet: DetectedWallet): string {
  const tag = wallet.compatible ? '' : ' (incompatible API)';
  return `${wallet.name}${tag}`;
}

export function WalletBar({
  phase,
  error,
  readiness,
  networkId,
  contractAddress,
  busy,
  connectedWalletName,
  availableWallets,
  selectedWalletInstallId,
  onSelectWallet,
  onConnect,
  onDisconnect,
  onRefreshWallet,
}: WalletBarProps) {
  const selectedWallet = availableWallets.find((w) => w.installId === selectedWalletInstallId);
  const canConnect =
    !!selectedWalletInstallId && (selectedWallet?.compatible ?? availableWallets.length > 0);

  return (
    <header className="wallet-bar">
      <div className="wallet-bar__brand">
        <span className="wallet-bar__kicker">Midnight · Level 3 · Eligibility Gate</span>
        <h1>Solvency Eligibility Gate</h1>
      </div>
      <div className="wallet-bar__status">
        <span className="pill">network: {networkId}</span>
        {connectedWalletName ? (
          <span className="pill pill--accent">wallet: {connectedWalletName}</span>
        ) : null}
        {readiness ? (
          <span className={`pill ${readiness.ready ? 'pill--accent' : 'pill--pending'}`}>
            DUST:{' '}
            {readiness.dustUnknown
              ? 'see wallet'
              : formatDust(readiness.dustBalance)}
            {readiness.ready ? ' ✓' : ' (API=0 — refresh)'}
          </span>
        ) : null}
        {contractAddress ? <span className="pill pill--accent">contract: {trunc(contractAddress)}</span> : null}
        {busy ? <span className="pill pill--pending">{busy}</span> : null}
      </div>
      <div className="wallet-bar__actions">
        {phase === 'connected' ? (
          <>
            <button type="button" className="btn btn--ghost" onClick={onRefreshWallet}>
              Refresh wallet
            </button>
            <button type="button" className="btn btn--ghost" onClick={onDisconnect}>
              Disconnect
            </button>
          </>
        ) : (
          <>
            <label className="wallet-select">
              <span className="wallet-select__label">Wallet</span>
              <select
                className="wallet-select__input"
                value={selectedWalletInstallId ?? ''}
                disabled={phase === 'connecting' || availableWallets.length === 0}
                onChange={(e) => onSelectWallet(e.target.value)}
              >
                {availableWallets.length === 0 ? (
                  <option value="">No wallet detected</option>
                ) : (
                  availableWallets.map((wallet) => (
                    <option key={wallet.installId} value={wallet.installId} disabled={!wallet.compatible}>
                      {walletLabel(wallet)} · API {wallet.apiVersion}
                    </option>
                  ))
                )}
              </select>
            </label>
            <button
              type="button"
              className="btn btn--primary"
              onClick={onConnect}
              disabled={phase === 'connecting' || !canConnect}
            >
              {phase === 'connecting' ? 'Connecting…' : 'Connect wallet'}
            </button>
          </>
        )}
        {phase === 'connecting' ? (
          <p className="wallet-bar__hint">
            {selectedWallet && selectedWallet.name.toLowerCase().includes('1am')
              ? 'Open the 1AM extension (puzzle icon → 1AM), unlock it, and approve the connection popup.'
              : 'Approve the connection in your wallet extension if a popup appears.'}
          </p>
        ) : null}
        {error ? <p className="wallet-bar__error">{error}</p> : null}
        {phase !== 'connected' && availableWallets.length === 0 ? (
          <p className="wallet-bar__hint">
            Install Lace or 1AM, enable Midnight on Preprod, then refresh this page.
          </p>
        ) : null}
      </div>
    </header>
  );
}
