-- 038_email_outbox.sql
--
-- A durable record of every transactional email the platform tries to send.
--
-- Why this exists alongside `workflow_errors` and `app_error_log`:
--   Before this table, a *failed* send wrote a workflow_errors row and a
--   successful send wrote nothing at all. There was no way to answer "was the
--   signature confirmation ever delivered?", no attempt count, and — worst — no
--   way to re-send, because the payload that produced the email was gone the
--   moment the request ended. Matt's only recovery was to redo the whole
--   business action.
--   `email_outbox` holds one row per logical email, from the first attempt to
--   final outcome: recipient, type, status, attempt count, timestamps, the last
--   error and whether that error is worth retrying. The payload is kept so a
--   later attempt can rebuild the exact same message.
--
-- Access:
--   Writes are service-role only — the dispatcher runs server-side under the
--   service key, exactly like the logger in 037. Admins get SELECT through the
--   policy below, but only on the operational columns: `payload` is deliberately
--   left out of the column grant because signing, invite and reset payloads
--   carry access-granting URLs. Re-sending goes through a server action running
--   under the service role, which can read the payload; nothing in the browser
--   ever sees it.

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- NotificationPayload["type"], e.g. 'proposal_signed'. Free text so a new
  -- notification needs no migration, bounded so it stays greppable.
  notification_type text not null
    check (char_length(notification_type) between 1 and 120),

  -- Nullable on purpose: a payload that reached dispatch with no usable address
  -- still gets a row, because "we never had an address for this client" is the
  -- single most useful thing this table can tell Matt.
  recipient text check (recipient is null or char_length(recipient) <= 320),
  subject text check (subject is null or char_length(subject) <= 500),

  --   pending    row created, no attempt made yet
  --   sending    an attempt is in flight (the claim that stops double-sends)
  --   sent       the provider accepted the message
  --   failed     the retry budget is spent on a transient error; another
  --              attempt could still succeed, so a re-send is offered
  --   abandoned  hard rejection — the same attempt would fail identically, so
  --              nothing automatic will ever try again
  --   skipped    deliberately not sent (no provider configured outside prod)
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'abandoned', 'skipped')),

  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts >= 1),

  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  sent_at timestamptz,

  last_error text check (last_error is null or char_length(last_error) <= 4000),

  -- How the last error was classified. 'hard' rows are never retried
  -- automatically: an invalid recipient or a rejected API key fails identically
  -- however many times it is tried, and retrying only burns the request budget.
  last_error_kind text check (last_error_kind in ('transient', 'hard')),

  -- Stable key passed to the provider so a retry of an already-accepted message
  -- cannot produce a second email. Also the dedupe key on our side: a second
  -- dispatch carrying the same key reuses this row instead of creating one.
  idempotency_key text check (idempotency_key is null or char_length(idempotency_key) <= 256),

  -- Everything needed to rebuild the message on a later attempt. NOT covered by
  -- the column grant below — see the access note at the top of this file.
  payload jsonb not null default '{}'::jsonb,

  -- False for notifications whose body carries a single-use action link (portal
  -- invites, password resets). The recorded attempt is still valuable, but a
  -- later re-send would mail a link that may already be spent; those go back
  -- through the admin flow that mints a fresh one.
  resend_allowed boolean not null default true,

  provider text not null default 'resend',
  provider_message_id text,

  client_id uuid,        -- deliberately NOT a foreign key: the delivery record
                         -- must survive deletion of the org it refers to.
  related_type text check (related_type is null or char_length(related_type) <= 60),
  related_id uuid
);

comment on table public.email_outbox is
  'One row per transactional email, successful or not: status, recipient, attempts, last error, and the payload needed to re-send.';
comment on column public.email_outbox.status is
  'pending | sending | sent | failed | abandoned | skipped. "sending" is the claim that prevents concurrent double-sends.';
comment on column public.email_outbox.last_error_kind is
  'transient errors are retried within the bounded budget; hard rejections never are.';
comment on column public.email_outbox.payload is
  'Full notification payload, needed to rebuild the message on retry. May contain access-granting URLs — not exposed to browser roles.';
comment on column public.email_outbox.resend_allowed is
  'False when the email carries a single-use link, so an explicit re-send would deliver a dead one.';

create index if not exists email_outbox_created_at_idx
  on public.email_outbox (created_at desc);
create index if not exists email_outbox_status_idx
  on public.email_outbox (status, created_at desc);
create index if not exists email_outbox_type_idx
  on public.email_outbox (notification_type, created_at desc);
create index if not exists email_outbox_client_idx
  on public.email_outbox (client_id, created_at desc);
create index if not exists email_outbox_related_idx
  on public.email_outbox (related_type, related_id);
-- The retry queue: rows still worth another attempt.
create index if not exists email_outbox_retryable_idx
  on public.email_outbox (created_at desc)
  where status in ('pending', 'failed');
-- Dedupe. Partial because most rows carry no key.
create unique index if not exists email_outbox_idempotency_key_uidx
  on public.email_outbox (idempotency_key)
  where idempotency_key is not null;

alter table public.email_outbox enable row level security;

-- Browser roles get nothing by default. The dispatcher writes as service_role,
-- which bypasses RLS. Admins read the operational columns only — `payload` is
-- excluded from the grant because it can carry signing and invite URLs.
revoke all on table public.email_outbox from public, anon, authenticated;
grant select (
  id, created_at, updated_at, notification_type, recipient, subject, status,
  attempt_count, max_attempts, first_attempt_at, last_attempt_at, sent_at,
  last_error, last_error_kind, idempotency_key, resend_allowed, provider,
  provider_message_id, client_id, related_type, related_id
) on table public.email_outbox to authenticated;

drop policy if exists "email_outbox_admin_select" on public.email_outbox;
create policy "email_outbox_admin_select" on public.email_outbox for select
  using (exists (select 1 from public.admin_users au where au.id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.touch_email_outbox_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists email_outbox_touch_updated_at on public.email_outbox;
create trigger email_outbox_touch_updated_at
  before update on public.email_outbox
  for each row execute function public.touch_email_outbox_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Retention
--
-- Same reasoning as cleanup_app_error_log in 037: a table that only grows
-- eventually becomes the outage. Delivered mail is a receipt and can go early;
-- rows that never landed are kept long enough to survive an investigation.
-- Payloads are cleared ahead of the row itself so access-granting URLs do not
-- sit in the database for months after the link they contain has expired.
-- Called from the existing daily expiry cron.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.cleanup_email_outbox(
  p_sent_retention_days integer default 60,
  p_failed_retention_days integer default 180,
  p_payload_retention_days integer default 14
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_sent_retention_days < 1
     or p_failed_retention_days < 1
     or p_payload_retention_days < 1 then
    raise exception 'retention_out_of_range';
  end if;

  update public.email_outbox
     set payload = '{}'::jsonb
   where payload <> '{}'::jsonb
     and created_at < now() - make_interval(days => p_payload_retention_days);

  delete from public.email_outbox
   where (status in ('sent', 'skipped')
          and created_at < now() - make_interval(days => p_sent_retention_days))
      or (status in ('failed', 'abandoned', 'pending', 'sending')
          and created_at < now() - make_interval(days => p_failed_retention_days));

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_email_outbox(integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.cleanup_email_outbox(integer, integer, integer) to service_role;
