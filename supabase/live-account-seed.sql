-- Seed for the real authenticated student account used during V1 testing.
-- The account UUID must exist in auth.users before running this script.
-- Current V1 test account: fc78c078-41cf-4542-a06f-fcc19d950f58

update public.profiles
set full_name='Watia Sampeu', role='student', student_code='ETU-2026-001', updated_at=now()
where id='fc78c078-41cf-4542-a06f-fcc19d950f58'::uuid;

insert into public.classes(id,name,school_year) values
('20000000-0000-0000-0000-000000000001','Terminale S2','2026-2027')
on conflict(id) do update set name=excluded.name,school_year=excluded.school_year;

insert into public.class_members(class_id,student_id) values
('20000000-0000-0000-0000-000000000001'::uuid,'fc78c078-41cf-4542-a06f-fcc19d950f58'::uuid)
on conflict do nothing;

insert into public.subjects(id,name,coefficient) values
('30000000-0000-0000-0000-000000000001','Mathématiques',4),
('30000000-0000-0000-0000-000000000002','Physique-Chimie',4),
('30000000-0000-0000-0000-000000000003','Français',3),
('30000000-0000-0000-0000-000000000004','Anglais',2),
('30000000-0000-0000-0000-000000000005','Histoire-Géographie',2),
('30000000-0000-0000-0000-000000000006','Philosophie',2)
on conflict(id) do update set name=excluded.name,coefficient=excluded.coefficient;

insert into public.schedule(id,class_id,subject_id,teacher_id,room,weekday,starts_at,ends_at) values
('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'::uuid,null,'Salle A12',1,'08:00','10:00'),
('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003'::uuid,null,'Salle B04',1,'10:15','12:15'),
('40000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002'::uuid,null,'Lab Physique',2,'08:00','10:00'),
('40000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004'::uuid,null,'Salle C02',2,'10:15','12:15'),
('40000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000005'::uuid,null,'Salle A06',3,'08:00','09:30'),
('40000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'::uuid,null,'Salle A12',3,'09:45','11:45'),
('40000000-0000-0000-0000-000000000007','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000006'::uuid,null,'Salle B09',4,'08:00','10:00'),
('40000000-0000-0000-0000-000000000008','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002'::uuid,null,'Lab Physique',4,'10:15','12:15'),
('40000000-0000-0000-0000-000000000009','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003'::uuid,null,'Salle B04',5,'08:00','10:00'),
('40000000-0000-0000-0000-000000000010','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004'::uuid,null,'Salle C02',5,'10:15','12:15')
on conflict(id) do update set room=excluded.room,weekday=excluded.weekday,starts_at=excluded.starts_at,ends_at=excluded.ends_at;

insert into public.grades(id,student_id,subject_id,value,term) values
('50000000-0000-0000-0000-000000000001','fc78c078-41cf-4542-a06f-fcc19d950f58'::uuid,'30000000-0000-0000-0000-000000000001'::uuid,16.5,'T1'),
('50000000-0000-0000-0000-000000000002','fc78c078-41cf-4542-a06f-fcc19d950f58'::uuid,'30000000-0000-0000-0000-000000000001'::uuid,14.0,'T1'),
('50000000-0000-0000-0000-000000000003','fc78c078-41cf-4542-a06f-fcc19d950f58'::uuid,'30000000-0000-0000-0000-000000000002'::uuid,15.5,'T1'),
('50000000-0000-0000-0000-000000000004','fc78c078-41cf-4542-a06f-fcc19d950f58'::uuid,'30000000-0000-0000-0000-000000000003'::uuid,17.0,'T1'),
('50000000-0000-0000-0000-000000000005','fc78c078-41cf-4542-a06f-fcc19d950f58'::uuid,'30000000-0000-0000-0000-000000000004'::uuid,16.0,'T1'),
('50000000-0000-0000-0000-000000000006','fc78c078-41cf-4542-a06f-fcc19d950f58'::uuid,'30000000-0000-0000-0000-000000000005'::uuid,13.5,'T1'),
('50000000-0000-0000-0000-000000000007','fc78c078-41cf-4542-a06f-fcc19d950f58'::uuid,'30000000-0000-0000-0000-000000000006'::uuid,14.5,'T1'),
('50000000-0000-0000-0000-000000000008','fc78c078-41cf-4542-a06f-fcc19d950f58'::uuid,'30000000-0000-0000-0000-000000000002'::uuid,16.0,'T1'),
('50000000-0000-0000-0000-000000000009','fc78c078-41cf-4542-a06f-fcc19d950f58'::uuid,'30000000-0000-0000-0000-000000000003'::uuid,15.0,'T1')
on conflict(id) do update set value=excluded.value,term=excluded.term,subject_id=excluded.subject_id;

insert into public.school_payments(id,user_id,description,amount_xof,status,due_date) values
('60000000-0000-0000-0000-000000000001','fc78c078-41cf-4542-a06f-fcc19d950f58'::uuid,'Scolarité · Octobre 2026',45000,'pending','2026-10-05'),
('60000000-0000-0000-0000-000000000002','fc78c078-41cf-4542-a06f-fcc19d950f58'::uuid,'Inscription annuelle',15000,'succeeded','2026-09-01')
on conflict(id) do update set description=excluded.description,amount_xof=excluded.amount_xof,status=excluded.status,due_date=excluded.due_date;

insert into public.point_ledger(id,user_id,points,reason,created_at) values
('70000000-0000-0000-0000-000000000001','fc78c078-41cf-4542-a06f-fcc19d950f58'::uuid,250,'Présence exemplaire','2026-09-18T08:00:00Z'),
('70000000-0000-0000-0000-000000000002','fc78c078-41cf-4542-a06f-fcc19d950f58'::uuid,180,'Devoirs rendus à temps','2026-09-19T16:30:00Z'),
('70000000-0000-0000-0000-000000000003','fc78c078-41cf-4542-a06f-fcc19d950f58'::uuid,-40,'Retard en étude','2026-09-20T10:00:00Z')
on conflict(id) do update set points=excluded.points,reason=excluded.reason,created_at=excluded.created_at;

insert into public.food_orders(id,user_id,total_xof,status,pickup_date,pickup_slot) values
('80000000-0000-0000-0000-000000000001','fc78c078-41cf-4542-a06f-fcc19d950f58'::uuid,3000,'completed','2026-09-22','12:30–12:40')
on conflict(id) do update set total_xof=excluded.total_xof,status=excluded.status,pickup_date=excluded.pickup_date,pickup_slot=excluded.pickup_slot;

insert into public.food_order_items(id,order_id,food_item_id,quantity,unit_price_xof) values
('81000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001'::uuid,'burger',1,1500),
('81000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000001'::uuid,'sandwich',1,1000),
('81000000-0000-0000-0000-000000000003','80000000-0000-0000-0000-000000000001'::uuid,'drink',1,500)
on conflict(id) do update set quantity=excluded.quantity,unit_price_xof=excluded.unit_price_xof;
