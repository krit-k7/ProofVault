import { fromHex, toHex } from '@midnight-ntwrk/compact-runtime';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { Binding, CostModel, type FinalizedTransaction, Proof, SignatureEnabled, Transaction, type TransactionId } from '@midnight-ntwrk/ledger-v8';
import { dappConnectorProofProvider } from '@midnight-ntwrk/midnight-js-dapp-connector-proof-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { type NetworkId, setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { MidnightProviders, ProofProvider, UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import { inMemoryPrivateStateProvider, type PorPrivateState } from '../in-memory-private-state-provider';
import { createZkFetch } from '../zkFetch.js';
import { describeLaceTxError } from '../wallet/walletReadiness';
import { withWalletRetry } from '../wallet/walletHealth';

export type PorCircuitKeys = 'proveSolvency';
export type PorProviders = MidnightProviders<PorCircuitKeys, 'porState', PorPrivateState>;

/**
 * N=8 browser demo circuit: proveSolvency.prover is ~18MB (vs ~146MB for production N=64).
 * ProofStation may accept this size via 1AM getProvingProvider; local Docker is still the
 * most reliable path (set VITE_PROOF_SERVER_URL=http://localhost:6300).
 */
async function buildProofProvider(
  connectedAPI: ConnectedAPI,
  zkConfigProvider: FetchZkConfigProvider<PorCircuitKeys>,
): Promise<ProofProvider> {
  const localProofServer = import.meta.env.VITE_PROOF_SERVER_URL?.trim();

  if (localProofServer) {
    console.info(`[por-browser] proving via local proof server: ${localProofServer}`);
    return httpClientProofProvider(localProofServer, zkConfigProvider, { timeout: 600_000 });
  }

  // Documented 1AM path — wallet owns the ProofStation session (auth + dust sponsorship).
  if (typeof connectedAPI.getProvingProvider === 'function') {
    console.info('[por-browser] proving via 1AM getProvingProvider → ProofStation');
    return dappConnectorProofProvider(connectedAPI, zkConfigProvider, CostModel.initialCostModel());
  }

  throw new Error(
    'This wallet cannot prove transactions. Use 1AM, or set VITE_PROOF_SERVER_URL to a local Docker proof server (http://localhost:6300) for Lace.',
  );
}

export async function buildBrowserProviders(
  connectedAPI: ConnectedAPI,
  /** Network confirmed by connect() — preferred over env when 1AM auto-matched. */
  connectedNetworkId?: string,
): Promise<PorProviders> {
  const config = await connectedAPI.getConfiguration();
  const envNetwork = (import.meta.env.VITE_NETWORK_ID ?? 'preprod').trim().toLowerCase();
  const walletNetwork = (config.networkId ?? connectedNetworkId ?? envNetwork).trim().toLowerCase();
  const expectedNetwork = (connectedNetworkId ?? envNetwork).trim().toLowerCase();

  if (walletNetwork !== expectedNetwork) {
    throw new Error(
      `Network mismatch after connect: wallet is on "${config.networkId}" but the DApp expects "${expectedNetwork}". ` +
        'Either switch the wallet network, or set VITE_NETWORK_ID in packages/por-browser/.env to match.',
    );
  }

  setNetworkId(walletNetwork as NetworkId);

  const shieldedAddresses = await connectedAPI.getShieldedAddresses();
  const zkBase =
    import.meta.env.VITE_ZK_CONFIG_BASE_URL?.trim().replace(/\/$/, '') || window.location.origin;
  const zkFetch = createZkFetch(fetch.bind(window));
  const zkConfigProvider = new FetchZkConfigProvider<PorCircuitKeys>(zkBase, zkFetch);
  console.info(
    `[por-browser] ZK config base: ${zkBase}` +
      (import.meta.env.VITE_ZK_BUILD_ID ? ` (build ${import.meta.env.VITE_ZK_BUILD_ID})` : ''),
  );
  if (config.proverServerUri) {
    console.info(
      `[por-browser] wallet ProofStation URI: ${config.proverServerUri} (used by wallet, not browser POST)`,
    );
  }
  const proofProvider = await buildProofProvider(connectedAPI, zkConfigProvider);

  return {
    privateStateProvider: inMemoryPrivateStateProvider<'porState', PorPrivateState>(),
    zkConfigProvider,
    proofProvider,
    publicDataProvider: indexerPublicDataProvider(
      config.indexerUri,
      config.indexerWsUri,
      globalThis.WebSocket as never,
    ),
    walletProvider: {
      getCoinPublicKey: () => shieldedAddresses.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shieldedAddresses.shieldedEncryptionPublicKey,
      balanceTx: async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
        try {
          const received = await withWalletRetry(connectedAPI, 'balanceTx', () =>
            connectedAPI.balanceUnsealedTransaction(toHex(tx.serialize()), {
              payFees: true,
            }),
          );
          return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
            'signature',
            'proof',
            'binding',
            fromHex(received.tx),
          );
        } catch (error) {
          throw describeLaceTxError(error, 'balance');
        }
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        try {
          await withWalletRetry(connectedAPI, 'submitTx', () =>
            connectedAPI.submitTransaction(toHex(tx.serialize())),
          );
          return tx.identifiers()[0];
        } catch (error) {
          throw describeLaceTxError(error, 'submit');
        }
      },
    },
  };
}
