-- Patch V1 multi-utilisateurs : relation parent/enfant + jeu de démo.

create table if not exists public.parent_students(
  parent_id uuid references public.profiles(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  primary key(parent_id,student_id)
);

create or replace function private.is_parent_of(p_student_id uuid)
returns boolean language sql security definer set search_path=public
as $$ select exists(select 1 from public.parent_students where parent_id=auth.uid() and student_id=p_student_id); $$;
revoke all on function private.is_parent_of(uuid) from public;
grant execute on function private.is_parent_of(uuid) to authenticated;

drop policy if exists parent_students_self on public.parent_students;
create policy parent_students_self on public.parent_students for select to authenticated using(parent_id=auth.uid() or student_id=auth.uid() or (select private.is_staff()));

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select to authenticated using(id=auth.uid() or (select private.is_parent_of(id)) or (select private.is_staff()));
drop policy if exists members_self on public.class_members;
create policy members_self on public.class_members for select to authenticated using(student_id=auth.uid() or (select private.is_parent_of(student_id)) or (select private.is_staff()));
drop policy if exists grades_self on public.grades;
create policy grades_self on public.grades for select to authenticated using(student_id=auth.uid() or (select private.is_parent_of(student_id)) or (select private.is_staff()));
drop policy if exists payments_self on public.school_payments;
create policy payments_self on public.school_payments for select to authenticated using(user_id=auth.uid() or (select private.is_parent_of(user_id)) or (select private.is_staff()));

-- Le reste des tables de démonstration est dans demo.sql.
