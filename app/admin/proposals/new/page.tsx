import { adminClient } from '@/lib/supabase/admin';
import { AdvancedProposalBuilder } from '@/components/proposals/advanced-proposal-builder';

export const metadata = {
  title: 'New Proposal | 888 Safety Solutions',
};

export default async function NewProposalPage() {
  // Fetch all existing clients
  const { data: clients, error: clientsError } = await adminClient
    .from('clients')
    .select('id, name')
    .order('name', { ascending: true });

  if (clientsError) {
    console.error('Error fetching clients:', clientsError);
  }

  // Fetch all active services
  const { data: services, error: servicesError } = await adminClient
    .from('services')
    .select('id, name, description, unit_price, category')
    .eq('active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (servicesError) {
    console.error('Error fetching services:', servicesError.message, servicesError);
  }

  return (
    <AdvancedProposalBuilder 
      clients={clients || []} 
      services={services || []} 
    />
  );
}
