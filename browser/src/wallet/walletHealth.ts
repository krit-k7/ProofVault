import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

const BACKGROUND_DEAD_RE =
  /no response from background|receiving end does not exist|extension context invalidated|could not establish connection|is the extension loaded/i;

const RATE_LIMIT_RE = /rate\s*limit|too many (pending )?wallet requests|slow down/i;

const DUPLICATE_REQUEST_RE =
  /duplicate request|similar request is already pending|request is already pending/i;

export function isWalletBackgroundDeadError(message: string): boolean {
  return BACKGROUND_DEAD_RE.test(message);
}

export function isWalletRateLimitError(message: string): boolean {
  return RATE_LIMIT_RE.test(message);
}

export function isDuplicateWalletRequestError(message: string): boolean {
  return DUPLICATE_REQUEST_RE.test(message);
}

export function collectErrorText(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause != null ? collectErrorText(error.cause) : '';
    return `${error.message} ${cause}`.trim();
  }
  return String(error);
}

export function formatWalletBackgroundDeadError(step: 'balance' | 'submit' | 'prove' | 'deploy'): Error {
  const action =
    step === 'prove'
      ? 'When the proof finishes, approve any balance/submit prompts in 1AM.'
      : 'Approve the transaction prompt in 1AM when it appears.';
  return new Error(
    '1AM wallet background script is not responding. ' +
      'Click the 1AM icon and unlock, chrome://extensions → Reload 1AM, then Disconnect → Connect here. ' +
      action,
  );
}

/** Single lightweight RPC — prefer getConfiguration (one call) over status+config. */
export async function pokeWallet(api: ConnectedAPI): Promise<void> {
  await api.getConfiguration();
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withWalletRetry<T>(
  api: ConnectedAPI,
  label: string,
  fn: () => Promise<T>,
  maxAttempts = 4,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Only poke on retries — avoid doubling traffic on the happy path.
      if (attempt > 1) await pokeWallet(api);
      return await fn();
    } catch (error) {
      lastError = error;
      const hay = collectErrorText(error);
      const retryable =
        isWalletBackgroundDeadError(hay) ||
        isWalletRateLimitError(hay) ||
        isDuplicateWalletRequestError(hay);
      if (attempt < maxAttempts && retryable) {
        const delayMs = isDuplicateWalletRequestError(hay) ? 4000 * attempt : 2000 * attempt;
        console.warn(
          `[por-browser] ${label}: wallet busy (${isDuplicateWalletRequestError(hay) ? 'duplicate request' : 'unresponsive'}), retry ${attempt}/${maxAttempts} in ${delayMs}ms`,
        );
        await sleep(delayMs);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * Keep MV3 service worker awake during long proves — sparse pings only.
 * Default 45s; never stack overlapping pokes.
 */
export function startWalletKeepalive(api: ConnectedAPI, intervalMs = 45_000): () => void {
  let inFlight = false;
  const id = window.setInterval(() => {
    if (inFlight) return;
    inFlight = true;
    void pokeWallet(api)
      .catch((err) => {
        console.warn('[por-browser] wallet keepalive ping failed', err);
      })
      .finally(() => {
        inFlight = false;
      });
  }, intervalMs);
  return () => window.clearInterval(id);
}
