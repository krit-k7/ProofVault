/// <reference types="vite/client" />

import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

interface MidnightWindow extends Window {
  midnight?: Record<string, InitialAPI | undefined>;
}

declare const window: MidnightWindow;

interface ImportMetaEnv {
  readonly VITE_NETWORK_ID: string;
  readonly VITE_DEFAULT_CONTRACT?: string;
  /** Local Docker proof server only (Lace). 1AM uses wallet → ProofStation; do not set for 1AM. */
  readonly VITE_PROOF_SERVER_URL?: string;
  readonly VITE_ZK_BUILD_ID?: string;
  /** Override ZK key host (CDN). Defaults to window.location.origin (Netlify URL). */
  readonly VITE_ZK_CONFIG_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
