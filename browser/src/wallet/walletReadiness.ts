import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { isDustSponsoredWallet, type DetectedWallet } from './walletConnector';
import {
  collectErrorText,
  formatWalletBackgroundDeadError,
  isWalletBackgroundDeadError,
  isWalletRateLimitError,
} from './walletHealth';

/** Any strictly positive DUST is enough to attempt a Preprod fee payment. */
const MIN_DUST_FOR_TX = 1n;

/** How long a successful dust read stays "fresh" before we ask the wallet again. */
const DUST_CACHE_TTL_MS = 10 * 60_000;

export interface WalletReadiness {
  networkId: string | null;
  dustBalance: bigint;
  dustCap: bigint;
  /** True when we have no successful dust read yet (UI may still show a balance). */
  dustUnknown: boolean;
  ready: boolean;
  warning: string | null;
  /** Epoch ms of last successful getDustBalance (used to avoid rate-limit flicker). */
  dustFetchedAt?: number;
}

export interface LoadWalletReadinessOptions {
  /** Previous readiness — reused when connector rate-limits or fails transiently. */
  previous?: WalletReadiness | null;
  /** Skip getDustBalance if the cache is still fresh (default true for polls). */
  preferCachedDust?: boolean;
  /**
   * When true (1AM / dust-sponsored), skip getConnectionStatus entirely and only
   * refresh dust if the cache is stale. Prevents flooding the extension message bus.
   */
  dustSponsoredQuiet?: boolean;
}

/** Lace reports DUST in SPECK (1 DUST = 1e15 SPECK). */
export function formatDust(speck: bigint): string {
  if (speck === 0n) return '0';
  const whole = speck / 1_000_000_000_000_000n;
  const rem = speck % 1_000_000_000_000_000n;
  if (rem === 0n) return whole.toString();
  const frac = rem.toString().padStart(15, '0').replace(/0+$/, '').slice(0, 4);
  return frac ? `${whole}.${frac}` : whole.toString();
}

function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && value.trim() !== '') return BigInt(value);
  return 0n;
}

function isTransientDustError(message: string): boolean {
  return (
    isWalletBackgroundDeadError(message) ||
    isWalletRateLimitError(message) ||
    /request failed/i.test(message) ||
    /timeout/i.test(message)
  );
}

function cacheIsFresh(previous: WalletReadiness | null | undefined): boolean {
  if (!previous || previous.dustUnknown || previous.dustFetchedAt == null) return false;
  return Date.now() - previous.dustFetchedAt < DUST_CACHE_TTL_MS;
}

async function readNetworkId(api: ConnectedAPI): Promise<string | null> {
  try {
    if (typeof api.getConnectionStatus === 'function') {
      const status = await api.getConnectionStatus();
      if (status.status !== 'connected') return null;
      return status.networkId ?? null;
    }
  } catch (error) {
    console.warn('[por-browser] getConnectionStatus failed', error);
  }
  try {
    const config = await api.getConfiguration();
    return config.networkId ?? null;
  } catch {
    return null;
  }
}

function readinessFromCachedDust(
  networkId: string | null,
  previous: WalletReadiness,
  dustSponsored: boolean,
): WalletReadiness {
  const ready = dustSponsored || previous.dustBalance >= MIN_DUST_FOR_TX;
  return {
    networkId: networkId ?? previous.networkId,
    dustBalance: previous.dustBalance,
    dustCap: previous.dustCap,
    dustUnknown: false,
    ready,
    warning: null,
    dustFetchedAt: previous.dustFetchedAt,
  };
}

