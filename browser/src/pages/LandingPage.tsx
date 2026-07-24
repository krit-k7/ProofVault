import { Link } from 'react-router-dom';
import './Landing.css';

const STEPS = [
  {
    n: '1',
    title: 'Connect wallet',
    desc: 'Use Lace or 1AM on Midnight Preprod. Make sure you have DUST for transactions.',
  },
  {
    n: '2',
    title: 'Deploy contract',
    desc: 'Publish the eligibility circuit from your browser. The contract address is saved locally.',
  },
  {
    n: '3',
    title: 'Prove threshold',
    desc: 'Run proveSolvency: the circuit checks private liabilities ≤ public reserves in zero-knowledge.',
  },
  {
    n: '4',
    title: 'Verify on-chain',
    desc: 'Refresh the ledger. Only the verdict, reserves, and commitment root appear publicly.',
  },
] as const;

export function LandingPage() {
  return (
    <div className="site">
      <header className="site-header">
        <div className="site-wrap site-header__inner">
          <Link to="/" className="site-logo">
            <span className="site-logo__icon" aria-hidden="true">
              ◐
            </span>
            <span>
              Solvency Gate
              <small>on Midnight</small>
            </span>
          </Link>
          <nav className="site-nav" aria-label="Site">
            <a href="#how">How it works</a>
            <a href="#privacy">Privacy</a>
            <Link to="/app" className="site-btn site-btn--sm">
              Launch app
            </Link>
          </nav>
        </div>
      </header>

      <section className="site-hero">
        <div className="site-wrap site-hero__grid">
          <div className="site-hero__copy">
            <span className="site-tag">Rise In · Level 3 · Eligibility Gate</span>
            <h1>
              Prove solvency
              <br />
              <em>without exposing balances</em>
            </h1>
            <p className="site-hero__lead">
              A custodian proves customer liabilities stay under public reserves — the same selective
              disclosure pattern as an age check. Observers learn <strong>eligible or not</strong>, not
              the private total.
            </p>
            <div className="site-hero__actions">
              <Link to="/app" className="site-btn site-btn--primary">
                Try the live demo
              </Link>
              <a href="#how" className="site-btn site-btn--outline">
                How it works
              </a>
            </div>
            <ul className="site-hero__meta">
              <li>Midnight Preprod</li>
              <li>Lace / 1AM wallet</li>
              <li>Browser ZK proof</li>
            </ul>
          </div>

          <div className="site-hero__viz" aria-hidden="true">
            <div className="gate-card">
              <div className="gate-card__header">Eligibility gate</div>
              <div className="gate-card__body">
                <div className="gate-zone gate-zone--private">
                  <span className="gate-zone__label">Private witness</span>
                  <div className="gate-zone__row">
                    <span>Liability total</span>
                    <span className="gate-zone__hidden">████████</span>
                  </div>
                  <div className="gate-zone__row">
                    <span>Customer balances</span>
                    <span className="gate-zone__hidden">8 leaves</span>
                  </div>
                </div>
                <div className="gate-arrow">ZK proof →</div>
                <div className="gate-zone gate-zone--public">
                  <span className="gate-zone__label">Public ledger</span>
                  <div className="gate-zone__row">
                    <span>solvent</span>
                    <span className="gate-zone__ok">true</span>
                  </div>
                  <div className="gate-zone__row">
                    <span>reserves</span>
                    <span>₳ 1,200</span>
                  </div>
                  <div className="gate-zone__row">
                    <span>liabilitiesRoot</span>
                    <span className="gate-zone__hash">a3f8…c21</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="site-section" id="how">
        <div className="site-wrap">
          <div className="site-section__head">
            <h2>How it works</h2>
            <p>Four steps from wallet connection to a verifiable public verdict.</p>
          </div>
          <div className="site-steps">
            {STEPS.map((step) => (
              <article key={step.n} className="site-step">
                <span className="site-step__n">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section site-section--soft" id="pattern">
        <div className="site-wrap">
          <div className="site-section__head">
            <h2>The eligibility pattern</h2>
            <p>Same logic as proving age ≥ 18 — applied to financial solvency.</p>
          </div>
          <div className="site-compare">
            <article className="site-compare__card">
              <h3>Age gate (example)</h3>
              <dl>
                <div>
                  <dt>Private input</dt>
                  <dd>Your real age: 22</dd>
                </div>
                <div>
                  <dt>Public rule</dt>
                  <dd>Must be ≥ 18</dd>
                </div>
                <div>
                  <dt>What others see</dt>
                  <dd className="site-compare__result">Eligible ✓ — not “22”</dd>
                </div>
              </dl>
            </article>
            <article className="site-compare__card site-compare__card--accent">
              <h3>Solvency gate (this app)</h3>
              <dl>
                <div>
                  <dt>Private input</dt>
                  <dd>Total liabilities (Merkle tree)</dd>
                </div>
                <div>
                  <dt>Public rule</dt>
                  <dd>Must be ≤ attested reserves</dd>
                </div>
                <div>
                  <dt>What others see</dt>
                  <dd className="site-compare__result">solvent ✓ — not the total</dd>
                </div>
              </dl>
            </article>
          </div>
        </div>
      </section>

      <section className="site-section" id="privacy">
        <div className="site-wrap">
          <div className="site-section__head">
            <h2>Privacy model</h2>
            <p>Exactly what an observer on the Midnight ledger can and cannot learn.</p>
          </div>
          <div className="site-privacy">
            <div className="site-privacy__panel site-privacy__panel--public">
              <h3>
                <span className="site-privacy__dot site-privacy__dot--public" />
                Observer can learn
              </h3>
              <ul>
                <li>
                  Eligibility verdict (<code>solvent</code>)
                </li>
                <li>Reserves snapshot and freshness slot</li>
                <li>Liabilities Merkle root (commitment only)</li>
                <li>Custodian owner public key hash</li>
              </ul>
            </div>
            <div className="site-privacy__panel site-privacy__panel--private">
              <h3>
                <span className="site-privacy__dot site-privacy__dot--private" />
                Observer cannot learn
              </h3>
              <ul>
                <li>Exact total liabilities</li>
                <li>Per-customer balances and salts</li>
                <li>Full Merkle tree witness data</li>
                <li>Custodian secret key</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="site-cta">
        <div className="site-wrap site-cta__inner">
          <h2>Ready to run a proof?</h2>
          <p>Connect your wallet, deploy on Preprod, and check eligibility in the browser.</p>
          <Link to="/app" className="site-btn site-btn--primary site-btn--lg">
            Open the app →
          </Link>
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-wrap site-footer__inner">
          <p>Confidential Proof of Reserves · Midnight Network</p>
        </div>
      </footer>
    </div>
  );
}
