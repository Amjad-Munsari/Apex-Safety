'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { draftProposalScope, createProposal } from '@/app/admin/proposals/actions';
import { Service, groupByCategory, useServices } from '@/lib/data/services';

export type Client = {
  id: string;
  name: string;
  // Fallbacks since these aren't in DB yet
  contactName?: string;
  contactEmail?: string;
  address?: string;
}

export type { Service };

export interface CategoryGroup {
  title: string;
  services: Service[];
}

function formatPrice(amount: number): string {
  if (amount < 1) return `£${amount}`;
  if (amount % 1 !== 0) return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  return `£${amount.toLocaleString('en-GB')}`;
}

function formatTotal(amount: number): string {
  return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STEPS = [
  { number: 1, label: 'CLIENT' },
  { number: 2, label: 'SERVICES' },
  { number: 3, label: 'DRAFT' },
  { number: 4, label: 'SEND' },
];

export function AdvancedProposalBuilder({
  clients,
}: {
  clients: Client[]
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read live from the shared services store; only show active entries.
  const allServices = useServices();
  const services = useMemo(() => allServices.filter(s => s.active), [allServices]);
  const categories = useMemo(() => groupByCategory(services), [services]);

  const [step, setStep] = useState(1);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [clientTab, setClientTab] = useState<'existing' | 'new'>('existing');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState({
    orgName: '',
    contactName: '',
    siteAddress: '',
    contactEmail: '',
  });

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [scopeText, setScopeText] = useState("");

  // When step changes to 3, trigger AI drafting if scopeText is empty
  useEffect(() => {
    if (step === 3 && !scopeText && !isDrafting) {
      handleDraftScope();
    }
  }, [step]);

  // Prefill from /admin/proposals/[id] "Edit" — preselects the client on step 1.
  useEffect(() => {
    const prefillId = searchParams?.get('clientId');
    if (!prefillId || selectedClientId) return;
    const match = clients.find(c => c.id === prefillId);
    if (match) selectClient(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, clients]);

  /* Computed */
  const lineItems = useMemo(() => {
    return Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const service = services.find(s => s.id === id)!;
        return { ...service, quantity: qty, total: service.unit_price * qty };
      });
  }, [quantities, services]);

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
    setSelectedClientId(client.id);
    setClientForm({
      orgName: client.name,
      contactName: client.contactName || '',
      siteAddress: client.address || '',
      contactEmail: client.contactEmail || '',
    });
  };

  const handleDraftScope = async () => {
    setIsDrafting(true);
    try {
      const selectedSvcs = lineItems.map(item => services.find(s => s.id === item.id)!);
      const draft = await draftProposalScope(selectedSvcs);
      setScopeText(draft);
      toast.success("Draft generated");
    } catch (err: any) {
      toast.error(err.message || "Failed to draft scope");
      setScopeText("We will provide the listed services as agreed. Please review the itemized quote below.");
    } finally {
      setIsDrafting(false);
    }
  };

  const handleSend = async () => {
    if (!selectedClientId) {
      toast.error("You must select an existing client to generate the PDF properly right now.");
      return;
    }
    
    setIsGenerating(true);
    try {
      const servicesJson = lineItems.map(item => ({
        service: { name: item.name, unit_price: item.unit_price },
        quantity: item.quantity
      }));
      
      await createProposal({
        clientId: selectedClientId,
        servicesJson,
        scopeText,
        totalAmount: subtotal // Storing subtotal as requested previously, or total if preferred
      });
      
      toast.success("Proposal sent & PDF Generated!");
      router.push(`/admin/clients/${selectedClientId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create proposal");
    } finally {
      setIsGenerating(false);
    }
  };

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
                setSelectedClientId(null);
                setClientForm({ orgName: '', contactName: '', siteAddress: '', contactEmail: '' });
                setClientTab('existing');
                setScopeText("");
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
            <div className="prop-doc-meta">PROPOSAL P-2026-NEW · DRAFT</div>
            <div className="prop-doc-client">{clientName}</div>
          </div>
          <div className="prop-doc-actions">
            <button className="prop-btn-secondary" onClick={() => setStep(2)}>Edit services</button>
            <button className="prop-btn-secondary" onClick={handleDraftScope}>+ Regenerate</button>
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
                onClick={() => {
                  setClientTab('new');
                  setSelectedClientId(null);
                  setClientForm({ orgName: '', contactName: '', siteAddress: '', contactEmail: '' });
                }}
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
                  {clients.map(client => (
                    <button
                      key={client.id}
                      className={`prop-client-card ${selectedClientId === client.id ? 'selected' : ''}`}
                      onClick={() => selectClient(client)}
                    >
                      <div className="prop-client-card-name">{client.name}</div>
                      <div className="prop-client-card-address">{client.address || "Address not provided"}</div>
                      <div className="prop-client-card-contact">
                        {client.contactName || "No contact"} · <span>{client.contactEmail || "No email"}</span>
                      </div>
                    </button>
                  ))}
                  {clients.length === 0 && (
                    <div className="text-white/50 text-sm">No clients found in the database.</div>
                  )}
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

              {categories.map((cat, i) => (
                <div key={cat.title} className="prop-category">
                  <div className="prop-category-header">
                    <span className="prop-category-number">{(i + 1).toString().padStart(2, '0')}</span>
                    <span className="prop-category-title">{cat.title}</span>
                  </div>

                  {cat.services.map(svc => {
                    const qty = quantities[svc.id] || 0;
                    return (
                      <div key={svc.id} className="prop-service-row">
                        <div className="prop-service-info">
                          <div className="prop-service-name">{svc.name}</div>
                          <div className="prop-service-desc">{svc.description || "No description."}</div>
                        </div>
                        <div className="prop-service-pricing">
                          <div className="prop-service-price-block">
                            <span className="prop-service-price">{formatPrice(svc.unit_price)}</span>
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
                  Pulling your 888 one-pager template, inserting scope, drafting intro copy.
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
                        <div className="prop-paper-id">P-2026-NEW</div>
                        <div className="prop-paper-date">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                      </div>
                    </div>

                    <div className="prop-paper-grid">
                      <div>
                        <div className="prop-paper-meta-label">PREPARED FOR</div>
                        <div className="prop-paper-meta-name">{clientName}</div>
                        <div className="prop-paper-meta-detail">
                          {clientForm.siteAddress || 'Address TBD'}<br />
                          Attn: {clientForm.contactName || 'Contact TBD'}
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
                    
                    {/* EDITABLE SCOPE TEXTAREA */}
                    <div className="prop-paper-text">
                      <textarea
                        value={scopeText}
                        onChange={(e) => setScopeText(e.target.value)}
                        placeholder="Scope text will appear here once drafted..."
                        className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-gray-300 focus:bg-[#fafafa] rounded transition-all resize-y min-h-[120px] outline-none placeholder:text-[#a8a39d]"
                        style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', lineHeight: '1.6', color: '#1a1a1a' }}
                      />
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
                              <div className="prop-paper-svc-desc">{item.description}</div>
                            </td>
                            <td>{item.quantity}</td>
                            <td>{formatPrice(item.unit_price)}</td>
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
                      <span>Page 1 of 1</span>
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
              The proposal for {clientName} will be generated as a PDF, saved to your records, and prepared for dispatch.
            </p>
            
            <div style={{ background: 'var(--p-surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--p-border)', marginBottom: '40px' }}>
              <p style={{ fontSize: '13px', color: 'var(--p-text-muted)', marginBottom: '8px' }}>RECIPIENT</p>
              <p style={{ fontSize: '16px', fontWeight: '500' }}>{clientForm.contactName || 'Client Contact'}</p>
              <p style={{ fontSize: '14px', color: 'var(--p-text-secondary)' }}>{clientForm.contactEmail || 'Not provided'}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                className="prop-btn-next"
                disabled={isGenerating}
                style={{ width: '100%', justifyContent: 'center', background: 'var(--p-gold)', color: 'var(--p-bg)', fontWeight: '600', borderColor: 'var(--p-gold)', opacity: isGenerating ? 0.7 : 1 }}
                onClick={handleSend}
              >
                {isGenerating ? "Generating PDF & Saving..." : "Confirm & Send Proposal"}
              </button>
              <button className="prop-discard" onClick={() => setStep(3)} disabled={isGenerating}>Back to draft</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