export async function loadWalletReadiness(
  api: ConnectedAPI,
  wallet?: Pick<DetectedWallet, 'name' | 'rdns' | 'installId'> | null,
  options?: LoadWalletReadinessOptions,
): Promise<WalletReadiness> {
  const dustSponsored = wallet ? isDustSponsoredWallet(wallet) : false;
  const previous = options?.previous ?? null;
  const preferCachedDust = options?.preferCachedDust ?? false;
  const quiet = options?.dustSponsoredQuiet ?? dustSponsored;

  // 1AM: fees are sponsored — never hammer getConnectionStatus on polls.
  if (quiet && preferCachedDust && previous) {
    if (cacheIsFresh(previous)) {
      return readinessFromCachedDust(previous.networkId, previous, dustSponsored);
    }
    // Stale cache: one getDustBalance only (no status call).
  }

  const networkId = quiet ? (previous?.networkId ?? null) : await readNetworkId(api);

  if (!quiet && networkId === null && typeof api.getConnectionStatus === 'function') {
    try {
      const status = await api.getConnectionStatus();
      if (status.status !== 'connected') {
        return {
          networkId: null,
          dustBalance: previous?.dustBalance ?? 0n,
          dustCap: previous?.dustCap ?? 0n,
          dustUnknown: previous ? previous.dustUnknown : true,
          ready: false,
          warning: `${wallet?.name ?? 'Wallet'} connection lost — reconnect the wallet.`,
          dustFetchedAt: previous?.dustFetchedAt,
        };
      }
    } catch {
      // Fall through — some wallets (1AM) can still submit after a flaky status call.
    }
  }

  if (typeof api.getDustBalance !== 'function') {
    return {
      networkId,
      dustBalance: 0n,
      dustCap: 0n,
      dustUnknown: true,
      ready: true,
      warning: dustSponsored
        ? '1AM does not expose DUST via this build — fees are sponsored. You can deploy and prove.'
        : 'This wallet build does not expose DUST balance. Fund and sync before deploying.',
    };
  }

  if (preferCachedDust && cacheIsFresh(previous)) {
    return readinessFromCachedDust(networkId, previous!, dustSponsored);
  }

  // Dust-sponsored + we already have any prior readiness: skip dust RPC on quiet polls.
  if (quiet && preferCachedDust && previous && !previous.dustUnknown) {
    return readinessFromCachedDust(networkId, previous, dustSponsored);
  }

  try {
    const dust = await api.getDustBalance();
    const balance = toBigInt(dust?.balance);
    const cap = toBigInt(dust?.cap);
    const ready = dustSponsored || balance >= MIN_DUST_FOR_TX;
    let warning: string | null = null;

    if (dustSponsored) {
      warning =
        balance === 0n
          ? '1AM sponsors fees via ProofStation — your DUST can stay 0. You can deploy and prove.'
          : null;
    } else if (balance === 0n) {
      warning =
        cap > 0n
          ? `Wallet reports DUST=0 to the DApp (cap=${formatDust(cap)}). If the wallet UI shows tDUST: disconnect, confirm Preprod + local proof server (http://localhost:6300), reconnect, then Refresh wallet.`
          : 'DUST balance is 0. In your wallet: Generate tDUST after funding tNIGHT, wait for accrual, then Refresh wallet.';
    }

    return {
      networkId,
      dustBalance: balance,
      dustCap: cap,
      dustUnknown: false,
      ready,
      warning,
      dustFetchedAt: Date.now(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (previous && !previous.dustUnknown && isTransientDustError(message)) {
      if (!isWalletRateLimitError(message)) {
        console.warn('[por-browser] getDustBalance transient failure; keeping cached balance', message);
      }
      return readinessFromCachedDust(networkId, previous, dustSponsored);
    }

    console.warn('[por-browser] getDustBalance failed', error);

    if (dustSponsored) {
      return {
        networkId,
        dustBalance: previous?.dustBalance ?? 0n,
        dustCap: previous?.dustCap ?? 0n,
        dustUnknown: previous?.dustUnknown ?? true,
        ready: true,
        warning:
          previous && !previous.dustUnknown
            ? null
            : isWalletRateLimitError(message)
              ? '1AM rate-limited the DUST balance call — using wallet UI balance. Fees are sponsored; you can deploy and prove.'
              : `Could not read DUST via connector (${message}). 1AM wallet UI is authoritative — ProofStation sponsors fees. You can deploy and prove.`,
        dustFetchedAt: previous?.dustFetchedAt,
      };
    }

    const dustSyncIssue = /unreachable|deserialize|sync/i.test(message);
    return {
      networkId,
      dustBalance: previous?.dustBalance ?? 0n,
      dustCap: previous?.dustCap ?? 0n,
      dustUnknown: previous?.dustUnknown ?? true,
      ready: false,
      warning: dustSyncIssue
        ? 'Lace DUST sync looks broken on this wallet (known preprod bug). Update Lace, or create a fresh preprod wallet and let it fully sync.'
        : `Could not read DUST balance: ${message}`,
      dustFetchedAt: previous?.dustFetchedAt,
    };
  }
}

export function describeLaceTxError(error: unknown, step: 'balance' | 'submit' | 'prove' | 'deploy'): Error {
  const hay = collectErrorText(error);
  const customCode = hay.match(/Custom error:\s*(\d+)/i)?.[1];
  if (customCode === '182') {
    return new Error(
      step === 'deploy'
        ? 'Preprod rejected the deploy (error 182 — transaction intent expired or was reused). ' +
            'Click Deploy again and approve in 1AM immediately when the popup opens. ' +
            'Close other 1AM tabs, check your system clock, then Disconnect → Connect if it persists.'
        : 'Preprod rejected the transaction (error 182 — intent expired or duplicate). ' +
            'Retry and approve in the wallet right away; avoid double-clicking Submit.',
    );
  }
  if (customCode === '170') {
    return new Error(
      'Preprod rejected the fee/DUST proof (error 170). Reload 1AM, wait ~30s, Disconnect → Connect, then retry. ' +
        'Fees are sponsored on 1AM — this is usually a stale wallet session, not low DUST.',
    );
  }
  if (customCode === '174' || customCode === '233' || customCode === '234') {
    return new Error(
      'Contract deploy was malformed on-chain (error ' +
        customCode +
        '). Hard-refresh this page (Cmd+Shift+R), run `pnpm --filter @por/por-browser build:zk`, restart dev, then Deploy fresh.',
    );
  }
  if (customCode === '101') {
    return new Error(
      'A contract already exists at this address (error 101). Deploy fresh generates a new address — retry once; if it repeats, Disconnect → Connect.',
    );
  }
  if (/active in another window/i.test(hay)) {
    return new Error(
      '1AM is locked to another browser tab/window. Close every other tab using 1AM ' +
        '(especially https://por-browser.netlify.app), leave only http://localhost:5175 open, ' +
        'then Disconnect → Connect here and prove again.',
    );
  }
  if (/mismatched verifier keys|verifier key mismatch|undefined or have mismatched/i.test(hay)) {
    return new Error(
      'This contract was deployed with different ZK keys than the current app. Deploy fresh contract — Rejoin will not work.',
    );
  }
  if (/bit bound failed|is not 8-bit|Proof server check failed/i.test(hay)) {
    return new Error(
      'ZK key mismatch — the proof server rejected witness data (often stale cached keys from the old N=64 circuit). ' +
        'Hard-refresh this page (Cmd+Shift+R), Disconnect → Connect in 1AM, Deploy fresh, then prove again. ' +
        'If it persists: chrome://extensions → Reload 1AM.',
    );
  }
  if (/duplicate request|similar request is already pending/i.test(hay)) {
    return new Error(
      step === 'deploy'
        ? '1AM still has a pending wallet request (often after a hard refresh while joining or proving). ' +
            'Wait ~10s and click Deploy again, or Disconnect → Connect. ' +
            'Avoid clicking Deploy while “Joining contract…” is showing.'
        : '1AM still has a pending wallet request. Wait ~10s and retry, or Disconnect → Connect.',
    );
  }
  if (isWalletBackgroundDeadError(hay) || isWalletRateLimitError(hay)) {
    if (isWalletRateLimitError(hay)) {
      return new Error(
        '1AM wallet is rate-limiting requests. Wait ~30s, chrome://extensions → Reload 1AM, ' +
          'then Disconnect → Connect and try again. Avoid leaving this tab open for long before proving.',
      );
    }
    return formatWalletBackgroundDeadError(step);
  }
  if (/payload too large|too deeply nested/i.test(hay)) {
    return new Error(
      'ZK prover key could not pass through the wallet Chrome extension bridge. ' +
        'Unlock the wallet, keep the popup open, chrome://extensions → Reload extension, Disconnect → Connect, then retry. ' +
        'If it still fails, set VITE_PROOF_SERVER_URL=http://localhost:6300 and use the local Docker proof server.',
    );
  }
  if (/Failed to fetch|NetworkError|Load failed|body too large|413/i.test(hay)) {
    return new Error(
      'Proof server rejected the prove request (network or upload size limit). ' +
        'Try VITE_PROOF_SERVER_URL=http://localhost:6300 with Docker, or retry after wallet reload.',
    );
  }
  if (/request timed out|timed out/i.test(hay)) {
    return new Error(
      step === 'prove'
        ? 'Prove request timed out (wallet or proof server). N=8 demo usually finishes in 1–3 min — ' +
            'retry with only this tab connected, wallet unlocked, and Docker proof server running if configured. ' +
            'If it keeps failing, check docker logs midnight-proof-server.'
        : 'Request timed out — unlock the wallet, wait ~30s, Disconnect → Connect, then retry.',
    );
  }
  if (error instanceof Error) {
    if (/unreachable/i.test(error.message) || error.name === 'RuntimeError') {
      return new Error(
        step === 'balance'
          ? 'Lace crashed while paying fees (DUST). This is a known preprod wallet bug. Update Lace to the latest version, use a fresh preprod wallet, fund tNIGHT, and wait until DUST is fully synced before retrying.'
          : 'Lace crashed while submitting the transaction. Update Lace or try a fresh preprod wallet.',
      );
    }
    if (error.message.trim()) return error;
  }
  if (typeof error === 'object' && error !== null) {
    const tagged = error as { _tag?: string; cause?: { message?: string } };
    if (tagged.cause?.message) return new Error(tagged.cause.message);
  }
  return new Error(`${step} failed — see browser console for details`);
}
