-- A proposal's commercial terms and original PDF become immutable when it is
-- sent for signature. The signature attests to the original PDF hash, while the
-- generated contract reads services_json and total_price; both representations
-- must remain the same from send through contract issuance.

create or replace function public.prevent_sent_proposal_material_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('Sent', 'Signed', 'Contract Issued') then
    if new.client_id is distinct from old.client_id
       or new.services_json is distinct from old.services_json
       or new.total_price is distinct from old.total_price
       or new.proposal_pdf_path is distinct from old.proposal_pdf_path
       or (
         old.signing_document_hash is not null
         and new.signing_document_hash is distinct from old.signing_document_hash
       )
    then
      raise exception 'Sent proposal terms and source document are immutable'
        using errcode = '55000';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists proposals_prevent_sent_material_change
  on public.proposals;

create trigger proposals_prevent_sent_material_change
before update on public.proposals
for each row
execute function public.prevent_sent_proposal_material_change();

revoke all on function public.prevent_sent_proposal_material_change()
  from public, anon, authenticated;
