import { useEffect, useState } from 'react';
import { defaultWalletInstallId, listDetectedWallets, type DetectedWallet } from '../wallet/walletConnector';

/** Wallet injection detection only — does not call the extension RPC. */
const DETECT_POLL_MS = 5_000;

export function useDetectedWallets(selectedInstallId: string | null): {
  wallets: DetectedWallet[];
  selectedInstallId: string | null;
} {
  const [wallets, setWallets] = useState<DetectedWallet[]>(() => listDetectedWallets());

  useEffect(() => {
    const refresh = () => setWallets(listDetectedWallets());
    refresh();
    const id = window.setInterval(refresh, DETECT_POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  const resolved =
    selectedInstallId && wallets.some((w) => w.installId === selectedInstallId)
      ? selectedInstallId
      : defaultWalletInstallId(wallets);

  return { wallets, selectedInstallId: resolved };
}
