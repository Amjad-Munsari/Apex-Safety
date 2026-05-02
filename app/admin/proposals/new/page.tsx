import { adminClient } from '@/lib/supabase/admin';
import { AdvancedProposalBuilder } from '@/components/proposals/advanced-proposal-builder';

export const metadata = {
  title: 'New Proposal | 888 Safety Solutions',
};

export default async function NewProposalPage() {
  // Clients still come from the DB. Services are read client-side from the
  // shared catalog (lib/data/services) so /admin/services and the proposal
  // builder are guaranteed to see the same list.
  const { data: clients, error: clientsError } = await adminClient
    .from('clients')
    .select('id, name')
    .order('name', { ascending: true });

  if (clientsError) {
    console.error('Error fetching clients:', clientsError);
  }

  return <AdvancedProposalBuilder clients={clients || []} />;
}
