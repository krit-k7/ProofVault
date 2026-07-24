import { formatLovelace, toHex } from '../por/PorBrowserClient';

interface PrivacyRow {
  field: string;
  visibility: 'public' | 'private';
  value: string;
  note: string;
}

interface PrivacyPanelProps {
  totalLiabilities: bigint;
  customerCount: number;
  ledger: {
    solvent: boolean;
    published: boolean;
    reservesSnapshot: bigint;
    reservesSlot: bigint;
    owner: Uint8Array;
    liabilitiesRoot: Uint8Array;
  } | null;
}

export function PrivacyPanel({ totalLiabilities, customerCount, ledger }: PrivacyPanelProps) {
  const rows: PrivacyRow[] = [
    {
      field: 'Eligibility verdict (solvent)',
      visibility: 'public',
      value: ledger ? (ledger.solvent ? '✓ Eligible' : '✗ Not eligible') : '—',
      note: 'Observer can learn: pass/fail of privateTotal ≤ public reserves',
    },
    {
      field: 'Reserves snapshot',
      visibility: 'public',
      value: ledger ? formatLovelace(ledger.reservesSnapshot) : '—',
      note: 'Total reserves you attested in the proof',
    },
    {
      field: 'Liabilities Merkle root',
      visibility: 'public',
      value: ledger ? `${toHex(ledger.liabilitiesRoot).slice(0, 16)}…` : '—',
      note: 'Commitment to the liability tree — not the balances',
    },
    {
      field: 'Reserves slot',
      visibility: 'public',
      value: ledger ? ledger.reservesSlot.toString() : '—',
      note: 'Timestamp anchor for the attestation',
    },
    {
      field: 'Contract owner',
      visibility: 'public',
      value: ledger ? `${toHex(ledger.owner).slice(0, 12)}…` : '—',
      note: 'Custodian public key hash',
    },
    {
      field: 'Total liabilities',
      visibility: 'private',
      value: `${formatLovelace(totalLiabilities)} (${customerCount} customers)`,
      note: 'Observer cannot learn: private threshold input — never on ledger',
    },
    {
      field: 'Per-customer balances',
      visibility: 'private',
      value: `${customerCount} leaf values in witness`,
      note: 'Observer cannot learn: individual balances stay in the ZK witness',
    },
  ];

  return (
    <section className="panel privacy-panel">
      <header>
        <h2>Privacy model</h2>
        <p>What an observer can learn (on-chain) vs cannot learn (witness only).</p>
      </header>
      <div className="privacy-grid">
        {rows.map((row) => (
          <article key={row.field} className={`privacy-row privacy-row--${row.visibility}`}>
            <div className="privacy-row__meta">
              <span className={`badge badge--${row.visibility}`}>
                {row.visibility === 'public' ? 'On-chain' : 'Witness only'}
              </span>
              <h3>{row.field}</h3>
            </div>
            <p className="privacy-row__value">{row.value}</p>
            <p className="privacy-row__note">{row.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
