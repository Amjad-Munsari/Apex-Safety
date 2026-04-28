'use client';

import { useState, useMemo, useEffect } from 'react';

/* ════════════════════════════════════════════
   SERVICE CATALOGUE DATA
   ════════════════════════════════════════════ */
interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
}

interface Category {
  id: string;
  number: string;
  title: string;
  services: Service[];
}

const SERVICE_CATEGORIES: Category[] = [
  {
    id: 'fire-risk',
    number: '01',
    title: 'Fire Risk Assessments',
    services: [
      { id: 'fra-type-1', name: 'Fire Risk Assessment — Type 1', description: 'Common parts only, non-destructive inspection.', price: 480, unit: 'per assessment' },
      { id: 'fra-type-3', name: 'Fire Risk Assessment — Type 3', description: 'Non-sleeping occupancy, full common parts + sample dwellings.', price: 620, unit: 'per assessment' },
      { id: 'fra-type-4', name: 'Fire Risk Assessment — Type 4', description: 'Sleeping risk, destructive inspection of sample dwellings.', price: 980, unit: 'per assessment' },
      { id: 'site-risk', name: 'Site Risk Assessment', description: 'Broader H&S site survey with written recommendations.', price: 540, unit: 'per site' },
    ],
  },
  {
    id: 'training',
    number: '02',
    title: 'Training courses',
    services: [
      { id: 'fire-warden', name: 'Fire Warden Training', description: 'Half-day course, up to 12 delegates, certificates issued.', price: 540, unit: 'per course' },
      { id: 'fire-marshal', name: 'Fire Marshal Training', description: 'Full-day course, up to 12 delegates, extinguisher practical.', price: 820, unit: 'per course' },
      { id: 'fire-awareness', name: 'Basic Fire Awareness', description: 'Short course suitable for all staff, up to 20 delegates.', price: 360, unit: 'per course' },
      { id: 'efaw', name: 'Emergency First Aid at Work', description: '1-day EFAW, HSE-compliant, up to 12 delegates.', price: 680, unit: 'per course' },
      { id: 'faw-3day', name: 'First Aid at Work (3-day)', description: 'Full FAW 3-day, HSE-compliant, up to 12 delegates.', price: 1650, unit: 'per course' },
      { id: 'manual-handling', name: 'Manual Handling', description: 'Half-day practical, up to 12 delegates.', price: 420, unit: 'per course' },
      { id: 'dse', name: 'DSE Assessment', description: 'Per workstation review + written report.', price: 35, unit: 'per workstation' },
    ],
  },
  {
    id: 'testing-retainer',
    number: '03',
    title: 'Testing & retainer',
    services: [
      { id: 'pat', name: 'PAT Testing', description: 'Portable appliance testing, per item, minimum 20 items.', price: 2.5, unit: 'per item' },
      { id: 'retainer-5h', name: 'Consulting Retainer — 5h', description: 'Five consulting hours, use any time within 12 months.', price: 425, unit: 'bundle' },
      { id: 'retainer-10h', name: 'Consulting Retainer — 10h', description: 'Ten consulting hours, use any time within 12 months.', price: 800, unit: 'bundle' },
      { id: 'retainer-20h', name: 'Consulting Retainer — 20h', description: 'Twenty consulting hours, use any time within 12 months.', price: 1500, unit: 'bundle' },
    ],
  },
];

const ALL_SERVICES = SERVICE_CATEGORIES.flatMap(cat => cat.services);

/* ════════════════════════════════════════════
   EXISTING CLIENTS
   ════════════════════════════════════════════ */
interface Client {
  id: string;
  orgName: string;
  address: string;
  contactName: string;
  contactEmail: string;
}

const EXISTING_CLIENTS: Client[] = [
  {
    id: 'hallam-house',
    orgName: 'Hallam House Care Home',
    address: '42 Hallam Lane, Sheffield S10 5BT',
    contactName: 'Sarah Whitfield',
    contactEmail: 'sarah.whitfield@hallamhouse.co.uk',
  },
  {
    id: 'riverway',
    orgName: 'Riverway Logistics Ltd',
    address: 'Unit 7, Riverway Estate, Rotherham S60 1RP',
    contactName: 'Daniel Okonkwo',
    contactEmail: 'd.okonkwo@riverwaylog.co.uk',
  },
  {
    id: 'kestrel',
    orgName: 'Kestrel Point Offices',
    address: '18 Kestrel Point, Leeds LS1 4DY',
    contactName: 'Priya Iyer',
    contactEmail: 'piyer@kestrelpoint.co.uk',
  },
  {
    id: 'crown',
    orgName: 'Crown Tavern (Stannington)',
    address: '301 Stannington Rd, Sheffield S6 5FW',
    contactName: 'Andy Marston',
    contactEmail: 'andy@crowntavern.uk',
  },
];

