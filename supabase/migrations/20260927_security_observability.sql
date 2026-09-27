-- École OS — server-oriented security observability
create table if not exists public.security_events(
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null,
  severity text not null default 'info' check(severity in ('info','warning','critical')),
  actor_user_id uuid references auth.users(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  ip_hash text,
  user_agent_hash text,
  route text,
  method text,
  status_code integer,
  request_id text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists security_events_created_idx on public.security_events(created_at desc);
create index if not exists security_events_ip_idx on public.security_events(ip_hash,created_at desc);
create index if not exists security_events_actor_idx on public.security_events(actor_user_id,created_at desc);
create index if not exists security_events_type_idx on public.security_events(event_type,created_at desc);
alter table public.security_events enable row level security;
revoke all on public.security_events from anon,authenticated;

create table if not exists public.security_alerts(
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'open' check(status in ('open','acknowledged','closed')),
  severity text not null check(severity in ('warning','critical')),
  alert_type text not null,
  signature text not null,
  summary text not null,
  evidence jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrences integer not null default 1
);
alter table public.security_alerts enable row level security;
revoke all on public.security_alerts from anon,authenticated;

create or replace function public.security_record_event(
  p_event_type text,p_severity text default 'info',p_actor uuid default null,p_school uuid default null,
  p_ip_hash text default null,p_user_agent_hash text default null,p_route text default null,p_method text default null,
  p_status integer default null,p_request_id text default null,p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_sig text; v_alert_id uuid;
begin
  insert into public.security_events(event_type,severity,actor_user_id,school_id,ip_hash,user_agent_hash,route,method,status_code,request_id,metadata)
  values(left(trim(p_event_type),80),case when p_severity in ('info','warning','critical') then p_severity else 'info' end,
  p_actor,p_school,left(p_ip_hash,128),left(p_user_agent_hash,128),left(p_route,180),left(p_method,12),p_status,left(p_request_id,120),coalesce(p_metadata,'{}'::jsonb))
  returning id into v_id;
  if p_severity in ('warning','critical') then
    v_sig:=left(coalesce(p_event_type,'event')||':'||coalesce(p_ip_hash,'noip'),250);
    select id into v_alert_id from public.security_alerts where signature=v_sig and status='open' limit 1;
    if v_alert_id is null then
      insert into public.security_alerts(severity,alert_type,signature,summary,evidence)
      values(p_severity,p_event_type,v_sig,'Activité nécessitant une revue.',jsonb_build_object('ip_hash',p_ip_hash,'actor_user_id',p_actor,'route',p_route,'last_event_id',v_id));
    else
      update public.security_alerts set occurrences=occurrences+1,last_seen_at=now(),updated_at=now() where id=v_alert_id;
    end if;
  end if;
  return v_id;
end;
$$;
revoke all on function public.security_record_event(text,text,uuid,uuid,text,text,text,text,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.security_record_event(text,text,uuid,uuid,text,text,text,text,integer,text,jsonb) to service_role;

create or replace function public.security_get_summary(p_hours integer default 24)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h integer:=greatest(1,least(coalesce(p_hours,24),168));
begin
  return jsonb_build_object(
    'window_hours',h,
    'events',(select count(*) from public.security_events where created_at>=now()-make_interval(hours=>h)),
    'warnings',(select count(*) from public.security_events where severity='warning' and created_at>=now()-make_interval(hours=>h)),
    'critical',(select count(*) from public.security_events where severity='critical' and created_at>=now()-make_interval(hours=>h)),
    'open_alerts',(select count(*) from public.security_alerts where status='open'),
    'alerts',(select coalesce(jsonb_agg(to_jsonb(a) order by a.last_seen_at desc),'[]'::jsonb) from (select id,created_at,updated_at,status,severity,alert_type,summary,evidence,first_seen_at,last_seen_at,occurrences from public.security_alerts where status='open' order by last_seen_at desc limit 25) a)
  );
end;
$$;
revoke all on function public.security_get_summary(integer) from public,anon,authenticated;
grant execute on function public.security_get_summary(integer) to service_role;
