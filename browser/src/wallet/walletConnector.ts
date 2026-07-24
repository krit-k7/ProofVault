import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import semver from 'semver';
import { catchError, concatMap, filter, firstValueFrom, interval, map, take, throwError, timeout } from 'rxjs';
import { pipe as fnPipe } from 'fp-ts/function';

export const WALLET_INSTALL_STORAGE_KEY = 'por-browser-wallet-install';
const COMPATIBLE_CONNECTOR_API_VERSION = '4.x';

/** Prefer env network, then 1AM's documented default (`preview`), then preprod. */
const NETWORK_FALLBACKS = ['preview', 'preprod'] as const;

export interface DetectedWallet {
  installId: string;
  name: string;
  rdns: string;
  apiVersion: string;
  compatible: boolean;
}

function isInitialAPI(wallet: unknown): wallet is InitialAPI {
  return (
    !!wallet &&
    typeof wallet === 'object' &&
    'apiVersion' in wallet &&
    'connect' in wallet &&
    typeof (wallet as InitialAPI).connect === 'function'
  );
}

export function listDetectedWallets(): DetectedWallet[] {
  if (!window.midnight) return [];
  return Object.entries(window.midnight)
    .filter((entry): entry is [string, InitialAPI] => isInitialAPI(entry[1]))
    .map(([installId, wallet]) => ({
      installId,
      name: wallet.name?.trim() || installId,
      rdns: wallet.rdns ?? '',
      apiVersion: wallet.apiVersion,
      compatible: semver.satisfies(wallet.apiVersion, COMPATIBLE_CONNECTOR_API_VERSION),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getStoredWalletInstallId(): string | null {
  return localStorage.getItem(WALLET_INSTALL_STORAGE_KEY);
}

export function storeWalletInstallId(installId: string): void {
  localStorage.setItem(WALLET_INSTALL_STORAGE_KEY, installId);
}

/** Pick a sensible default: stored choice, else first compatible wallet. */
export function defaultWalletInstallId(wallets: DetectedWallet[]): string | null {
  const stored = getStoredWalletInstallId();
  if (stored && wallets.some((w) => w.compatible && w.installId === stored)) return stored;
  return wallets.find((w) => w.compatible)?.installId ?? wallets[0]?.installId ?? null;
}

function getWalletByInstallId(installId: string): InitialAPI | undefined {
  const wallet = window.midnight?.[installId];
  return isInitialAPI(wallet) ? wallet : undefined;
}

function normalizeNetworkId(raw: string | undefined): string {
  return (raw ?? 'preprod').trim().toLowerCase();
}

export function isDustSponsoredWallet(wallet: Pick<DetectedWallet, 'name' | 'rdns' | 'installId'>): boolean {
  const hay = `${wallet.name} ${wallet.rdns} ${wallet.installId}`.toLowerCase();
  return hay.includes('1am') || hay.includes('oneam');
}

function extractWalletNetwork(errorMsg: string): string | null {
  const match = errorMsg.match(/[Ww]allet is on[,:\s]+(\S+)/);
  if (match) return match[1].replace(/[,."']+$/, '');
  const match2 = errorMsg.match(/network(?:Id)?:\s*(\S+)/i);
  if (match2) return match2[1].replace(/[,."']+$/, '');
  return null;
}

import { isWalletBackgroundDeadError } from './walletHealth';
function networksToTry(preferred: string, dustSponsored: boolean): string[] {
  const ordered = dustSponsored
    ? [preferred, ...NETWORK_FALLBACKS]
    : [preferred];
  return [...new Set(ordered.map((n) => n.trim().toLowerCase()).filter(Boolean))];
}

function authorizationTimeoutMessage(wallet: DetectedWallet): string {
  if (isDustSponsoredWallet(wallet)) {
    return (
      '1AM did not respond to connect() — no approval popup appeared. ' +
      'This usually means the 1AM background script is asleep or crashed ' +
      '(console: "No response from background script"). Fix: ' +
      '(1) click the 1AM extension icon to wake it and unlock, ' +
      '(2) open chrome://extensions → 1AM → Reload, ' +
      '(3) hard-refresh this page, then Connect again. ' +
      '1AM docs default to network "preview"; set VITE_NETWORK_ID=preview if your wallet is on Preview.'
    );
  }
  return (
    `${wallet.name} did not authorize the connection within 90 seconds. ` +
    'Open the wallet extension, unlock it, approve the connection popup, then try again.'
  );
}

function describeConnectError(error: unknown, networkId: string, wallet: DetectedWallet): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (isWalletBackgroundDeadError(message)) {
    return new Error(
      '1AM extension background script is not responding. ' +
        'Click the 1AM icon (unlock if needed) → chrome://extensions → Reload 1AM → refresh this page → Connect again.',
    );
  }
  if (/network\s*id\s*mismatch|network\s*mismatch/i.test(message)) {
    return new Error(
      `${wallet.name} rejected the connection: network mismatch. The DApp requested "${networkId}". ` +
        (isDustSponsoredWallet(wallet)
          ? 'In 1AM, switch network to match, or set VITE_NETWORK_ID=preview (1AM default) / preprod.'
          : 'In the wallet, open Settings → Midnight → Configure Midnight Nodes, select Preprod, and save, then reconnect.'),
    );
  }
  return error instanceof Error ? error : new Error('Wallet connection failed');
}

async function authorizeWallet(initialAPI: InitialAPI, networkId: string): Promise<ConnectedAPI> {
  const api = await initialAPI.connect(networkId);
  if (typeof api.hintUsage === 'function') {
    try {
      await api.hintUsage([
        'balanceUnsealedTransaction',
        'submitTransaction',
        'getProvingProvider',
        'getDustBalance',
        'getConfiguration',
      ]);
    } catch (hintError) {
      console.warn('[por-browser] hintUsage failed (non-fatal)', hintError);
    }
  }
  return api;
}

/** Per-network connect attempt with a short race timeout (ZKMint / 1AM pattern). */
async function tryConnectNetwork(
  initialAPI: InitialAPI,
  networkId: string,
  timeoutMs: number,
): Promise<ConnectedAPI> {
  console.info(`[por-browser] trying connect(${networkId})…`);
  return Promise.race([
    authorizeWallet(initialAPI, networkId),
    new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              `Timed out waiting for wallet approval on "${networkId}" (${timeoutMs / 1000}s).`,
            ),
          ),
        timeoutMs,
      );
    }),
  ]);
}

async function connectWithNetworkFallback(
  initialAPI: InitialAPI,
  preferredNetwork: string,
  wallet: DetectedWallet,
): Promise<{ api: ConnectedAPI; networkId: string }> {
  const dustSponsored = isDustSponsoredWallet(wallet);
  const candidates = networksToTry(preferredNetwork, dustSponsored);
  // 1AM content→background can hang silently; fail each attempt faster so we can guide the user.
  const perAttemptMs = dustSponsored ? 20_000 : 90_000;
  let lastError: unknown;

  for (const networkId of candidates) {
    try {
      const api = await tryConnectNetwork(initialAPI, networkId, perAttemptMs);
      return { api, networkId };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[por-browser] connect(${networkId}) failed:`, message);

      if (isWalletBackgroundDeadError(message)) {
        throw describeConnectError(error, networkId, wallet);
      }

      const revealed = extractWalletNetwork(message);
      if (revealed && !candidates.includes(revealed.toLowerCase())) {
        try {
          const api = await tryConnectNetwork(initialAPI, revealed, perAttemptMs);
          return { api, networkId: revealed };
        } catch (retryError) {
          lastError = retryError;
        }
      }
    }
  }

  throw describeConnectError(lastError, preferredNetwork, wallet);
}

export async function connectToWallet(
  installId: string,
  rawNetworkId: string,
): Promise<{ api: ConnectedAPI; walletName: string; networkId: string }> {
  const networkId = normalizeNetworkId(rawNetworkId);
  const detected =
    listDetectedWallets().find((w) => w.installId === installId) ??
    ({
      installId,
      name: installId,
      rdns: '',
      apiVersion: '?',
      compatible: true,
    } satisfies DetectedWallet);
  const walletName = detected.name;

  console.info(
    `[por-browser] connecting to ${walletName} (prefer ${networkId})… ` +
      (isDustSponsoredWallet(detected)
        ? 'open/unlock 1AM first — approval may not appear if the background script is dead'
        : 'approve in the wallet extension if prompted'),
  );

  return firstValueFrom(
    fnPipe(
      interval(100),
      map(() => getWalletByInstallId(installId)),
      filter((api): api is InitialAPI => !!api),
      take(1),
      timeout({
        first: 5_000,
        with: () =>
          throwError(
            () =>
              new Error(
                `Wallet "${walletName}" not found. Install the extension, enable Midnight, and refresh this page.`,
              ),
          ),
      }),
      concatMap(async (initialAPI) => {
        if (!semver.satisfies(initialAPI.apiVersion, COMPATIBLE_CONNECTOR_API_VERSION)) {
          throw new Error(
            `${walletName} reports API ${initialAPI.apiVersion}; this DApp needs connector API 4.x.`,
          );
        }
        const { api, networkId: connectedNetwork } = await connectWithNetworkFallback(
          initialAPI,
          networkId,
          detected,
        );
        storeWalletInstallId(installId);
        console.info(`[por-browser] connected to ${walletName} on ${connectedNetwork}`);
        return { api, walletName, networkId: connectedNetwork };
      }),
      timeout({
        first: 100_000,
        with: () => throwError(() => new Error(authorizationTimeoutMessage(detected))),
      }),
      catchError((error) => throwError(() => describeConnectError(error, networkId, detected))),
    ),
  );
}

export async function disconnectWallet(_api: ConnectedAPI): Promise<void> {
  // Connector API has no disconnect(); clearing local session state is enough.
}
