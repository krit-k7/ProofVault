import { collectErrorText } from './wallet/walletHealth.js';

const STORAGE_KEY = 'por-browser-contract-v3';
const LEGACY_KEYS = ['por-browser-contract-v2-n8', 'por-browser-contract'];

export interface StoredContract {
  address: string;
  zkBuildId: string;
}

export function currentZkBuildId(): string {
  return import.meta.env.VITE_ZK_BUILD_ID?.trim() ?? '';
}

function clearLegacyStorage(): void {
  for (const key of LEGACY_KEYS) {
    localStorage.removeItem(key);
  }
}

/** Drop stale plain-address entries from before zk-build tracking. */
export function migrateContractStorage(): string | null {
  clearLegacyStorage();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredContract;
    if (!parsed?.address) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const cur = currentZkBuildId();
    if (cur && parsed.zkBuildId && parsed.zkBuildId !== cur) {
      localStorage.removeItem(STORAGE_KEY);
      return 'Stored contract was deployed with an older circuit build. Deploy fresh contract.';
    }
    return null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return 'Stored contract format was outdated. Deploy fresh contract.';
  }
}

export function loadStoredContract(): StoredContract | null {
  const envDefault = import.meta.env.VITE_DEFAULT_CONTRACT?.trim();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return envDefault ? { address: envDefault, zkBuildId: '' } : null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredContract;
    if (!parsed?.address) return null;
    const cur = currentZkBuildId();
    if (cur && parsed.zkBuildId && parsed.zkBuildId !== cur) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredContract(address: string): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ address, zkBuildId: currentZkBuildId() } satisfies StoredContract),
  );
}

export function clearStoredContract(): void {
  localStorage.removeItem(STORAGE_KEY);
  clearLegacyStorage();
}

export function isVerifierKeyMismatchError(error: unknown): boolean {
  const hay = collectErrorText(error);
  return /mismatched verifier keys|verifier key mismatch|undefined or have mismatched/i.test(hay);
}

export const VERIFIER_MISMATCH_MESSAGE =
  'This contract was deployed with different ZK keys than the current app (e.g. after a site update or an old N=64 contract). Click Deploy fresh contract — Rejoin will not work.';
