-- Phase 5: store FCM device tokens for daily expense reminders
alter table public.profiles
  add column if not exists fcm_token text;

comment on column public.profiles.fcm_token is
  'Web push FCM token for daily expense reminders; null when disabled';
