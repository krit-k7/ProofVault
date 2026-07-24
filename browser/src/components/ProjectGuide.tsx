const STEPS = [
  {
    title: 'Install a Midnight wallet',
    body: 'Use Lace or 1AM on the Preprod network. You need a little DUST for deploy and prove transactions.',
  },
  {
    title: 'Connect (bar above)',
    body: 'Pick your wallet, click Connect, and wait until DUST shows ready. Disconnect anytime to clear the session.',
  },
  {
    title: 'Deploy a fresh contract',
    body: 'In Try it below, click Deploy fresh contract and approve in the wallet. That puts the eligibility circuit on Preprod.',
  },
  {
    title: 'Check eligibility',
    body: 'Click Check eligibility (proveSolvency). The browser builds a ZK proof that the private liability total is ≤ the public reserves threshold — without publishing balances.',
  },
  {
    title: 'Read the privacy model',
    body: 'Use Refresh ledger, then compare on-chain fields (what observers can learn) with witness-only fields (what stays private).',
  },
] as const;

export function ProjectGuide() {
  return (
    <section className="guide" aria-labelledby="guide-heading">
      <div className="guide__about panel">
        <header>
          <h2 id="guide-heading">About this project</h2>
          <p>
            This is a Midnight <strong>Age / Eligibility Gate</strong> demo: a custodian proves they are{' '}
            <em>eligible</em> to claim solvency — that a <strong>private</strong> liability total is ≤ a{' '}
            <strong>public</strong> reserves snapshot — without revealing customer balances or the exact total.
          </p>
        </header>

        <div className="guide__columns">
          <div className="guide__col">
            <h3>What an observer can learn</h3>
            <ul>
              <li>
                Pass / fail verdict (<span className="mono">solvent</span>)
              </li>
              <li>Public reserves snapshot and time slot</li>
              <li>Merkle commitment root (not the balances)</li>
              <li>Custodian owner key hash</li>
            </ul>
          </div>
          <div className="guide__col">
            <h3>What stays private</h3>
            <ul>
              <li>Exact total liabilities</li>
              <li>Per-customer balances and salts</li>
              <li>Full Merkle tree witness data</li>
              <li>Custodian secret key</li>
            </ul>
          </div>
        </div>

        <p className="guide__note">
          Sandbox numbers below are demo data for Preprod teaching only — not real exchange books. Values shown in the
          UI for illustration are <strong>not</strong> written on-chain.
        </p>
      </div>

      <div className="guide__steps panel">
        <header>
          <h2>How to use it</h2>
          <p>Follow these steps once, then use the Try it section at the bottom.</p>
        </header>
        <ol className="guide__step-list">
          {STEPS.map((step, i) => (
            <li key={step.title} className="guide__step">
              <span className="guide__step-num" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
