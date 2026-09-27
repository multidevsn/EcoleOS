-- Canonical SQL for the already-applied Supabase migrations.
create table if not exists public.school_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  role public.app_role not null,
  full_name text not null,
  email text,
  phone text,
  student_code text,
  external_ref text,
  status text not null default 'pending' check(status in ('pending','invited','active','linked','suspended','archived')),
  linked_user_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  invited_at timestamptz,
  linked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists school_enrollments_school_status_idx on public.school_enrollments(school_id,status,created_at desc);
create index if not exists school_enrollments_school_role_idx on public.school_enrollments(school_id,role,status);
create unique index if not exists school_enrollments_school_student_code_uidx on public.school_enrollments(school_id,student_code) where student_code is not null and student_code <> '';
create unique index if not exists school_enrollments_school_email_uidx on public.school_enrollments(school_id,lower(email)) where email is not null and email <> '';

create table if not exists public.school_enrollment_links (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  parent_enrollment_id uuid not null references public.school_enrollments(id) on delete cascade,
  student_enrollment_id uuid not null references public.school_enrollments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(parent_enrollment_id,student_enrollment_id),
  check(parent_enrollment_id<>student_enrollment_id)
);
create index if not exists school_enrollment_links_school_idx on public.school_enrollment_links(school_id);

alter table public.school_enrollments enable row level security;
alter table public.school_enrollment_links enable row level security;
drop policy if exists school_enrollments_manager_read on public.school_enrollments;
create policy school_enrollments_manager_read on public.school_enrollments for select to authenticated using((select private.can_manage_school(school_id)));
drop policy if exists school_enrollment_links_manager_read on public.school_enrollment_links;
create policy school_enrollment_links_manager_read on public.school_enrollment_links for select to authenticated using((select private.can_manage_school(school_id)));

create or replace function public.find_auth_user_by_email(p_email text)
returns uuid language sql security definer set search_path=''
as $$ select id from auth.users where lower(email)=lower(trim(p_email)) limit 1; $$;
revoke all on function public.find_auth_user_by_email(text) from public;
grant execute on function public.find_auth_user_by_email(text) to service_role;

create or replace function public.sync_enrollment_family_links(p_enrollment_id uuid)
returns void language sql security definer set search_path=''
as $$
  insert into public.parent_students(parent_id,student_id)
  select pe.linked_user_id,se.linked_user_id
  from public.school_enrollment_links l
  join public.school_enrollments pe on pe.id=l.parent_enrollment_id
  join public.school_enrollments se on se.id=l.student_enrollment_id
  where (l.parent_enrollment_id=p_enrollment_id or l.student_enrollment_id=p_enrollment_id)
    and pe.linked_user_id is not null and se.linked_user_id is not null
  on conflict do nothing;
$$;
revoke all on function public.sync_enrollment_family_links(uuid) from public;
grant execute on function public.sync_enrollment_family_links(uuid) to service_role;

