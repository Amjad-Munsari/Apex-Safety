'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { draftProposalScope, createProposal, deleteProposal } from '@/app/admin/proposals/actions';
import { Service, groupByCategory } from '@/lib/data/services';

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

function formatPrice(amount: number | null): string {
  if (amount === null) return '—';
  if (amount < 1) return `£${amount}`;
  if (amount % 1 !== 0) return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  return `£${amount.toLocaleString('en-GB')}`;
}

/** Parse an override price string. Returns null if blank or not a positive number. */
function parseOverride(input: string | undefined): number | null {
  if (input === undefined) return null;
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
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
  services: initialServices,
}: {
  clients: Client[]
  services: Service[]
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const services = useMemo(
    () => initialServices.filter(s => s.active),
    [initialServices]
  );
  const categories = useMemo(() => groupByCategory(services), [services]);

  const [step, setStep] = useState(1);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  // Id of the auto-saved draft row. Set the moment the proposal is first
  // generated (step 3) and reused on every Save-as-draft / Send so one proposal
  // never spawns duplicate rows. Cleared on Discard.
  const [proposalId, setProposalId] = useState<string | null>(null);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  // Per-proposal price overrides for services with unit_price === null
  // (quote-on-request). Stored as raw string so partial input ("3.5") works.
  const [overridePrices, setOverridePrices] = useState<Record<string, string>>({});
  const [scopeText, setScopeText] = useState("");
  const scopeTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the scope textarea to fit its content. Textareas don't size to
  // content natively, so without this the AI draft arrives clipped behind a
  // manual resize handle. Runs on every scopeText change (AI draft + typing)
  // and on step change, since the textarea only mounts visibly on step 3.
  useEffect(() => {
    const el = scopeTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [scopeText, step]);

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
  /**
   * Line item shape — `effective_price` is what gets used for math and
   * persisted to services_json. It is the catalog price for normal services,
   * or the admin's per-proposal override for quote-on-request services.
   * `needsOverride` is true when the service is quote-on-request and no valid
   * override has been entered yet — used to gate the "Generate proposal" button.
   */
  const lineItems = useMemo(() => {
    return Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const service = services.find(s => s.id === id)!;
        const override = parseOverride(overridePrices[id]);
        const effective_price =
          service.unit_price !== null ? service.unit_price : override;
        const needsOverride =
          service.unit_price === null && override === null;
        return {
          ...service,
          quantity: qty,
          effective_price,
          needsOverride,
          total: effective_price !== null ? effective_price * qty : 0,
        };
      });
  }, [quantities, services, overridePrices]);

  const hasUnpricedItem = lineItems.some(item => item.needsOverride);
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const vat = subtotal * 0.2;
  const total = subtotal + vat;
  const selectedClient = clients.find(c => c.id === selectedClientId) ?? null;
  const clientName = selectedClient?.name ?? 'Client';
  const canProceed = selectedClientId !== null;

  /* Handlers */
  const updateQty = (id: string, delta: number) => {
    setQuantities(prev => {
      const next = Math.max(0, (prev[id] || 0) + delta);
      return { ...prev, [id]: next };
    });
  };

  const selectClient = (client: Client) => {
    setSelectedClientId(client.id);
  };

  const handleDraftScope = async () => {
    setIsDrafting(true);
    try {
      const selectedSvcs = lineItems.map(item => services.find(s => s.id === item.id)!);
      const draft = await draftProposalScope(selectedSvcs);
      setScopeText(draft);

      // Auto-save the draft so it persists even if the admin navigates away
      // without clicking "Save as draft". Reuses proposalId on regeneration so
      // it never creates duplicate rows. Non-fatal: if the save fails the scope
      // is still on screen and the admin can save manually.
      if (selectedClientId) {
        try {
          const id = await createProposal({
            clientId: selectedClientId,
            servicesJson: buildServicesJson(),
            scopeText: draft,
            subtotal,
            saveAsDraft: true,
            proposalId: proposalId ?? undefined,
          });
          if (id) setProposalId(id);
          toast.success("Draft saved", {
            description: "It's in the Draft column of the proposals pipeline.",
          });
        } catch (saveErr: any) {
          toast.error(saveErr?.message || "Drafted, but couldn't auto-save. Use “Save as draft”.");
        }
      } else {
        toast.success("Scope drafted");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to draft scope");
      setScopeText("We will provide the listed services as agreed. Please review the itemized quote below.");
    } finally {
      setIsDrafting(false);
    }
  };

  const buildServicesJson = () =>
    lineItems.map(item => ({
      service: {
        name: item.name,
        description: item.description ?? '',
        unit_price: item.effective_price ?? 0,
      },
      quantity: item.quantity,
    }));

  const handleSend = async () => {
    if (!selectedClientId) {
      toast.error("You must select an existing client to generate the PDF properly right now.");
      return;
    }

    setIsGenerating(true);
    try {
      await createProposal({
        clientId: selectedClientId,
        servicesJson: buildServicesJson(),
        scopeText,
        // Pass the pre-VAT subtotal — createProposal computes VAT and total
        // internally and stores the VAT-inclusive total in total_price.
        subtotal,
        // Reuse the auto-saved draft so sending doesn't create a duplicate row.
        proposalId: proposalId ?? undefined,
      });

      toast.success("Proposal sent & PDF Generated!");
      router.push(`/admin/clients/${selectedClientId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create proposal");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAsDraft = async () => {
    if (!selectedClientId) {
      toast.error("Pick an existing client before saving a draft.");
      return;
    }
    setIsGenerating(true);
    try {
      await createProposal({
        clientId: selectedClientId,
        servicesJson: buildServicesJson(),
        scopeText,
        subtotal,
        saveAsDraft: true,
        proposalId: proposalId ?? undefined,
      });
      toast.success("Saved as draft", {
        description: "Find it in the Draft column of the proposals pipeline.",
      });
      router.push("/admin/proposals");
    } catch (err: any) {
      toast.error(err.message || "Failed to save draft");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="prop-shell">
      {/* ═══ Main Header ═══ */}
      <header className="prop-header">
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
                // Delete the auto-saved draft so discarding doesn't leave an
                // orphan row in the pipeline. Best-effort — reset the wizard
                // regardless of whether the delete succeeds.
                const toRemove = proposalId;
                setStep(1);
                setQuantities({});
                setOverridePrices({});
                setSelectedClientId(null);
                setScopeText("");
                setProposalId(null);
                if (toRemove) {
                  deleteProposal(toRemove).catch(() => {
                    /* best-effort cleanup; ignore */
                  });
                }
              }}
            >
              Discard draft
            </button>
          )}
          <div className="prop-user">
            <div className="prop-user-info">
              <span className="prop-user-name">Matt Robinson</span>
              <span className="prop-user-role">Lead Consultant</span>
            </div>
            <div className="prop-avatar">MR</div>
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
            <button className="prop-btn-secondary" onClick={() => setStep(2)} disabled={isGenerating}>Edit services</button>
            <button className="prop-btn-secondary" onClick={handleSaveAsDraft} disabled={isGenerating}>
              {isGenerating ? "Saving…" : "Save as draft"}
            </button>
            <button className="prop-btn-primary" onClick={() => setStep(4)} disabled={isGenerating}>Send for e-signature →</button>
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
              Pick the client this proposal is for. You&apos;ll choose services next, then we&apos;ll
              draft a branded one-pager ready to send.
            </p>

            <div className="prop-existing-clients">
              <div
                className="prop-label"
                style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
              >
                <span>SELECT CLIENT</span>
                <a
                  href="/admin/clients"
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--p-font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.2em',
                    color: 'var(--p-gold)',
                    textDecoration: 'none',
                  }}
                >
                  + New client →
                </a>
              </div>
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
                  <div className="text-white/50 text-sm" style={{ gridColumn: '1 / -1' }}>
                    No clients yet. <a href="/admin/clients" style={{ color: 'var(--p-gold)' }}>Add one in the client list →</a>
                  </div>
                )}
              </div>
            </div>

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
                            {svc.unit_price === null ? (
                              <span
                                className="prop-service-price"
                                style={{ color: 'var(--p-text-muted)' }}
                              >
                                —
                              </span>
                            ) : (
                              <>
                                <span className="prop-service-price">{formatPrice(svc.unit_price)}</span>
                                <span className="prop-service-unit">/ {svc.unit}</span>
                              </>
                            )}
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
                  {lineItems.map(item => {
                    // Quote-on-request services keep the price input editable
                    // for the lifetime of the proposal — Matt can correct a
                    // typo at any point. The button-level gating
                    // (`hasUnpricedItem`) handles the "must be set before
                    // continuing" rule independently.
                    const isQuoteItem = item.unit_price === null;
                    return (
                      <div key={item.id} className="prop-line-item-entry">
                        <div>
                          <span className="prop-line-item-name">{item.name}</span>
                          <span className="prop-line-item-qty"> ×{item.quantity}</span>
                        </div>
                        {isQuoteItem ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                color: item.needsOverride ? '#c55a5a' : 'var(--p-text-muted)',
                                fontSize: 9,
                                fontFamily: 'var(--p-font-mono)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                              }}
                            >
                              £
                            </span>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              placeholder="0"
                              value={overridePrices[item.id] ?? ''}
                              onChange={e => setOverridePrices(prev => ({ ...prev, [item.id]: e.target.value }))}
                              style={{
                                width: 84,
                                padding: '4px 8px',
                                fontSize: 12,
                                fontFamily: 'var(--p-font-mono)',
                                background: 'transparent',
                                border: `1px solid ${item.needsOverride ? '#c55a5a' : 'rgba(255,255,255,0.15)'}`,
                                borderRadius: 3,
                                color: 'var(--p-text)',
                                textAlign: 'right',
                                colorScheme: 'dark',
                              }}
                            />
                            <span style={{ color: 'var(--p-text-muted)', fontSize: 10 }}>/ {item.unit}</span>
                            {!item.needsOverride && (
                              <span
                                className="prop-line-item-total"
                                style={{ marginLeft: 8, fontSize: 11 }}
                              >
                                = {formatTotal(item.total)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="prop-line-item-total">{formatTotal(item.total)}</span>
                        )}
                      </div>
                    );
                  })}
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

              <button
                className="prop-generate-btn"
                disabled={lineItems.length === 0 || hasUnpricedItem}
                onClick={() => setStep(3)}
              >
                + Generate proposal
              </button>
              {hasUnpricedItem ? (
                <div className="prop-generate-note" style={{ color: '#c55a5a' }}>
                  Enter a price for the highlighted items before generating.
                </div>
              ) : (
                <div className="prop-generate-note">
                  AI-drafts intro + terms · Review before sending
                </div>
              )}
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
                          {selectedClient?.address || 'Address TBD'}<br />
                          Attn: {selectedClient?.contactName || 'Contact TBD'}
                        </div>
                      </div>
                      <div>
                        <div className="prop-paper-meta-label">PREPARED BY</div>
                        <div className="prop-paper-meta-name">Matt Robinson</div>
                        <div className="prop-paper-meta-detail">
                          Lead Consultant · 888 Safety Solutions<br />
                          888FST@proton.me · 0114 555 0188
                        </div>
                      </div>
                    </div>

                    <div className="prop-paper-title">Scope & proposal.</div>
                    
                    {/* EDITABLE SCOPE TEXTAREA */}
                    <div className="prop-paper-text">
                      <textarea
                        ref={scopeTextareaRef}
                        value={scopeText}
                        onChange={(e) => setScopeText(e.target.value)}
                        placeholder="Scope text will appear here once drafted..."
                        className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-gray-300 focus:bg-[#fafafa] rounded transition-all resize-none overflow-hidden min-h-[120px] outline-none text-[#1a1a1a] caret-[#1a1a1a] placeholder:text-[#a8a39d]"
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: '17px',
                          lineHeight: '1.6',
                          color: '#1a1a1a',
                          colorScheme: 'light',
                        }}
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
                          <span className="prop-paper-sig-img">Matt Robinson</span>
                        </div>
                        <div className="prop-paper-sig-meta">
                          <span>Matt Robinson, Lead Consultant</span>
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
              <p style={{ fontSize: '16px', fontWeight: '500' }}>{selectedClient?.contactName || 'Client Contact'}</p>
              <p style={{ fontSize: '14px', color: 'var(--p-text-secondary)' }}>{selectedClient?.contactEmail || 'Not provided'}</p>
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
