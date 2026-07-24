import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { PorProviders } from '../providers/buildBrowserProviders';
import { buildBrowserProviders } from '../providers/buildBrowserProviders';
import {
  deployPorContract,
  joinPorContractWithTimeout,
  readPorState,
  submitPorProofWithRetry,
  type DeployResult,
  type SolvencyState,
  type SubmitProofResult,
} from '../por/PorBrowserClient';
import type { WitnessInputs } from '../browser-circuit/witnesses.js';
import { buildDemoTree } from '../demo/demoTree';
import { useDetectedWallets } from './useDetectedWallets';
import {
  connectToWallet,
  disconnectWallet,
  getStoredWalletInstallId,
  isDustSponsoredWallet,
  storeWalletInstallId,
} from '../wallet/walletConnector';
import { loadWalletReadiness, type WalletReadiness } from '../wallet/walletReadiness';
import { startWalletKeepalive } from '../wallet/walletHealth';
import {
  clearStoredContract,
  isVerifierKeyMismatchError,
  loadStoredContract,
  migrateContractStorage,
  saveStoredContract,
  VERIFIER_MISMATCH_MESSAGE,
} from '../contractStorage.js';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Lace can tolerate more frequent polls; 1AM rate-limits hard — poll rarely or not at all. */
const LACE_DUST_POLL_MS = 60_000;
/** 1AM: fees sponsored — only refresh dust on connect / manual Refresh (no interval). */
const ONE_AM_DUST_POLL_MS = 0;

/** Contract storage v3 — includes ZK build id so we never rejoin after key/circuit changes. */
const INITIAL_STORAGE_NOTICE = migrateContractStorage();

export type WalletPhase = 'idle' | 'connecting' | 'connected' | 'error';

export interface PorSession {
  walletPhase: WalletPhase;
  walletError: string | null;
  walletReadiness: WalletReadiness | null;
  connectedWalletName: string | null;
  selectedWalletInstallId: string | null;
  availableWallets: ReturnType<typeof useDetectedWallets>['wallets'];
  setSelectedWalletInstallId: (installId: string) => void;
  connectedAPI: ConnectedAPI | null;
  providers: PorProviders | null;
  contractAddress: string | null;
  deployed: DeployResult['deployed'] | null;
  ledger: SolvencyState | null;
  busy: string | null;
  contractJoining: boolean;
  joinError: string | null;
  lastTx: SubmitProofResult | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  deploy: (witnessInputs: WitnessInputs) => Promise<void>;
  join: (address: string, witnessInputs: WitnessInputs) => Promise<void>;
  rejoinContract: () => Promise<void>;
  prove: (reserves: bigint, slot: bigint) => Promise<void>;
  refresh: () => Promise<void>;
  forgetStoredContract: () => void;
}

