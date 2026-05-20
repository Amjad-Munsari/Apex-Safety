'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { startAssessment } from '@/app/admin/assessments/actions';

export type AssessmentClient = {
  id: string;
  name: string;
  contactName?: string;
  contactEmail?: string;
  address?: string;
};

export type AssessmentTemplate = {
  /** template_versions.id — what startAssessment() needs */
  id: string;
  /** form_templates.name */
  name: string;
  /** template_versions.version_number */
  version: number;
  /** template_versions.published_at — for display */
  publishedAt: string | null;
};

const STEPS = [
  { number: 1, label: 'CLIENT' },
  { number: 2, label: 'TEMPLATE' },
  { number: 3, label: 'REVIEW' },
];

export function AdvancedAssessmentBuilder({
  clients,
  templates,
  initialClientId,
  initialTemplateVersionId,
}: {
  clients: AssessmentClient[];
  templates: AssessmentTemplate[];
  initialClientId?: string | null;
  initialTemplateVersionId?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialClientId ?? null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    initialTemplateVersionId ?? null
  );
  const [isStarting, setIsStarting] = useState(false);

  // If both query params were present, fast-forward to review.
  useEffect(() => {
    if (initialClientId && initialTemplateVersionId) {
      setStep(3);
    } else if (initialClientId && !initialTemplateVersionId) {
      setStep(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Allow ?clientId=X later in lifecycle (e.g. from "+ New client" returning here)
  useEffect(() => {
    const qpClient = searchParams?.get('clientId');
    if (qpClient && !selectedClientId) {
      setSelectedClientId(qpClient);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const selectedClient = clients.find(c => c.id === selectedClientId) ?? null;
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) ?? null;
  const clientName = selectedClient?.name ?? 'Client';

  const canContinueFromClient = selectedClientId !== null;
  const canContinueFromTemplate = selectedTemplateId !== null;
  const canStart = canContinueFromClient && canContinueFromTemplate && !isStarting;

  const discardDraft = () => {
    setStep(1);
    setSelectedClientId(null);
    setSelectedTemplateId(null);
  };

  const handleStart = async () => {
    if (!selectedClientId || !selectedTemplateId) return;
    setIsStarting(true);
    try {
      // startAssessment() is a server action that creates the draft submission
      // and calls redirect() to /admin/assessments/[id]. The browser navigates
      // before this promise resolves, so we don't reset isStarting on success.
      await startAssessment(selectedClientId, selectedTemplateId);
    } catch (err: any) {
      // A redirect thrown from a server action surfaces here as a benign
      // NEXT_REDIRECT error — let it propagate so Next.js can complete the
      // navigation. Only real failures should toast.
      if (err?.message?.includes('NEXT_REDIRECT')) {
        throw err;
      }
      console.error('startAssessment failed:', err);
      toast.error(err?.message || 'Failed to start assessment');
      setIsStarting(false);
    }
  };

  return (
    <div className="prop-shell">
      {/* ═══ Main Header ═══ */}
      <header className="prop-header">
        <div className="prop-header-left">
          <span className="prop-logo">888</span>
          <span className="prop-brand">SAFETY SOLUTIONS · ASSESSMENTS</span>
        </div>

        <nav className="prop-stepper">
          {STEPS.map((s, i) => (
            <div key={s.number} className="prop-step-wrapper">
              {i > 0 && <div className={`prop-step-line ${step >= s.number ? 'completed' : ''}`} />}
              <button
                className={`prop-step ${step === s.number ? 'active' : ''} ${step > s.number ? 'completed' : ''}`}
                onClick={() => { if (s.number <= step) setStep(s.number as 1 | 2 | 3); }}
              >
                <span className="prop-step-number">{s.number}</span>
                <span className="prop-step-label">{s.label}</span>
              </button>
            </div>
          ))}
        </nav>

        <div className="prop-header-right">
          {step > 1 && (
            <button className="prop-discard" onClick={discardDraft}>
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

      {/* ═══ Content ═══ */}
      <div className="prop-content">

        {/* ──────── STEP 1: CLIENT ──────── */}
        {step === 1 && (
          <div className="prop-client-step">
            <div className="prop-breadcrumb">ASSESSMENTS · NEW</div>
            <h1 className="prop-heading">Start a new assessment.</h1>
            <p className="prop-description">
              Pick the client this assessment is for. You&apos;ll choose the template next,
              then begin filling it in.
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
                    onClick={() => setSelectedClientId(client.id)}
                  >
                    <div className="prop-client-card-name">{client.name}</div>
                    <div className="prop-client-card-address">{client.address || 'Address not provided'}</div>
                    <div className="prop-client-card-contact">
                      {client.contactName || 'No contact'} · <span>{client.contactEmail || 'No email'}</span>
                    </div>
                  </button>
                ))}
                {clients.length === 0 && (
                  <div className="text-white/50 text-sm" style={{ gridColumn: '1 / -1' }}>
                    No clients yet.{' '}
                    <a href="/admin/clients" style={{ color: 'var(--p-gold)' }}>
                      Add one in the client list →
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="prop-step-actions">
              <button
                className="prop-btn-next"
                disabled={!canContinueFromClient}
                onClick={() => setStep(2)}
              >
                Choose template <span className="arrow">→</span>
              </button>
            </div>
          </div>
        )}

        {/* ──────── STEP 2: TEMPLATE ──────── */}
        {step === 2 && (
          <div className="prop-client-step">
            <button className="prop-back-link" onClick={() => setStep(1)}>
              ← Back to client
            </button>
            <div className="prop-breadcrumb">STEP 2 · CHOOSE TEMPLATE</div>
            <h1 className="prop-heading">Which assessment for {clientName}?</h1>
            <p className="prop-description">
              Templates are the published forms Matt has built. Pick the one that matches the
              work — you&apos;ll fill it in on the next screen.
            </p>

            <div className="prop-existing-clients">
              <div className="prop-label" style={{ marginBottom: '16px' }}>SELECT TEMPLATE</div>
              <div className="prop-client-grid">
                {templates.map(t => (
                  <button
                    key={t.id}
                    className={`prop-client-card ${selectedTemplateId === t.id ? 'selected' : ''}`}
                    onClick={() => setSelectedTemplateId(t.id)}
                  >
                    <div className="prop-client-card-name">{t.name}</div>
                    <div className="prop-client-card-address">
                      Version {t.version}
                      {t.publishedAt && (
                        <> · published {new Date(t.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                      )}
                    </div>
                  </button>
                ))}
                {templates.length === 0 && (
                  <div className="text-white/50 text-sm" style={{ gridColumn: '1 / -1' }}>
                    No published templates yet.{' '}
                    <a href="/admin/templates" style={{ color: 'var(--p-gold)' }}>
                      Build one in the template editor →
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="prop-step-actions">
              <button
                className="prop-btn-next"
                disabled={!canContinueFromTemplate}
                onClick={() => setStep(3)}
              >
                Review &amp; start <span className="arrow">→</span>
              </button>
            </div>
          </div>
        )}

        {/* ──────── STEP 3: REVIEW ──────── */}
        {step === 3 && (
          <div className="prop-client-step" style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
            <button className="prop-back-link" onClick={() => setStep(2)}>
              ← Back to template
            </button>
            <div className="prop-breadcrumb">STEP 3 · REVIEW</div>
            <h1 className="prop-heading">Ready to begin?</h1>
            <p className="prop-description">
              We&apos;ll create a draft submission and take you to the form. You can save partial
              progress at any time and come back.
            </p>

            <div
              style={{
                background: 'var(--p-surface)',
                border: '1px solid var(--p-border)',
                borderRadius: 8,
                padding: 28,
                margin: '32px auto',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <div className="prop-label" style={{ marginBottom: 6 }}>CLIENT</div>
                  <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--p-text)' }}>
                    {selectedClient?.name ?? '—'}
                  </div>
                  {selectedClient?.address && (
                    <div style={{ fontSize: 13, color: 'var(--p-text-muted)', marginTop: 2 }}>
                      {selectedClient.address}
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--p-border-subtle)' }} />

                <div>
                  <div className="prop-label" style={{ marginBottom: 6 }}>TEMPLATE</div>
                  <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--p-text)' }}>
                    {selectedTemplate?.name ?? '—'}
                  </div>
                  {selectedTemplate && (
                    <div style={{ fontSize: 13, color: 'var(--p-text-muted)', marginTop: 2 }}>
                      Version {selectedTemplate.version}
                      {selectedTemplate.publishedAt && (
                        <>
                          {' '}· published {new Date(selectedTemplate.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                className="prop-btn-next"
                disabled={!canStart}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  background: 'var(--p-gold)',
                  color: 'var(--p-bg)',
                  fontWeight: 600,
                  borderColor: 'var(--p-gold)',
                  opacity: isStarting ? 0.7 : 1,
                }}
                onClick={handleStart}
              >
                {isStarting ? 'Starting…' : 'Begin assessment'}
              </button>
              <button
                className="prop-discard"
                onClick={() => setStep(2)}
                disabled={isStarting}
              >
                Back to template
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
