import { adminClient } from '@/lib/supabase/admin';
import { AdvancedProposalBuilder } from '@/components/proposals/advanced-proposal-builder';
import { fetchActiveServices } from '@/lib/data/services-server';

export const metadata = {
  title: 'New Proposal | 888 Safety Solutions',
};

export const dynamic = 'force-dynamic';

export default async function NewProposalPage() {
  const [clientsResult, services] = await Promise.all([
    adminClient
      .from('clients')
      .select('id, name, site_address, contact_name, contact_email')
      .is('deleted_at', null)
      // Deactivated clients are frozen — keep them out of the proposal picker
      // (the createProposal server action also blocks them).
      .eq('active', true)
      .order('name', { ascending: true }),
    fetchActiveServices(),
  ]);

  if (clientsResult.error) {
    console.error('Error fetching clients:', clientsResult.error);
  }

  // Map snake_case DB columns to the camelCase shape AdvancedProposalBuilder expects.
  const clients = (clientsResult.data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    address: row.site_address ?? undefined,
    contactName: row.contact_name ?? undefined,
    contactEmail: row.contact_email ?? undefined,
  }));

  return (
    <AdvancedProposalBuilder
      clients={clients}
      services={services}
    />
  );
}