create or replace function public.record_usage_event(p_metric text,p_quantity numeric default 1,p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=''
as $$
declare v_school_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_metric is null or length(trim(p_metric))=0 or length(p_metric)>80 then raise exception 'Invalid metric'; end if;
  if p_quantity is null or p_quantity<0 or p_quantity>1000000 then raise exception 'Invalid quantity'; end if;
  select school_id into v_school_id from public.profiles where id=(select auth.uid());
  insert into public.usage_events(school_id,service,metric,quantity,unit,source,measured_at,metadata)
  values(v_school_id,'ecole-os',trim(p_metric),p_quantity,'event','app',now(),jsonb_build_object('user_id',(select auth.uid())) || coalesce(p_metadata,'{}'::jsonb));
end;
$$;
revoke all on function public.record_usage_event(text,numeric,jsonb) from public;
grant execute on function public.record_usage_event(text,numeric,jsonb) to authenticated;

revoke all on function public.find_auth_user_by_email(text) from public,anon,authenticated;
revoke all on function public.link_profile_to_enrollment(uuid,uuid) from public,anon,authenticated;
revoke all on function public.record_usage_event(text,numeric,jsonb) from public,anon,authenticated;
revoke all on function public.rollup_usage(date) from public,anon,authenticated;
revoke all on function public.sync_enrollment_family_links(uuid) from public,anon,authenticated;
revoke all on function public.sync_profile_school_membership() from public,anon,authenticated;
grant execute on function public.find_auth_user_by_email(text) to service_role;
grant execute on function public.link_profile_to_enrollment(uuid,uuid) to service_role;
grant execute on function public.rollup_usage(date) to service_role;
grant execute on function public.sync_enrollment_family_links(uuid) to service_role;

create index if not exists class_members_student_idx on public.class_members(student_id);
create index if not exists demo_grades_profile_idx on public.demo_grades(profile_id);
create index if not exists demo_orders_profile_idx on public.demo_orders(profile_id);
create index if not exists demo_payments_profile_idx on public.demo_payments(profile_id);
create index if not exists demo_points_profile_idx on public.demo_points(profile_id);
create index if not exists demo_schedule_profile_idx on public.demo_schedule(profile_id);
create index if not exists demo_schedule_teacher_profile_idx on public.demo_schedule(teacher_profile_id);
create index if not exists food_order_items_food_item_idx on public.food_order_items(food_item_id);
create index if not exists food_order_items_order_idx on public.food_order_items(order_id);
create index if not exists food_orders_user_idx on public.food_orders(user_id);
create index if not exists grades_student_idx on public.grades(student_id);
create index if not exists grades_subject_idx on public.grades(subject_id);
create index if not exists ops_scenarios_created_by_idx on public.ops_scenarios(created_by);
create index if not exists parent_students_student_idx on public.parent_students(student_id);
create index if not exists point_ledger_user_idx on public.point_ledger(user_id);
create index if not exists profiles_school_idx on public.profiles(school_id);
create index if not exists referrals_referral_code_idx on public.referrals(referral_code);
create index if not exists referrals_referrer_idx on public.referrals(referrer_id);
create index if not exists reward_redemptions_reward_idx on public.reward_redemptions(reward_id);
create index if not exists reward_redemptions_user_idx on public.reward_redemptions(user_id);
create index if not exists schedule_class_idx on public.schedule(class_id);
create index if not exists schedule_subject_idx on public.schedule(subject_id);
create index if not exists schedule_teacher_idx on public.schedule(teacher_id);
create index if not exists school_enrollment_links_student_idx on public.school_enrollment_links(student_enrollment_id);
create index if not exists school_enrollments_created_by_idx on public.school_enrollments(created_by);
create index if not exists school_enrollments_linked_user_idx on public.school_enrollments(linked_user_id);
create index if not exists school_invitations_accepted_user_idx on public.school_invitations(accepted_user_id);
create index if not exists school_invitations_invited_by_idx on public.school_invitations(invited_by);
create index if not exists school_payments_user_idx on public.school_payments(user_id);
create index if not exists school_subscriptions_referral_idx on public.school_subscriptions(referral_id);
create index if not exists school_subscriptions_school_idx on public.school_subscriptions(school_id);
create index if not exists usage_daily_school_idx on public.usage_daily(school_id);
create index if not exists usage_monthly_school_idx on public.usage_monthly(school_id);

create table if not exists public.school_member_imports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  source_name text,
  row_count integer not null default 0 check(row_count between 0 and 2000),
  valid_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  status text not null default 'ready' check(status in ('validating','ready','processing','completed','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists school_member_imports_school_created_idx on public.school_member_imports(school_id,created_at desc);

create table if not exists public.school_member_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.school_member_imports(id) on delete cascade,
  line_number integer not null check(line_number>0),
  payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','valid','created','invited','linked','skipped','error')),
  errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  enrollment_id uuid references public.school_enrollments(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  processed_at timestamptz,
  unique(import_id,line_number)
);
create index if not exists school_member_import_rows_import_idx on public.school_member_import_rows(import_id,line_number);
create index if not exists school_member_import_rows_status_idx on public.school_member_import_rows(import_id,status);

alter table public.school_member_imports enable row level security;
alter table public.school_member_import_rows enable row level security;
drop policy if exists school_member_imports_manager_read on public.school_member_imports;
create policy school_member_imports_manager_read on public.school_member_imports for select to authenticated using((select private.can_manage_school(school_id)));
drop policy if exists school_member_import_rows_manager_read on public.school_member_import_rows;
create policy school_member_import_rows_manager_read on public.school_member_import_rows for select to authenticated using(
  exists(select 1 from public.school_member_imports i where i.id=school_member_import_rows.import_id and (select private.can_manage_school(i.school_id)))
);
revoke all on public.school_member_imports from anon,authenticated;
revoke all on public.school_member_import_rows from anon,authenticated;

-- Performance/security hardening applied after the initial onboarding migration.
create index if not exists school_member_import_rows_enrollment_idx
  on public.school_member_import_rows(enrollment_id);
create index if not exists school_member_import_rows_user_idx
  on public.school_member_import_rows(user_id);
create index if not exists school_member_imports_created_by_idx
  on public.school_member_imports(created_by);

drop policy if exists orders_insert on public.food_orders;
create policy orders_insert on public.food_orders
for insert to authenticated
with check(user_id=(select auth.uid()));

drop policy if exists points_self on public.point_ledger;
create policy points_self on public.point_ledger
for select to authenticated
using(user_id=(select auth.uid()) or (select private.is_staff()));

drop policy if exists redemption_insert on public.reward_redemptions;
create policy redemption_insert on public.reward_redemptions
for insert to authenticated
with check(user_id=(select auth.uid()));

drop policy if exists redemption_self on public.reward_redemptions;
create policy redemption_self on public.reward_redemptions
for select to authenticated
using(user_id=(select auth.uid()) or (select private.is_staff()));

drop policy if exists parent_students_self on public.parent_students;
create policy parent_students_self on public.parent_students
for select to authenticated
using(parent_id=(select auth.uid()) or student_id=(select auth.uid()) or (select private.is_staff()));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update to authenticated
using((select auth.uid())=id or (select private.is_staff()))
with check((select auth.uid())=id or (select private.is_staff()));

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
for select to authenticated
using(id=(select auth.uid()) or (select private.is_parent_of(profiles.id)) or (select private.is_staff()));

drop policy if exists grades_self on public.grades;
create policy grades_self on public.grades
for select to authenticated
using(student_id=(select auth.uid()) or (select private.is_parent_of(grades.student_id)) or (select private.is_staff()));

drop policy if exists payments_self on public.school_payments;
create policy payments_self on public.school_payments
for select to authenticated
using(user_id=(select auth.uid()) or (select private.is_parent_of(school_payments.user_id)) or (select private.is_staff()));

drop policy if exists school_owner_read on public.schools;
create policy school_owner_read on public.schools
for select to authenticated
using(director_id=(select auth.uid()) or (select private.is_staff()));

drop policy if exists subscription_owner_read on public.school_subscriptions;
create policy subscription_owner_read on public.school_subscriptions
for select to authenticated
using(exists(select 1 from public.schools s where s.id=school_subscriptions.school_id and (s.director_id=(select auth.uid()) or (select private.is_staff()))));

drop policy if exists referral_code_owner_read on public.referral_codes;
create policy referral_code_owner_read on public.referral_codes
for select to authenticated
using(owner_id=(select auth.uid()) or (select private.is_staff()));

drop policy if exists referral_owner_read on public.referrals;
create policy referral_owner_read on public.referrals
for select to authenticated
using(
  referrer_id=(select auth.uid())
  or exists(select 1 from public.schools s where s.id=referrals.referred_school_id and s.director_id=(select auth.uid()))
  or (select private.is_staff())
);

revoke all on function public.find_auth_user_by_email(text) from public,anon,authenticated;
revoke all on function public.link_profile_to_enrollment(uuid,uuid) from public,anon,authenticated;
revoke all on function public.record_usage_event(text,numeric,jsonb) from public,anon,authenticated;
revoke all on function public.rollup_usage(date) from public,anon,authenticated;
revoke all on function public.sync_enrollment_family_links(uuid) from public,anon,authenticated;
revoke all on function public.sync_profile_school_membership() from public,anon,authenticated;
grant execute on function public.find_auth_user_by_email(text) to service_role;
grant execute on function public.link_profile_to_enrollment(uuid,uuid) to service_role;
grant execute on function public.rollup_usage(date) to service_role;
grant execute on function public.sync_enrollment_family_links(uuid) to service_role;

drop policy if exists members_self on public.class_members;
create policy members_self on public.class_members
for select to authenticated
using(
  student_id=(select auth.uid())
  or (select private.is_parent_of(class_members.student_id))
  or (select private.is_staff())
);