/* ════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════ */
function formatPrice(amount: number): string {
  if (amount < 1) return `£${amount}`;
  if (amount % 1 !== 0) return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  return `£${amount.toLocaleString('en-GB')}`;
}

function formatTotal(amount: number): string {
  return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ════════════════════════════════════════════
   STEPPER STEPS
   ════════════════════════════════════════════ */
const STEPS = [
  { number: 1, label: 'CLIENT' },
  { number: 2, label: 'SERVICES' },
  { number: 3, label: 'DRAFT' },
  { number: 4, label: 'SEND' },
];

/* ════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════ */
export default function NewProposalPage() {
  const [step, setStep] = useState(1);
  const [isDrafting, setIsDrafting] = useState(false);
  const [clientTab, setClientTab] = useState<'existing' | 'new'>('existing');
  const [clientForm, setClientForm] = useState({
    orgName: '',
    contactName: '',
    siteAddress: '',
    contactEmail: '',
  });

  useEffect(() => {
    if (step === 3) {
      setIsDrafting(true);
      const timer = setTimeout(() => {
        setIsDrafting(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [step]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  /* Computed */
  const lineItems = useMemo(() => {
    return Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const service = ALL_SERVICES.find(s => s.id === id)!;
        return { ...service, quantity: qty, total: service.price * qty };
      });
  }, [quantities]);

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const vat = subtotal * 0.2;
  const total = subtotal + vat;
  const clientName = clientForm.orgName || 'Client';
  const canProceed = clientForm.orgName.trim() !== '';

  /* Handlers */
  const updateQty = (id: string, delta: number) => {
    setQuantities(prev => {
      const next = Math.max(0, (prev[id] || 0) + delta);
      return { ...prev, [id]: next };
    });
  };

  const setField = (field: string, value: string) => {
    setClientForm(prev => ({ ...prev, [field]: value }));
  };

  const selectClient = (client: Client) => {
    setClientForm({
      orgName: client.orgName,
      contactName: client.contactName,
      siteAddress: client.address,
      contactEmail: client.contactEmail,
    });
  };

  /* ── Render ── */
  return (
    <div className="prop-shell">
      {/* ═══ Main Header ═══ */}
      <header className="prop-header">
          <div className="prop-header-left">
          <span className="prop-logo">888</span>
          <span className="prop-brand">SAFETY SOLUTIONS · PROPOSALS</span>
        </div>

        <nav className="prop-stepper">
          {STEPS.map((s, i) => (
            <div key={s.number} className="prop-step-wrapper">
              {i > 0 && <div className={`prop-step-line ${step >= s.number ? 'completed' : ''}`} />}
              <button
                className={`prop-step ${step === s.number ? 'active' : ''} ${step > s.number ? 'completed' : ''}`}
                onClick={() => { if (s.number <= step) setStep(s.number); }}
              >
                <span className="prop-step-number">{s.number}</span>
                <span className="prop-step-label">{s.label}</span>
              </button>
            </div>
          ))}
        </nav>

        <div className="prop-header-right">
          {step > 1 && (
            <button 
              className="prop-discard"
              onClick={() => {
                setStep(1);
                setQuantities({});
                setClientForm({ orgName: '', contactName: '', siteAddress: '', contactEmail: '' });
                setClientTab('existing');
              }}
            >
              Discard draft
            </button>
          )}
          <div className="prop-user">
            <div className="prop-user-info">
              <span className="prop-user-name">Matt Hollis</span>
              <span className="prop-user-role">Lead Consultant</span>
            </div>
            <div className="prop-avatar">MH</div>
          </div>
        </div>
      </header>

      {/* ═══ Document Header (Visible only on final draft) ═══ */}
      {step === 3 && !isDrafting && (
        <div className="prop-doc-navbar">
          <div className="prop-doc-navbar-left">
            <div className="prop-doc-meta">PROPOSAL P-2026-2390 · DRAFT</div>
            <div className="prop-doc-client">{clientName}</div>
          </div>
          <div className="prop-doc-actions">
            <button className="prop-btn-secondary" onClick={() => setStep(2)}>Edit services</button>
            <button className="prop-btn-secondary" onClick={() => setIsDrafting(true)}>+ Regenerate</button>
            <button className="prop-btn-primary" onClick={() => setStep(4)}>Send for e-signature →</button>
          </div>
        </div>
      )}

      {/* ═══ Content ═══ */}
      <div className="prop-content" style={{ padding: step === 3 && !isDrafting ? 0 : undefined }}>

        {/* ──────── STEP 1: CLIENT ──────── */}
        {step === 1 && (
          <div className="prop-client-step">
            <div className="prop-breadcrumb">PROPOSALS · NEW</div>
            <h1 className="prop-heading">Start a new proposal.</h1>
            <p className="prop-description">
              Pick an existing client or add a new one. You&apos;ll choose services next, then we&apos;ll draft a
              branded one-pager ready to send for e-signature.
            </p>

            <div className="prop-tabs">
              <button
                className={`prop-tab ${clientTab === 'existing' ? 'active' : ''}`}
                onClick={() => setClientTab('existing')}
              >
                Existing clients
              </button>
              <button
                className={`prop-tab ${clientTab === 'new' ? 'active' : ''}`}
                onClick={() => setClientTab('new')}
              >
                Add new client
              </button>
            </div>

            {clientTab === 'new' ? (
              <div className="prop-form">
                <div className="prop-form-row">
                  <div className="prop-form-group">
                    <label className="prop-label">ORGANISATION NAME</label>
                    <input
                      type="text"
                      className="prop-input"
                      value={clientForm.orgName}
                      onChange={e => setField('orgName', e.target.value)}
                    />
                  </div>
                  <div className="prop-form-group">
                    <label className="prop-label">CONTACT NAME</label>
                    <input
                      type="text"
                      className="prop-input"
                      value={clientForm.contactName}
                      onChange={e => setField('contactName', e.target.value)}
                    />
                  </div>
                </div>
                <div className="prop-form-group">
                  <label className="prop-label">SITE ADDRESS</label>
                  <input
                    type="text"
                    className="prop-input"
                    value={clientForm.siteAddress}
                    onChange={e => setField('siteAddress', e.target.value)}
                  />
                </div>
                <div className="prop-form-group">
                  <label className="prop-label">CONTACT EMAIL</label>
                  <input
                    type="email"
                    className="prop-input"
                    placeholder="name@company.co.uk"
                    value={clientForm.contactEmail}
                    onChange={e => setField('contactEmail', e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="prop-existing-clients">
                <div className="prop-label" style={{ marginBottom: '16px' }}>SELECT CLIENT</div>
                <div className="prop-client-grid">
                  {EXISTING_CLIENTS.map(client => (
                    <button
                      key={client.id}
                      className={`prop-client-card ${clientForm.orgName === client.orgName ? 'selected' : ''}`}
                      onClick={() => selectClient(client)}
                    >
                      <div className="prop-client-card-name">{client.orgName}</div>
                      <div className="prop-client-card-address">{client.address}</div>
                      <div className="prop-client-card-contact">
                        {client.contactName} · <span>{client.contactEmail}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="prop-step-actions">
              <button
                className="prop-btn-next"
                disabled={!canProceed}
                onClick={() => setStep(2)}
              >
                Choose services <span className="arrow">→</span>
              </button>
            </div>
          </div>
        )}

        {/* ──────── STEP 2: SERVICES ──────── */}
        {step === 2 && (
          <div className="prop-services-step">
            {/* Left column — catalogue */}
            <div>
              <button className="prop-back-link" onClick={() => setStep(1)}>
                ← Back to client
              </button>
              <div className="prop-breadcrumb">STEP 2 · CHOOSE SERVICES</div>
              <h1 className="prop-services-heading">
                What are we quoting for {clientName}?
              </h1>
              <p className="prop-services-description">
                Set quantities for each service. The line items on the right update live.
              </p>

              {SERVICE_CATEGORIES.map(cat => (
                <div key={cat.id} className="prop-category">
                  <div className="prop-category-header">
                    <span className="prop-category-number">{cat.number}</span>
                    <span className="prop-category-title">{cat.title}</span>
                  </div>

                  {cat.services.map(svc => {
                    const qty = quantities[svc.id] || 0;
                    return (
                      <div key={svc.id} className="prop-service-row">
                        <div className="prop-service-info">
                          <div className="prop-service-name">{svc.name}</div>
                          <div className="prop-service-desc">{svc.description}</div>
                        </div>
                        <div className="prop-service-pricing">
                          <div className="prop-service-price-block">
                            <span className="prop-service-price">{formatPrice(svc.price)}</span>
                            <span className="prop-service-unit">/ {svc.unit}</span>
                          </div>
                          <div className="prop-qty-control">
                            <button className="prop-qty-btn" onClick={() => updateQty(svc.id, -1)}>−</button>
                            <div className={`prop-qty-value ${qty > 0 ? 'has-value' : ''}`}>{qty}</div>
                            <button className="prop-qty-btn" onClick={() => updateQty(svc.id, 1)}>+</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Right column — line items */}
            <div className="prop-line-items">
              <div className="prop-line-items-header">LINE ITEMS</div>
              <div className="prop-line-items-client">{clientName}</div>

              {lineItems.length === 0 ? (
                <div className="prop-line-items-empty">
                  <p>No services selected yet.<br />Pick from the catalogue on the left.</p>
                </div>
              ) : (
                <div className="prop-line-item-list">
                  {lineItems.map(item => (
                    <div key={item.id} className="prop-line-item-entry">
                      <div>
                        <span className="prop-line-item-name">{item.name}</span>
                        <span className="prop-line-item-qty"> ×{item.quantity}</span>
                      </div>
                      <span className="prop-line-item-total">{formatTotal(item.total)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="prop-totals">
                <div className="prop-total-row">
                  <span className="prop-total-label">Subtotal</span>
                  <span className="prop-total-value">{formatTotal(subtotal)}</span>
                </div>
                <div className="prop-total-row">
                  <span className="prop-total-label">VAT (20%)</span>
                  <span className="prop-total-value">{formatTotal(vat)}</span>
                </div>
                <div className="prop-total-row grand">
                  <span className="prop-total-label">Total</span>
                  <span className="prop-total-value">{formatTotal(total)}</span>
                </div>
              </div>

              <button className="prop-generate-btn" disabled={lineItems.length === 0} onClick={() => setStep(3)}>
                + Generate proposal
              </button>
              <div className="prop-generate-note">
                AI-drafts intro + terms · Review before sending
              </div>
            </div>
          </div>
        )}

        {/* ──────── STEP 3: DRAFT ──────── */}
        {step === 3 && (
          <>
            {isDrafting ? (
              <div className="prop-client-step">
                <div className="prop-breadcrumb">STEP 3 · DRAFTING</div>
                <h1 className="prop-heading">Drafting proposal with AI...</h1>
                <p className="prop-description">
                  Pulling your 888 one-pager template, inserting scope, drafting intro copy. Takes ~5 seconds.
                </p>

                <div className="prop-drafting-layout">
                  <div className="prop-skeleton-container">
                    <div className="prop-skeleton-line" style={{ width: '40%' }}></div>
                    <div className="prop-skeleton-line" style={{ width: '60%' }}></div>
                    <div className="prop-skeleton-line" style={{ width: '30%', marginBottom: '24px' }}></div>
                    <div className="prop-skeleton-line" style={{ width: '100%' }}></div>
                    <div className="prop-skeleton-line" style={{ width: '100%' }}></div>
                    <div className="prop-skeleton-line" style={{ width: '80%' }}></div>
                  </div>
                  <div className="prop-status-panel">
                    <div className="prop-status-header">STATUS</div>
                    <div className="prop-status-loader">
                      <div className="prop-spinner"></div>
                      Drafting proposal...
                    </div>
                    <div className="prop-status-list">
                      <div className="prop-status-item">Loading 888 one-pager template</div>
                      <div className="prop-status-item">Inserting client & site block</div>
                      <div className="prop-status-item">Composing intro paragraph</div>
                      <div className="prop-status-item">Building scope table</div>
                      <div className="prop-status-item">Appending terms & signature block</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="prop-doc-container">
                  <div className="prop-paper">
                    <div className="prop-paper-header">
                      <div className="prop-paper-logo-block">
                        <div className="prop-paper-logo">888<span style={{ fontSize: '18px', color: '#666' }}> Safety Solutions</span></div>
                        <div className="prop-paper-tagline">Fire Safety · Health & Safety · Training</div>
                      </div>
                      <div className="prop-paper-id-block">
                        <div className="prop-paper-id-label">PROPOSAL</div>
                        <div className="prop-paper-id">P-2026-2390</div>
                        <div className="prop-paper-date">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                      </div>
                    </div>

                    <div className="prop-paper-grid">
                      <div>
                        <div className="prop-paper-meta-label">PREPARED FOR</div>
                        <div className="prop-paper-meta-name">{clientName}</div>
                        <div className="prop-paper-meta-detail">
                          {clientForm.siteAddress || '42 Hallam Lane, Sheffield S10 5BT'}<br />
                          Attn: {clientForm.contactName || 'Sarah Whitfield'}
                        </div>
                      </div>
                      <div>
                        <div className="prop-paper-meta-label">PREPARED BY</div>
                        <div className="prop-paper-meta-name">Matt Hollis</div>
                        <div className="prop-paper-meta-detail">
                          Lead Consultant · 888 Safety Solutions<br />
                          matt@888safety.co.uk · 0114 555 0188
                        </div>
                      </div>
                    </div>

                    <div className="prop-paper-title">Scope & proposal.</div>
                    <div className="prop-paper-text">
                      Following our initial conversation, this proposal sets out the scope and cost for the services we'd recommend for {clientName}. Our aim is to keep compliance straightforward: a single point of contact, clear written reports, and practical actions you can delegate to your team. If anything in this scope needs adjusting, just reply to this email — we'll revise and re-send.
                    </div>

                    <div className="prop-paper-section-label">SERVICES</div>
                    <table className="prop-paper-table">
                      <thead>
                        <tr>
                          <th>SERVICE</th>
                          <th>QTY</th>
                          <th>UNIT</th>
                          <th>TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map(item => (
                          <tr key={item.id}>
                            <td>
                              <div className="prop-paper-svc-name">{item.name}</div>
                              <div className="prop-paper-svc-desc">Standard inspection of site premises.</div>
                            </td>
                            <td>{item.quantity}</td>
                            <td>{formatPrice(item.price)}</td>
                            <td>{formatTotal(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="prop-paper-totals">
                      <div className="prop-paper-total-row">
                        <span>Subtotal</span>
                        <span>{formatTotal(subtotal)}</span>
                      </div>
                      <div className="prop-paper-total-row">
                        <span>VAT @ 20%</span>
                        <span>{formatTotal(vat)}</span>
                      </div>
                      <div className="prop-paper-total-row grand">
                        <span>Total</span>
                        <span>{formatTotal(total)}</span>
                      </div>
                    </div>

                    <div className="prop-paper-section-label">TERMS SUMMARY</div>
                    <div className="prop-paper-terms">
                      <ol>
                        <li>Fees quoted are valid for 30 days from the date of this proposal.</li>
                        <li>Fees exclude VAT. Travel within 20 miles of Sheffield is included; mileage beyond charged at 45p/mile.</li>
                        <li>Cancellations within 48 hours of a booked visit are charged at 50% of the service fee.</li>
                        <li>Written reports are issued within 10 working days of the site visit.</li>
                        <li>A Service Agreement will be generated and issued automatically once this proposal is signed.</li>
                      </ol>
                    </div>

                    <div className="prop-paper-signatures">
                      <div className="prop-paper-sig-block">
                        <div className="prop-paper-section-label">SIGNED FOR CLIENT</div>
                        <div className="prop-paper-sig-space"></div>
                        <div className="prop-paper-sig-meta">
                          <span>Name & role</span>
                          <span>Date</span>
                        </div>
                      </div>
                      <div className="prop-paper-sig-block">
                        <div className="prop-paper-section-label">SIGNED FOR 888</div>
                        <div className="prop-paper-sig-space">
                          <span className="prop-paper-sig-img">Matt Hollis</span>
                        </div>
                        <div className="prop-paper-sig-meta">
                          <span>Matt Hollis, Lead Consultant</span>
                          <span>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="prop-paper-footer">
                      <span>888 SAFETY SOLUTIONS LTD - COMPANY NO. 18552988</span>
                      <span>Page 1 of 1 - P-2026-2390</span>
                    </div>
                  </div>
                </div>
            )}
          </>
        )}

        {/* ──────── STEP 4: SEND ──────── */}
        {step === 4 && (
          <div className="prop-client-step" style={{ textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>✉️</div>
            <h1 className="prop-heading">Ready to send?</h1>
            <p className="prop-description">
              The proposal for {clientName} will be sent to <strong>{clientForm.contactEmail || 'client@email.com'}</strong> for e-signature.
            </p>
            
            <div style={{ background: 'var(--p-surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--p-border)', marginBottom: '40px' }}>
              <p style={{ fontSize: '13px', color: 'var(--p-text-muted)', marginBottom: '8px' }}>RECIPIENT</p>
              <p style={{ fontSize: '16px', fontWeight: '500' }}>{clientForm.contactName || 'Client Contact'}</p>
              <p style={{ fontSize: '14px', color: 'var(--p-text-secondary)' }}>{clientForm.contactEmail || 'client@email.com'}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                className="prop-btn-next"
                style={{ width: '100%', justifyContent: 'center', background: 'var(--p-gold)', color: 'var(--p-bg)', fontWeight: '600', borderColor: 'var(--p-gold)' }}
                onClick={() => { alert('Proposal sent successfully!'); setStep(1); setQuantities({}); setClientForm({ orgName: '', contactName: '', siteAddress: '', contactEmail: '' }); }}
              >
                Confirm & Send Proposal
              </button>
              <button className="prop-discard" onClick={() => setStep(3)}>Back to draft</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
