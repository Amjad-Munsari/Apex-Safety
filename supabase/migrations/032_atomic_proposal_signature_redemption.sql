-- Redeem a one-time proposal signing token and persist its signature evidence
-- in one database transaction. The route prepares and stores the stamped PDF
-- first; this function is the commit point that links that immutable artefact,
-- consumes the token, advances the lifecycle, and inserts the audit row.

create or replace function public.redeem_proposal_signature(
  p_token_hash text,
  p_expected_document_hash text,
  p_expected_pdf_path text,
  p_signer_name text,
  p_signer_email text,
  p_signature_image text,
  p_ip_address inet,
  p_user_agent text,
  p_signed_pdf_path text,
  p_signed_document_hash text,
  p_signed_at timestamptz
)
returns table (
  proposal_id uuid,
  client_id uuid,
  services_json jsonb,
  proposal_pdf_path text,
  signing_document_hash text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.proposals%rowtype;
begin
  if length(btrim(p_signer_name)) not between 1 and 120
     or length(btrim(p_signer_email)) not between 3 and 254
     or p_signature_image not like 'data:image/png;base64,%'
     or p_expected_document_hash !~ '^[0-9a-f]{64}$'
     or p_signed_document_hash !~ '^[0-9a-f]{64}$'
     or p_expected_pdf_path is null
     or p_signed_pdf_path is null
  then
    raise exception 'Invalid proposal signature evidence'
      using errcode = '22023';
  end if;

  update public.proposals p
     set signing_token_used = true,
         status = 'Signed',
         signed_at = p_signed_at,
         signed_pdf_path = p_signed_pdf_path,
         signed_document_hash = p_signed_document_hash
   where p.signing_token = p_token_hash
     and p.signing_token_used = false
     and p.signing_token_expires_at > p_signed_at
     and p.signing_document_hash = p_expected_document_hash
     and p.proposal_pdf_path = p_expected_pdf_path
  returning p.* into v_proposal;

  if not found then
    return;
  end if;

  insert into public.proposal_signatures (
    proposal_id,
    signer_name,
    signer_email,
    signature_image,
    ip_address,
    user_agent,
    document_hash,
    signed_at
  )
  values (
    v_proposal.id,
    btrim(p_signer_name),
    btrim(p_signer_email),
    p_signature_image,
    p_ip_address,
    p_user_agent,
    p_expected_document_hash,
    p_signed_at
  );

  return query
  select
    v_proposal.id,
    v_proposal.client_id,
    v_proposal.services_json,
    v_proposal.proposal_pdf_path,
    v_proposal.signing_document_hash;
end;
$$;

revoke all on function public.redeem_proposal_signature(
  text, text, text, text, text, text, inet, text, text, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.redeem_proposal_signature(
  text, text, text, text, text, text, inet, text, text, text, timestamptz
) to service_role;
