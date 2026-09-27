-- École OS — vues sécurisées par rôle
-- PostgreSQL/Supabase
-- Toutes les vues sont security_invoker=true afin de respecter les RLS des tables de base.

create or replace function private.is_role(expected public.app_role)
returns boolean language sql security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role=expected); $$;
revoke all on function private.is_role(public.app_role) from public;
grant execute on function private.is_role(public.app_role) to authenticated;

drop view if exists public.v_student_dashboard;
create view public.v_student_dashboard with (security_invoker=true) as
select p.id,p.full_name,p.school_id,
coalesce((select c.name from public.class_members cm join public.classes c on c.id=cm.class_id where cm.student_id=p.id limit 1),'—') class_name,
coalesce((select round(sum(g.value*s.coefficient)/nullif(sum(s.coefficient),0),2) from public.grades g join public.subjects s on s.id=g.subject_id where g.student_id=p.id),0) average,
coalesce((select sum(points) from public.point_ledger where user_id=p.id),0) points,
coalesce((select sum(amount_xof) from public.school_payments where user_id=p.id and status='pending'),0) pending_payments,
coalesce((select count(*) from public.food_orders where user_id=p.id and pickup_date=current_date),0) orders_today
from public.profiles p where p.id=auth.uid() and p.role='student';

drop view if exists public.v_parent_dashboard;
create view public.v_parent_dashboard with (security_invoker=true) as
select par.id parent_id,par.full_name parent_name,ch.id student_id,ch.full_name child_name,
coalesce((select c.name from public.class_members cm join public.classes c on c.id=cm.class_id where cm.student_id=ch.id limit 1),'—') class_name,
coalesce((select round(sum(g.value*s.coefficient)/nullif(sum(s.coefficient),0),2) from public.grades g join public.subjects s on s.id=g.subject_id where g.student_id=ch.id),0) average,
coalesce((select sum(amount_xof) from public.school_payments where user_id=ch.id and status='pending'),0) pending_payments
from public.profiles par join public.parent_students ps on ps.parent_id=par.id join public.profiles ch on ch.id=ps.student_id
where par.id=auth.uid() and par.role='parent';

drop view if exists public.v_teacher_dashboard;
create view public.v_teacher_dashboard with (security_invoker=true) as
select p.id,p.full_name,
coalesce((select count(*) from public.schedule s where s.teacher_id=p.id and s.weekday=extract(isodow from current_date)::int),0) today_classes,
coalesce((select count(distinct s.class_id) from public.schedule s where s.teacher_id=p.id),0) classes,
coalesce((select count(*) from public.grades where created_at::date=current_date),0) grades_today,
coalesce((select count(*) from public.grades),0) grades_total
from public.profiles p where p.id=auth.uid() and p.role='teacher';

drop view if exists public.v_admin_dashboard;
create view public.v_admin_dashboard with (security_invoker=true) as
select p.id,
(select count(*) from public.profiles where school_id=p.school_id and role='student') students,
(select count(*) from public.profiles where school_id=p.school_id and role='teacher') teachers,
(select count(*) from public.food_orders where pickup_date=current_date) orders_today,
(select coalesce(sum(amount_xof),0) from public.school_payments where status='pending') unpaid_total,
(select count(*) from public.schedule) scheduled_lessons
from public.profiles p where p.id=auth.uid() and p.role='admin';

drop view if exists public.v_director_dashboard;
create view public.v_director_dashboard with (security_invoker=true) as
select s.id school_id,s.name school_name,s.city,ss.plan,ss.status subscription_status,ss.billing_price_xof,ss.current_period_end,rc.code referral_code,
(select count(*) from public.referrals r where r.referrer_id=s.director_id) referrals_total,
(select count(*) from public.referrals r where r.referrer_id=s.director_id and r.status='rewarded') referrals_rewarded
from public.schools s
left join lateral (select * from public.school_subscriptions x where x.school_id=s.id order by x.created_at desc limit 1) ss on true
left join public.referral_codes rc on rc.owner_id=s.director_id
where s.director_id=auth.uid();

drop view if exists public.v_cafeteria_dashboard;
create view public.v_cafeteria_dashboard with (security_invoker=true) as
select p.id,
coalesce((select count(*) from public.food_orders where pickup_date=current_date),0) orders_today,
coalesce((select count(*) from public.food_orders where pickup_date=current_date and status='ready'),0) ready_today,
coalesce((select count(*) from public.food_orders where pickup_date=current_date and status='preparing'),0) preparing_today,
coalesce((select sum(total_xof) from public.food_orders where pickup_date=current_date and status<>'cancelled'),0) revenue_today,
coalesce((select count(*) from public.food_items where active),0) active_menu
from public.profiles p where p.id=auth.uid() and p.role='cafeteria';

grant select on public.v_student_dashboard,public.v_parent_dashboard,public.v_teacher_dashboard,public.v_admin_dashboard,public.v_director_dashboard,public.v_cafeteria_dashboard to authenticated;