export function usePorSession(): PorSession {
  const [walletPhase, setWalletPhase] = useState<WalletPhase>('idle');
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletReadiness, setWalletReadiness] = useState<WalletReadiness | null>(null);
  const readinessRef = useRef<WalletReadiness | null>(null);
  const [connectedWalletName, setConnectedWalletName] = useState<string | null>(null);
  const [selectedWalletInstallId, setSelectedWalletInstallIdState] = useState<string | null>(
    () => getStoredWalletInstallId(),
  );
  const { wallets: availableWallets, selectedInstallId: resolvedWalletInstallId } =
    useDetectedWallets(selectedWalletInstallId);
  const [connectedAPI, setConnectedAPI] = useState<ConnectedAPI | null>(null);
  const [providers, setProviders] = useState<PorProviders | null>(null);
  const [contractAddress, setContractAddress] = useState<string | null>(
    () => loadStoredContract()?.address ?? null,
  );
  const [deployed, setDeployed] = useState<DeployResult['deployed'] | null>(null);
  const [ledger, setLedger] = useState<SolvencyState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [contractJoining, setContractJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(INITIAL_STORAGE_NOTICE);
  const autoJoinAttemptedRef = useRef(false);
  const skipAutoJoinRef = useRef(false);
  const contractJoiningRef = useRef(false);
  const walletOpInFlightRef = useRef(false);
  const [lastTx, setLastTx] = useState<SubmitProofResult | null>(null);

  useEffect(() => {
    contractJoiningRef.current = contractJoining;
  }, [contractJoining]);

  const setReadiness = useCallback((next: WalletReadiness | null) => {
    readinessRef.current = next;
    setWalletReadiness(next);
  }, []);

  const setSelectedWalletInstallId = useCallback((installId: string) => {
    setSelectedWalletInstallIdState(installId);
    storeWalletInstallId(installId);
  }, []);

  const refreshWallet = useCallback(
    async (opts?: { forceDust?: boolean }) => {
      if (!connectedAPI) {
        setReadiness(null);
        return;
      }
      const walletMeta = availableWallets.find((w) => w.installId === resolvedWalletInstallId) ?? null;
      const readiness = await loadWalletReadiness(connectedAPI, walletMeta, {
        previous: readinessRef.current,
        preferCachedDust: !opts?.forceDust,
      });
      setReadiness(readiness);
    },
    [connectedAPI, availableWallets, resolvedWalletInstallId, setReadiness],
  );

  useEffect(() => {
    if (walletPhase !== 'connected' || !connectedAPI) return;
    // Pause all wallet RPC while deploy/prove/join is in flight.
    if (busy || contractJoining) return;
    void refreshWallet({ forceDust: false });
    const walletMeta = availableWallets.find((w) => w.installId === resolvedWalletInstallId);
    const isOneAm = walletMeta ? isDustSponsoredWallet(walletMeta) : false;
    const pollMs = isOneAm ? ONE_AM_DUST_POLL_MS : LACE_DUST_POLL_MS;
    if (pollMs <= 0) return;
    const id = window.setInterval(() => void refreshWallet({ forceDust: false }), pollMs);
    return () => window.clearInterval(id);
  }, [
    walletPhase,
    connectedAPI,
    refreshWallet,
    availableWallets,
    resolvedWalletInstallId,
    busy,
    contractJoining,
  ]);

  const waitForWalletIdle = useCallback(async (label: string, timeoutMs = 90_000) => {
    const start = Date.now();
    while (contractJoiningRef.current || walletOpInFlightRef.current) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `${label}: wallet is still busy (${contractJoiningRef.current ? 'joining stored contract' : 'another action in flight'}). ` +
            'Wait a moment, or Disconnect → Connect, then try again.',
        );
      }
      await sleep(500);
    }
    // After hard refresh the extension may still be finishing a stale request.
    await sleep(300);
  }, []);

  const runWalletOp = useCallback(
    async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
      if (walletOpInFlightRef.current) {
        throw new Error(`${label}: another wallet action is already in progress.`);
      }
      walletOpInFlightRef.current = true;
      try {
        return await fn();
      } finally {
        walletOpInFlightRef.current = false;
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!providers || !contractAddress) return;
    const state = await readPorState(providers, contractAddress);
    setLedger(state);
  }, [providers, contractAddress]);

  const connect = useCallback(async () => {
    const installId = resolvedWalletInstallId;
    if (!installId) {
      setWalletPhase('error');
      setWalletError('No Midnight wallet detected. Install Lace or 1AM and refresh this page.');
      return;
    }

    setWalletPhase('connecting');
    setWalletError(null);
    try {
      const walletMeta = availableWallets.find((w) => w.installId === installId) ?? null;
      const { api, walletName, networkId } = await connectToWallet(
        installId,
        import.meta.env.VITE_NETWORK_ID,
      );
      const prov = await buildBrowserProviders(api, networkId);
      const readiness = await loadWalletReadiness(api, walletMeta);
      setConnectedAPI(api);
      setProviders(prov);
      setReadiness(readiness);
      setConnectedWalletName(walletName);
      setSelectedWalletInstallId(installId);
      setWalletPhase('connected');
    } catch (error) {
      setWalletPhase('error');
      setWalletError(error instanceof Error ? error.message : 'Wallet connection failed');
    }
  }, [resolvedWalletInstallId, setSelectedWalletInstallId, availableWallets, setReadiness]);

  const disconnect = useCallback(async () => {
    if (connectedAPI) await disconnectWallet(connectedAPI);
    setConnectedAPI(null);
    setProviders(null);
    setDeployed(null);
    setLedger(null);
    setReadiness(null);
    setConnectedWalletName(null);
    setContractJoining(false);
    setJoinError(null);
    autoJoinAttemptedRef.current = false;
    skipAutoJoinRef.current = false;
    walletOpInFlightRef.current = false;
    setWalletPhase('idle');
  }, [connectedAPI, setReadiness]);

  const deploy = useCallback(
    async (witnessInputs: WitnessInputs) => {
      if (!providers) throw new Error('Connect wallet first');
      skipAutoJoinRef.current = true;
      autoJoinAttemptedRef.current = true;
      await waitForWalletIdle('Deploy');
      await runWalletOp('Deploy', async () => {
        if (connectedAPI) {
          const walletMeta =
            availableWallets.find((w) => w.installId === resolvedWalletInstallId) ?? null;
          const readiness = await loadWalletReadiness(connectedAPI, walletMeta, {
            previous: readinessRef.current,
            preferCachedDust: true,
          });
          setReadiness(readiness);
          if (!readiness.ready) {
            throw new Error(readiness.warning ?? 'Wallet is not ready — DUST balance is too low.');
          }
        }
        setBusy('Deploying contract — approve in 1AM immediately when prompted…');
        try {
          const result = await deployPorContract(providers, witnessInputs);
          setContractAddress(result.contractAddress);
          saveStoredContract(result.contractAddress);
          setDeployed(result.deployed);
          setJoinError(null);
          await refresh();
        } finally {
          setBusy(null);
        }
      });
    },
    [
      providers,
      connectedAPI,
      refresh,
      availableWallets,
      resolvedWalletInstallId,
      setReadiness,
      waitForWalletIdle,
      runWalletOp,
    ],
  );

  const handleJoinFailure = useCallback((error: unknown) => {
    if (isVerifierKeyMismatchError(error)) {
      clearStoredContract();
      setContractAddress(null);
      setDeployed(null);
      setLedger(null);
      skipAutoJoinRef.current = true;
      setJoinError(VERIFIER_MISMATCH_MESSAGE);
      return;
    }
    const message = error instanceof Error ? error.message : 'Failed to join contract';
    setJoinError(message);
  }, []);

  const join = useCallback(
    async (address: string, witnessInputs: WitnessInputs) => {
      if (!providers) throw new Error('Connect wallet first');
      await runWalletOp('Join contract', async () => {
        setContractJoining(true);
        setJoinError(null);
        try {
          const result = await joinPorContractWithTimeout(providers, address, witnessInputs);
          setContractAddress(address);
          saveStoredContract(address);
          setDeployed(result.deployed);
          setJoinError(null);
          await refresh();
        } catch (error) {
          handleJoinFailure(error);
          console.warn('[por-browser] join contract failed', error);
          throw error;
        } finally {
          setContractJoining(false);
        }
      });
    },
    [providers, refresh, runWalletOp, handleJoinFailure],
  );

  const rejoinContract = useCallback(async () => {
    if (!contractAddress) throw new Error('No stored contract address');
    autoJoinAttemptedRef.current = true;
    await join(contractAddress, buildDemoTree(false).witnessInputs);
  }, [contractAddress, join]);

  // After reconnect, reattach to the stored contract once (background — separate from deploy/prove busy).
  useEffect(() => {
    if (skipAutoJoinRef.current) return;
    if (walletPhase !== 'connected' || !providers || !contractAddress || deployed || contractJoining) {
      return;
    }
    if (autoJoinAttemptedRef.current) return;
    autoJoinAttemptedRef.current = true;
    void join(contractAddress, buildDemoTree(false).witnessInputs).catch(() => {
      // joinError is set inside join()
    });
  }, [walletPhase, providers, contractAddress, deployed, contractJoining, join]);

  const prove = useCallback(
    async (reserves: bigint, slot: bigint) => {
      if (!deployed) throw new Error('Deploy or join a contract first');
      await waitForWalletIdle('Prove');
      await runWalletOp('Prove', async () => {
        if (connectedAPI) {
          const walletMeta =
            availableWallets.find((w) => w.installId === resolvedWalletInstallId) ?? null;
          const readiness = await loadWalletReadiness(connectedAPI, walletMeta, {
            previous: readinessRef.current,
            preferCachedDust: true,
          });
          setReadiness(readiness);
          if (!readiness.ready) {
            throw new Error(readiness.warning ?? 'Wallet is not ready — DUST balance is too low.');
          }
        }
        setBusy('Generating ZK proof — keep wallet unlocked; approve when prompted…');
        let stopKeepalive: (() => void) | undefined;
        try {
          if (connectedAPI) {
            stopKeepalive = startWalletKeepalive(connectedAPI, 45_000);
          }
          const tx = await submitPorProofWithRetry(deployed, reserves, slot);
          setLastTx(tx);
          await refresh();
        } finally {
          stopKeepalive?.();
          setBusy(null);
        }
      });
    },
    [
      deployed,
      connectedAPI,
      refresh,
      availableWallets,
      resolvedWalletInstallId,
      setReadiness,
      waitForWalletIdle,
      runWalletOp,
    ],
  );

  const refreshWalletPublic = useCallback(() => refreshWallet({ forceDust: true }), [refreshWallet]);

  const forgetStoredContract = useCallback(() => {
    clearStoredContract();
    skipAutoJoinRef.current = true;
    autoJoinAttemptedRef.current = true;
    setContractAddress(null);
    setDeployed(null);
    setLedger(null);
    setJoinError(null);
    setContractJoining(false);
  }, []);

  return {
    walletPhase,
    walletError,
    walletReadiness,
    connectedWalletName,
    selectedWalletInstallId: resolvedWalletInstallId,
    availableWallets,
    setSelectedWalletInstallId,
    connectedAPI,
    providers,
    contractAddress,
    deployed,
    ledger,
    busy,
    contractJoining,
    joinError,
    lastTx,
    connect,
    disconnect,
    refreshWallet: refreshWalletPublic,
    deploy,
    join,
    rejoinContract,
    prove,
    refresh,
    forgetStoredContract,
  };
}
