-- SasPay hosted checkout support. Additive migration: Wave and Paddle columns remain intact.
alter table public.food_orders
  add column if not exists saspay_checkout_id text,
  add column if not exists saspay_checkout_url text,
  add column if not exists saspay_transaction_id text,
  add column if not exists saspay_amount_xof integer;

alter table public.school_payments
  add column if not exists saspay_checkout_id text,
  add column if not exists saspay_checkout_url text,
  add column if not exists saspay_transaction_id text,
  add column if not exists saspay_amount_xof integer;

alter table public.school_subscriptions
  add column if not exists saspay_checkout_id text,
  add column if not exists saspay_checkout_url text,
  add column if not exists saspay_transaction_id text,
  add column if not exists saspay_amount_xof integer;

alter table public.billing_cycles
  add column if not exists saspay_checkout_id text,
  add column if not exists saspay_checkout_url text,
  add column if not exists saspay_transaction_id text,
  add column if not exists saspay_amount_xof integer;

create unique index if not exists food_orders_saspay_checkout_uidx
  on public.food_orders(saspay_checkout_id) where saspay_checkout_id is not null;
create unique index if not exists school_payments_saspay_checkout_uidx
  on public.school_payments(saspay_checkout_id) where saspay_checkout_id is not null;
create unique index if not exists school_subscriptions_saspay_checkout_uidx
  on public.school_subscriptions(saspay_checkout_id) where saspay_checkout_id is not null;
create unique index if not exists billing_cycles_saspay_checkout_uidx
  on public.billing_cycles(saspay_checkout_id) where saspay_checkout_id is not null;

create table if not exists public.saspay_events (
  id text primary key,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);
create index if not exists saspay_events_received_idx on public.saspay_events(received_at desc);
alter table public.saspay_events enable row level security;
revoke all on public.saspay_events from anon, authenticated;

-- Rend visible les échecs de rapprochement et les événements en attente de reprise.
alter table public.saspay_events add column if not exists last_error text;
create index if not exists saspay_events_unprocessed_idx on public.saspay_events(received_at) where processed_at is null;
