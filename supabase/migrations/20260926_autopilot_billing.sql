-- École OS — Autopilot billing / usage / technical operations
-- Design goal: automate onboarding economics, usage metering, pricing projection,
-- invoice preparation and operational decisions. Payment providers remain pluggable.

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  service text not null,
  metric text not null,
  quantity numeric(14,2) not null default 1 check(quantity >= 0),
  unit text not null default 'event',
  source text not null default 'app',
  measured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists usage_events_school_measured_idx on public.usage_events(school_id, measured_at desc);
create index if not exists usage_events_metric_idx on public.usage_events(service,metric,measured_at desc);

create table if not exists public.usage_daily (
  school_id uuid references public.schools(id) on delete cascade,
  day date not null,
  service text not null,
  metric text not null,
  quantity numeric(14,2) not null default 0,
  primary key(school_id,day,service,metric)
);
create table if not exists public.usage_monthly (
  school_id uuid references public.schools(id) on delete cascade,
  month_start date not null,
  service text not null,
  metric text not null,
  quantity numeric(14,2) not null default 0,
  primary key(school_id,month_start,service,metric)
);

alter table public.subscription_plans add column if not exists included_active_users integer not null default 100;
alter table public.subscription_plans add column if not exists overage_user_xof integer not null default 0;

create table if not exists public.school_billing_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  autopilot_enabled boolean not null default true,
  auto_scaling_enabled boolean not null default true,
  usage_pricing_enabled boolean not null default true,
  auto_upgrade_enabled boolean not null default false,
  spending_cap_xof integer,
  alert_threshold_pct numeric(5,2) not null default 80 check(alert_threshold_pct between 1 and 100),
  payment_provider text not null default 'wave_checkout',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_cycles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check(status in ('draft','due','paid','past_due','cancelled')),
  plan public.subscription_plan not null,
  active_users integer not null default 0,
  included_users integer not null default 0,
  overage_users integer not null default 0,
  base_amount_xof integer not null default 0,
  usage_amount_xof integer not null default 0,
  amount_xof integer not null default 0,
  estimated_cost_xof integer not null default 0,
  margin_xof integer not null default 0,
  provider text not null default 'wave_checkout',
  provider_checkout_id text unique,
  provider_checkout_url text,
  invoice_number text unique,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,period_start)
);
create index if not exists billing_cycles_school_period_idx on public.billing_cycles(school_id,period_start desc);
create index if not exists billing_cycles_status_idx on public.billing_cycles(status,period_start);

