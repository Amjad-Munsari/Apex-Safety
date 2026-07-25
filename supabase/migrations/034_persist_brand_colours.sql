-- Brand colours are practice-wide settings, not browser preferences. Persist
-- them in the existing singleton so Matt's choices reach every device and the
-- client portal.

alter table public.app_settings
  add column if not exists branding_primary text not null default '#3b8273',
  add column if not exists branding_secondary text not null default '#d97706';

alter table public.app_settings
  drop constraint if exists app_settings_branding_primary_hex,
  add constraint app_settings_branding_primary_hex
    check (branding_primary ~ '^#[0-9a-fA-F]{6}$'),
  drop constraint if exists app_settings_branding_secondary_hex,
  add constraint app_settings_branding_secondary_hex
    check (branding_secondary ~ '^#[0-9a-fA-F]{6}$');
