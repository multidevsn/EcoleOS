-- Jeu de données fictif pour le mode démo.
-- Les tables demo_* sont séparées des données de production.

create table if not exists public.demo_profiles(id uuid primary key,full_name text not null,role public.app_role not null,class_name text,child_name text,email text not null);
create table if not exists public.demo_grades(id uuid primary key default gen_random_uuid(),profile_id uuid references public.demo_profiles(id) on delete cascade,subject text not null,value numeric(5,2) not null,coefficient numeric(5,2) not null default 1,term text not null default 'T1');
create table if not exists public.demo_schedule(id uuid primary key default gen_random_uuid(),profile_id uuid references public.demo_profiles(id) on delete cascade,weekday smallint not null,starts_at time not null,ends_at time not null,subject text not null,room text not null,class_name text not null);
create table if not exists public.demo_payments(id uuid primary key default gen_random_uuid(),profile_id uuid references public.demo_profiles(id) on delete cascade,description text not null,amount_xof integer not null,status public.payment_status not null default 'pending',due_date date);
create table if not exists public.demo_points(id uuid primary key default gen_random_uuid(),profile_id uuid references public.demo_profiles(id) on delete cascade,points integer not null,reason text not null,created_at timestamptz not null default now());
create table if not exists public.demo_orders(id uuid primary key default gen_random_uuid(),profile_id uuid references public.demo_profiles(id) on delete cascade,total_xof integer not null,status public.order_status not null default 'completed',pickup_date date,pickup_slot text,created_at timestamptz not null default now());

alter table public.demo_profiles enable row level security;
alter table public.demo_grades enable row level security;
alter table public.demo_schedule enable row level security;
alter table public.demo_payments enable row level security;
alter table public.demo_points enable row level security;
alter table public.demo_orders enable row level security;

grant select on public.demo_profiles,public.demo_grades,public.demo_schedule,public.demo_payments,public.demo_points,public.demo_orders to anon,authenticated;

drop policy if exists demo_profiles_read on public.demo_profiles;
create policy demo_profiles_read on public.demo_profiles for select to anon,authenticated using(true);
drop policy if exists demo_grades_read on public.demo_grades;
create policy demo_grades_read on public.demo_grades for select to anon,authenticated using(true);
drop policy if exists demo_schedule_read on public.demo_schedule;
create policy demo_schedule_read on public.demo_schedule for select to anon,authenticated using(true);
drop policy if exists demo_payments_read on public.demo_payments;
create policy demo_payments_read on public.demo_payments for select to anon,authenticated using(true);
drop policy if exists demo_points_read on public.demo_points;
create policy demo_points_read on public.demo_points for select to anon,authenticated using(true);
drop policy if exists demo_orders_read on public.demo_orders;
create policy demo_orders_read on public.demo_orders for select to anon,authenticated using(true);

insert into public.demo_profiles(id,full_name,role,class_name,child_name,email) values
('00000000-0000-0000-0000-000000000101','Amadou Ndiaye','student','Terminale S2',null,'amadou.demo@ecole.sn'),
('00000000-0000-0000-0000-000000000102','Fatou Ndiaye','parent',null,'Amadou Ndiaye','fatou.demo@ecole.sn'),
('00000000-0000-0000-0000-000000000103','Moussa Diop','teacher','Terminale S1',null,'moussa.demo@ecole.sn'),
('00000000-0000-0000-0000-000000000104','Awa Fall','admin',null,null,'awa.demo@ecole.sn'),
('00000000-0000-0000-0000-000000000105','Cheikh Ba','cafeteria',null,null,'cheikh.demo@ecole.sn')
on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,class_name=excluded.class_name,child_name=excluded.child_name,email=excluded.email;

truncate public.demo_grades,public.demo_schedule,public.demo_payments,public.demo_points,public.demo_orders restart identity;
insert into public.demo_grades(profile_id,subject,value,coefficient,term) values
('00000000-0000-0000-0000-000000000101','Mathématiques',16,2,'T1'),('00000000-0000-0000-0000-000000000101','Physique',14,2,'T1'),('00000000-0000-0000-0000-000000000101','Français',15,1,'T1'),('00000000-0000-0000-0000-000000000101','Anglais',17,1,'T1'),('00000000-0000-0000-0000-000000000101','Informatique',18,2,'T1');
insert into public.demo_schedule(profile_id,weekday,starts_at,ends_at,subject,room,class_name) values
('00000000-0000-0000-0000-000000000101',1,'08:00','10:00','Mathématiques','Salle A12','Terminale S2'),('00000000-0000-0000-0000-000000000101',1,'10:15','12:00','Physique','Salle B04','Terminale S2'),('00000000-0000-0000-0000-000000000101',1,'14:00','16:00','Informatique','Lab 2','Terminale S2'),('00000000-0000-0000-0000-000000000101',3,'09:00','11:00','Mathématiques','Salle A12','Terminale S2'),('00000000-0000-0000-0000-000000000101',3,'14:00','16:00','Physique','Salle B04','Terminale S2'),
('00000000-0000-0000-0000-000000000103',2,'08:00','10:00','Mathématiques','Salle A12','Terminale S1'),('00000000-0000-0000-0000-000000000103',2,'10:15','12:00','Algorithmes','Lab 1','Terminale S1'),('00000000-0000-0000-0000-000000000103',4,'14:00','16:00','Mathématiques','Salle B04','Terminale S1');
insert into public.demo_payments(profile_id,description,amount_xof,status,due_date) values
('00000000-0000-0000-0000-000000000101','Septembre 2026',45000,'pending','2026-09-30'),('00000000-0000-0000-0000-000000000101','Août 2026',45000,'succeeded','2026-08-31'),('00000000-0000-0000-0000-000000000101','Octobre 2026',45000,'pending','2026-10-31');
insert into public.demo_points(profile_id,points,reason,created_at) values
('00000000-0000-0000-0000-000000000101',120,'Très bonne note en informatique','2026-09-18'),('00000000-0000-0000-0000-000000000101',50,'Présence ponctuelle','2026-09-17'),('00000000-0000-0000-0000-000000000101',80,'Participation en classe','2026-09-20'),('00000000-0000-0000-0000-000000000101',990,'Solde initial de démonstration','2026-09-01');
insert into public.demo_orders(profile_id,total_xof,status,pickup_date,pickup_slot,created_at) values
('00000000-0000-0000-0000-000000000101',3000,'completed','2026-09-22','12:30–12:40','2026-09-22 08:14:00+00'),('00000000-0000-0000-0000-000000000101',1500,'ready','2026-09-23','12:30–12:40','2026-09-23 08:42:00+00'),('00000000-0000-0000-0000-000000000105',12500,'preparing','2026-09-23','12:00–12:15','2026-09-23 09:02:00+00'),('00000000-0000-0000-0000-000000000105',9000,'ready','2026-09-23','12:15–12:30','2026-09-23 09:07:00+00'),('00000000-0000-0000-0000-000000000105',6500,'completed','2026-09-22','12:30–12:45','2026-09-22 09:01:00+00');