create table if not exists public.billing_line_items (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.billing_cycles(id) on delete cascade,
  service text not null,
  metric text not null,
  quantity numeric(14,2) not null default 0,
  unit text not null default 'unit',
  unit_price_xof numeric(14,2) not null default 0,
  amount_xof integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists billing_line_items_cycle_idx on public.billing_line_items(cycle_id);

create table if not exists public.platform_service_cost_rules (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  metric text not null,
  label text not null,
  fixed_monthly_xof integer not null default 0,
  included_units numeric(14,2) not null default 0,
  unit_cost_xof numeric(14,4) not null default 0,
  active boolean not null default true,
  notes text,
  updated_at timestamptz not null default now(),
  unique(service,metric)
);

create table if not exists public.platform_expenses (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  period_start date not null,
  amount_xof integer not null check(amount_xof >= 0),
  source text not null default 'manual',
  reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists platform_expenses_period_idx on public.platform_expenses(period_start desc,service);

create table if not exists public.autopilot_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  event_type text not null,
  severity text not null default 'info' check(severity in ('info','warning','critical')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists autopilot_events_school_idx on public.autopilot_events(school_id,created_at desc);
create index if not exists autopilot_events_severity_idx on public.autopilot_events(severity,created_at desc);

create or replace function public.record_usage_event(p_metric text,p_quantity numeric default 1,p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=''
as $$
declare v_school_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select school_id into v_school_id from public.profiles where id=(select auth.uid());
  if p_metric is null or length(trim(p_metric))=0 or length(p_metric)>80 then raise exception 'Invalid metric'; end if;
  if p_quantity is null or p_quantity<0 or p_quantity>1000000 then raise exception 'Invalid quantity'; end if;
  insert into public.usage_events(school_id,service,metric,quantity,unit,source,measured_at,metadata)
  values(v_school_id,'ecole-os',trim(p_metric),p_quantity,'event','app',now(),coalesce(p_metadata,'{}'::jsonb));
end;
$$;
revoke all on function public.record_usage_event(text,numeric,jsonb) from public;
grant execute on function public.record_usage_event(text,numeric,jsonb) to authenticated;

create or replace function public.rollup_usage(p_day date)
returns void language plpgsql security definer set search_path=''
as $$
begin
  insert into public.usage_daily(school_id,day,service,metric,quantity)
  select school_id,p_day,service,metric,sum(quantity)
  from public.usage_events
  where measured_at::date=p_day and school_id is not null
  group by school_id,service,metric
  on conflict(school_id,day,service,metric) do update set quantity=excluded.quantity;

  insert into public.usage_monthly(school_id,month_start,service,metric,quantity)
  select school_id,date_trunc('month',p_day)::date,service,metric,sum(quantity)
  from public.usage_events
  where measured_at::date between date_trunc('month',p_day)::date and p_day and school_id is not null
  group by school_id,date_trunc('month',p_day)::date,service,metric
  on conflict(school_id,month_start,service,metric) do update set quantity=excluded.quantity;
end;
$$;
revoke all on function public.rollup_usage(date) from public,anon,authenticated;
grant execute on function public.rollup_usage(date) to service_role;

create or replace function public.ensure_school_billing_cycle(p_school_id uuid,p_period_start date default date_trunc('month',current_date)::date)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_period_end date := (p_period_start + interval '1 month' - interval '1 day')::date;
  v_plan public.subscription_plan;
  v_base integer := 0;
  v_included integer := 0;
  v_overage_price integer := 0;
  v_active_users integer := 0;
  v_overage integer := 0;
  v_usage integer := 0;
  v_amount integer := 0;
  v_cost integer := 0;
  v_cycle uuid;
  v_sub record;
  v_rule record;
  v_units numeric;
  v_cost_part integer;
begin
  select ss.plan,ss.billing_price_xof into v_sub
  from public.school_subscriptions ss
  where ss.school_id=p_school_id and ss.status in ('active','pending','past_due')
  order by ss.created_at desc limit 1;

  if v_sub.plan is null then return null; end if;
  v_plan:=v_sub.plan;

  select coalesce(count(*),0)::int into v_active_users
  from public.profiles p
  where p.school_id=p_school_id and p.role is not null;

  select coalesce(sp.price_xof,0),coalesce(sp.included_active_users,100),coalesce(sp.overage_user_xof,0)
  into v_base,v_included,v_overage_price
  from public.subscription_plans sp where sp.id=v_plan;
  if v_base=0 then v_base:=coalesce(v_sub.billing_price_xof,0); end if;

  v_overage:=greatest(v_active_users-v_included,0);
  v_usage:=v_overage*v_overage_price;
  v_amount:=v_base+v_usage;

  for v_rule in select * from public.platform_service_cost_rules where active=true loop
    if v_rule.metric='active_users' then
      v_units:=greatest(v_active_users-v_rule.included_units,0);
    else
      select coalesce(sum(um.quantity),0) into v_units
      from public.usage_monthly um
      where um.school_id=p_school_id and um.month_start=p_period_start
        and um.service=v_rule.service and um.metric=v_rule.metric;
      v_units:=greatest(v_units-v_rule.included_units,0);
    end if;
    v_cost_part:=coalesce(v_rule.fixed_monthly_xof,0)+round(v_units*coalesce(v_rule.unit_cost_xof,0));
    v_cost:=v_cost+v_cost_part;
  end loop;

  insert into public.billing_cycles(
    school_id,period_start,period_end,status,plan,active_users,included_users,overage_users,
    base_amount_xof,usage_amount_xof,amount_xof,estimated_cost_xof,margin_xof,provider,invoice_number,due_at
  ) values(
    p_school_id,p_period_start,v_period_end,
    case when coalesce(v_sub.status::text,'active')='paid' then 'paid' else 'due' end,
    v_plan,v_active_users,v_included,v_overage,v_base,v_usage,v_amount,v_cost,v_amount-v_cost,'wave_checkout',
    'EO-'||to_char(p_period_start,'YYYYMM')||'-'||replace(substr(p_school_id::text,1,8),'-',''),
    (p_period_start+interval '5 days')::timestamptz
  )
  on conflict(school_id,period_start) do update set
    plan=excluded.plan,active_users=excluded.active_users,included_users=excluded.included_users,
    overage_users=excluded.overage_users,base_amount_xof=excluded.base_amount_xof,usage_amount_xof=excluded.usage_amount_xof,
    amount_xof=excluded.amount_xof,estimated_cost_xof=excluded.estimated_cost_xof,margin_xof=excluded.margin_xof,
    updated_at=now()
  returning id into v_cycle;

  delete from public.billing_line_items where cycle_id=v_cycle;
  insert into public.billing_line_items(cycle_id,service,metric,quantity,unit,unit_price_xof,amount_xof,metadata)
  values(v_cycle,'ecole-os','base_plan',1,'plan',v_base,v_base,jsonb_build_object('plan',v_plan,'included_users',v_included)),
        (v_cycle,'ecole-os','active_users_overage',v_overage,'user',v_overage_price,v_usage,jsonb_build_object('included_users',v_included));

  if exists(select 1 from public.school_billing_settings where school_id=p_school_id and autopilot_enabled=true) then
    insert into public.autopilot_events(school_id,event_type,severity,message,metadata)
    values(p_school_id,'billing_cycle_ready','info','Cycle recalculé automatiquement.',jsonb_build_object('amount_xof',v_amount,'active_users',v_active_users,'estimated_cost_xof',v_cost));
  end if;

  return v_cycle;
end;
$$;
revoke all on function public.ensure_school_billing_cycle(uuid,date) from public,anon,authenticated;
grant execute on function public.ensure_school_billing_cycle(uuid,date) to service_role;

create or replace function public.autopilot_billing_run(p_period_start date default date_trunc('month',current_date)::date)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare r record; v_id uuid; v_processed integer:=0;
begin
  perform public.rollup_usage(current_date);
  for r in select id from public.schools loop
    v_id:=public.ensure_school_billing_cycle(r.id,p_period_start);
    if v_id is not null then v_processed:=v_processed+1; end if;
  end loop;
  return jsonb_build_object('period_start',p_period_start,'schools_processed',v_processed,'ran_at',now());
end;
$$;
revoke all on function public.autopilot_billing_run(date) from public,anon,authenticated;
grant execute on function public.autopilot_billing_run(date) to service_role;

create or replace view public.v_director_autopilot_stats with (security_invoker=true) as
select
  s.id as school_id,
  s.name as school_name,
  s.city,
  coalesce(ss.plan,'simple') as plan,
  coalesce(ss.status::text,'pending') as subscription_status,
  coalesce(ss.billing_price_xof,0) as contract_price_xof,
  coalesce(bc.active_users,0) as active_users,
  coalesce(bc.included_users,0) as included_users,
  coalesce(bc.overage_users,0) as overage_users,
  coalesce(bc.amount_xof,0) as projected_bill_xof,
  coalesce(bc.estimated_cost_xof,0) as estimated_cost_xof,
  coalesce(bc.margin_xof,0) as projected_margin_xof,
  coalesce((select count(*) from public.profiles p where p.school_id=s.id and p.role='student'),0) as students,
  coalesce((select count(*) from public.profiles p where p.school_id=s.id and p.role='parent'),0) as parents,
  coalesce((select count(*) from public.profiles p where p.school_id=s.id and p.role='teacher'),0) as teachers,
  coalesce((select count(*) from public.profiles p where p.school_id=s.id and p.role='admin'),0) as admins,
  coalesce((select count(*) from public.usage_events u where u.school_id=s.id and u.measured_at>=date_trunc('month',now())),0) as events_this_month,
  coalesce((select sum(sp.amount_xof) from public.school_payments sp join public.profiles p on p.id=sp.user_id where p.school_id=s.id and sp.status='succeeded' and sp.created_at>=date_trunc('month',now())),0) as collected_this_month_xof,
  coalesce((select sum(sp.amount_xof) from public.school_payments sp join public.profiles p on p.id=sp.user_id where p.school_id=s.id and sp.status='pending'),0) as pending_collections_xof,
  coalesce((select count(*) from public.food_orders fo join public.profiles p on p.id=fo.user_id where p.school_id=s.id and fo.created_at>=date_trunc('month',now()) and fo.status<>'cancelled'),0) as food_orders_this_month
from public.schools s
left join lateral (select * from public.school_subscriptions x where x.school_id=s.id order by x.created_at desc limit 1) ss on true
left join public.billing_cycles bc on bc.school_id=s.id and bc.period_start=date_trunc('month',current_date)::date
;

grant select on public.v_director_autopilot_stats to authenticated;

create or replace view public.v_platform_autopilot_school_snapshot with (security_invoker=true) as
select * from public.v_director_autopilot_stats;
grant select on public.v_platform_autopilot_school_snapshot to authenticated;

alter table public.usage_events enable row level security;
alter table public.usage_daily enable row level security;
alter table public.usage_monthly enable row level security;
alter table public.school_billing_settings enable row level security;
alter table public.billing_cycles enable row level security;
alter table public.billing_line_items enable row level security;
alter table public.platform_service_cost_rules enable row level security;
alter table public.platform_expenses enable row level security;
alter table public.autopilot_events enable row level security;

-- Directors can see their own school's projection; platform operators receive broader server-side access via service role.
drop policy if exists billing_settings_school_read on public.school_billing_settings;
create policy billing_settings_school_read on public.school_billing_settings for select to authenticated
using(exists(select 1 from public.schools s where s.id=school_billing_settings.school_id and s.director_id=(select auth.uid())));
drop policy if exists billing_cycle_school_read on public.billing_cycles;
create policy billing_cycle_school_read on public.billing_cycles for select to authenticated
using(exists(select 1 from public.schools s where s.id=billing_cycles.school_id and s.director_id=(select auth.uid())));
drop policy if exists billing_lines_school_read on public.billing_line_items;
create policy billing_lines_school_read on public.billing_line_items for select to authenticated
using(exists(select 1 from public.billing_cycles bc join public.schools s on s.id=bc.school_id where bc.id=billing_line_items.cycle_id and s.director_id=(select auth.uid())));
drop policy if exists usage_monthly_school_read on public.usage_monthly;
create policy usage_monthly_school_read on public.usage_monthly for select to authenticated
using(exists(select 1 from public.schools s where s.id=usage_monthly.school_id and s.director_id=(select auth.uid())));
drop policy if exists autopilot_events_school_read on public.autopilot_events;
create policy autopilot_events_school_read on public.autopilot_events for select to authenticated
using(exists(select 1 from public.schools s where s.id=autopilot_events.school_id and s.director_id=(select auth.uid())));

insert into public.platform_service_cost_rules(service,metric,label,fixed_monthly_xof,included_units,unit_cost_xof,notes)
values
('supabase','active_users','Base infrastructure / active user allocation',0,100,20,'Estimate configurable from real provider invoice.'),
('vercel','deployments','Hosting / deployment allocation',0,20,50,'Estimate configurable from real provider invoice.'),
('notifications','messages','Emails / SMS / notifications',0,1000,2,'Estimate configurable from actual provider costs.')
on conflict(service,metric) do update set label=excluded.label,updated_at=now();

insert into public.school_billing_settings(school_id)
select id from public.schools on conflict(school_id) do nothing;

-- Defaults only; platform operator can tune these values from SQL/API as real provider costs become known.
update public.subscription_plans set included_active_users=100,overage_user_xof=20 where id='simple';
update public.subscription_plans set included_active_users=300,overage_user_xof=15 where id='extra';

-- Views are consumed server-side with the service key; do not expose platform-wide snapshots to client sessions.
revoke all on public.v_director_autopilot_stats from authenticated;
revoke all on public.v_platform_autopilot_school_snapshot from authenticated;
