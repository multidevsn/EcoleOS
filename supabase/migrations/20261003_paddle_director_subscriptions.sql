-- Paddle software subscriptions for school directors. Additive only; existing Wave records remain unchanged.
alter table public.school_subscriptions
  add column if not exists billing_provider text not null default 'wave',
  add column if not exists paddle_customer_id text,
  add column if not exists paddle_subscription_id text,
  add column if not exists paddle_price_id text;

create unique index if not exists school_subscriptions_paddle_subscription_uidx
  on public.school_subscriptions(paddle_subscription_id) where paddle_subscription_id is not null;

create table if not exists public.paddle_events(
  id text primary key,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
alter table public.paddle_events add column if not exists processed_at timestamptz;
alter table public.paddle_events enable row level security;
revoke all on public.paddle_events from anon,authenticated;


