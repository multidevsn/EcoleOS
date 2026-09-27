-- École OS — real provider cost snapshots / allocation
create table if not exists public.provider_cost_snapshots (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  period_start date not null,
  period_end date not null,
  currency text not null default 'USD',
  amount numeric(14,4) not null default 0,
  amount_xof bigint,
  basis text not null default 'provider_reported' check(basis in ('provider_reported','usage_derived')),
  status text not null default 'ok' check(status in ('ok','partial','error','not_configured')),
  units jsonb not null default '{}'::jsonb,
  breakdown jsonb not null default '{}'::jsonb,
  source_ref text,
  error_message text,
  fetched_at timestamptz not null default now(),
  unique(provider,period_start,period_end)
);
create index if not exists provider_cost_snapshots_period_idx on public.provider_cost_snapshots(period_start desc,provider);

create unique index if not exists platform_expenses_provider_reference_uidx on public.platform_expenses(service,period_start,reference) where source='provider_sync';

alter table public.billing_cycles add column if not exists provider_cost_xof bigint not null default 0;
alter table public.billing_cycles add column if not exists cost_basis text not null default 'rules_estimate';

alter table public.provider_cost_snapshots enable row level security;
drop policy if exists provider_cost_snapshots_no_client_read on public.provider_cost_snapshots;
create policy provider_cost_snapshots_no_client_read on public.provider_cost_snapshots for all to authenticated using(false) with check(false);

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
  v_all_active_users integer := 0;
  v_overage integer := 0;
  v_usage integer := 0;
  v_amount integer := 0;
  v_rule_cost integer := 0;
  v_provider_total numeric := 0;
  v_provider_share integer := 0;
  v_effective_cost integer := 0;
  v_cycle uuid;
  v_sub record;
  v_rule record;
  v_units numeric;
  v_cost_part integer;
  v_provider_ok boolean := false;
begin
  select ss.plan,ss.billing_price_xof into v_sub
  from public.school_subscriptions ss
  where ss.school_id=p_school_id and ss.status in ('active','pending','past_due')
  order by ss.created_at desc limit 1;
  if v_sub.plan is null then return null; end if;
  v_plan:=v_sub.plan;

  select count(*)::int into v_active_users from public.profiles p where p.school_id=p_school_id and p.role is not null;
  select count(*)::int into v_all_active_users from public.profiles p where p.school_id is not null and p.role is not null;

  select coalesce(sp.price_xof,0),coalesce(sp.included_active_users,100),coalesce(sp.overage_user_xof,0)
  into v_base,v_included,v_overage_price from public.subscription_plans sp where sp.id=v_plan;
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
      where um.school_id=p_school_id and um.month_start=p_period_start and um.service=v_rule.service and um.metric=v_rule.metric;
      v_units:=greatest(v_units-v_rule.included_units,0);
    end if;
    v_cost_part:=coalesce(v_rule.fixed_monthly_xof,0)+round(v_units*coalesce(v_rule.unit_cost_xof,0));
    v_rule_cost:=v_rule_cost+v_cost_part;
  end loop;

  select coalesce(sum(amount_xof),0),coalesce(count(*) filter(where status in ('ok','partial'))>0,false)
  into v_provider_total,v_provider_ok
  from public.provider_cost_snapshots where period_start=p_period_start and amount_xof is not null;

  if v_provider_ok and v_all_active_users>0 then
    v_provider_share:=round(v_provider_total * v_active_users / v_all_active_users);
    v_effective_cost:=greatest(v_provider_share,0);
  else
    v_provider_share:=0;
    v_effective_cost:=v_rule_cost;
  end if;

  insert into public.billing_cycles(
    school_id,period_start,period_end,status,plan,active_users,included_users,overage_users,
    base_amount_xof,usage_amount_xof,amount_xof,estimated_cost_xof,provider_cost_xof,cost_basis,margin_xof,provider,invoice_number,due_at
  ) values(
    p_school_id,p_period_start,v_period_end,
    case when coalesce(v_sub.status::text,'active')='paid' then 'paid' else 'due' end,
    v_plan,v_active_users,v_included,v_overage,v_base,v_usage,v_amount,v_effective_cost,v_provider_share,
    case when v_provider_ok then 'provider_allocation' else 'rules_estimate' end,
    v_amount-v_effective_cost,'wave_checkout',
    'EO-'||to_char(p_period_start,'YYYYMM')||'-'||replace(substr(p_school_id::text,1,8),'-',''),
    (p_period_start+interval '5 days')::timestamptz
  )
  on conflict(school_id,period_start) do update set
    plan=excluded.plan,active_users=excluded.active_users,included_users=excluded.included_users,
    overage_users=excluded.overage_users,base_amount_xof=excluded.base_amount_xof,usage_amount_xof=excluded.usage_amount_xof,
    amount_xof=excluded.amount_xof,estimated_cost_xof=excluded.estimated_cost_xof,provider_cost_xof=excluded.provider_cost_xof,
    cost_basis=excluded.cost_basis,margin_xof=excluded.margin_xof,updated_at=now()
  returning id into v_cycle;

  delete from public.billing_line_items where cycle_id=v_cycle;
  insert into public.billing_line_items(cycle_id,service,metric,quantity,unit,unit_price_xof,amount_xof,metadata)
  values(v_cycle,'ecole-os','base_plan',1,'plan',v_base,v_base,jsonb_build_object('plan',v_plan,'included_users',v_included)),
        (v_cycle,'ecole-os','active_users_overage',v_overage,'user',v_overage_price,v_usage,jsonb_build_object('included_users',v_included));

  if v_provider_ok and v_provider_share>0 then
    insert into public.billing_line_items(cycle_id,service,metric,quantity,unit,unit_price_xof,amount_xof,metadata)
    values(v_cycle,'platform','provider_cost_allocation',v_active_users,'active_user',round(v_provider_total/greatest(v_all_active_users,1)),v_provider_share,
      jsonb_build_object('platform_provider_cost_xof',v_provider_total,'allocation_method','active_users_share','all_active_users',v_all_active_users));
  end if;

  if exists(select 1 from public.school_billing_settings where school_id=p_school_id and autopilot_enabled=true) then
    insert into public.autopilot_events(school_id,event_type,severity,message,metadata)
    values(p_school_id,'billing_cycle_ready','info','Cycle recalculé automatiquement avec les coûts fournisseurs disponibles.',jsonb_build_object('amount_xof',v_amount,'active_users',v_active_users,'effective_cost_xof',v_effective_cost,'provider_cost_xof',v_provider_share,'cost_basis',case when v_provider_ok then 'provider_allocation' else 'rules_estimate' end));
  end if;
  return v_cycle;
end;
$$;
revoke all on function public.ensure_school_billing_cycle(uuid,date) from public,anon,authenticated;
grant execute on function public.ensure_school_billing_cycle(uuid,date) to service_role;

drop view if exists public.v_platform_autopilot_school_snapshot;
drop view if exists public.v_director_autopilot_stats;

create view public.v_director_autopilot_stats with (security_invoker=true) as
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
  coalesce(bc.provider_cost_xof,0) as provider_cost_xof,
  coalesce(bc.cost_basis,'rules_estimate') as cost_basis,
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
left join public.billing_cycles bc on bc.school_id=s.id and bc.period_start=date_trunc('month',current_date)::date;

create view public.v_platform_autopilot_school_snapshot with (security_invoker=true) as
select * from public.v_director_autopilot_stats;

revoke all on public.v_director_autopilot_stats from authenticated;
revoke all on public.v_platform_autopilot_school_snapshot from authenticated;
