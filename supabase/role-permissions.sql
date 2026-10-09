-- École OS — granular role permissions / food RLS
-- Important: anonymous users must NEVER evaluate the authenticated-only helper.
-- The previous combined anon+authenticated policy could surface:
--   permission denied for function private.is_food_staff

create or replace function private.is_food_staff()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.profiles
    where id = (select auth.uid())
      and role in ('admin','cafeteria')
  );
$$;

create or replace function private.is_staff()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.profiles
    where id = (select auth.uid())
      and role in ('admin','teacher','cafeteria')
  );
$$;

create or replace function private.is_parent_of(p_student_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.parent_students
    where parent_id = (select auth.uid())
      and student_id = p_student_id
  );
$$;

-- The helper is internal. Only authenticated users need to call it from RLS.
grant usage on schema private to authenticated;
revoke execute on function private.is_food_staff() from public;
revoke execute on function private.is_staff() from public;
revoke execute on function private.is_parent_of(uuid) from public;
grant execute on function private.is_food_staff() to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_parent_of(uuid) to authenticated;

-- Profiles: a user can edit only harmless profile fields on their own row.
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

revoke update on public.profiles from authenticated;
revoke update on public.profiles from public, anon, authenticated;
grant update(full_name,updated_at) on public.profiles to authenticated;

-- FOOD
-- Anonymous: active menu only, with NO call to an authenticated-only function.
drop policy if exists food_public_read on public.food_items;
drop policy if exists food_anon_read on public.food_items;
drop policy if exists food_authenticated_read on public.food_items;
create policy food_anon_read
on public.food_items
for select to anon
using (active = true);

create policy food_authenticated_read
on public.food_items
for select to authenticated
using (active = true or (select private.is_food_staff()));

drop policy if exists food_staff_insert on public.food_items;
drop policy if exists food_staff_update on public.food_items;
drop policy if exists food_staff_delete on public.food_items;
create policy food_staff_insert on public.food_items
for insert to authenticated
with check ((select private.is_food_staff()));
create policy food_staff_update on public.food_items
for update to authenticated
using ((select private.is_food_staff()))
with check ((select private.is_food_staff()));
create policy food_staff_delete on public.food_items
for delete to authenticated
using ((select private.is_food_staff()));

-- Orders: owner or food staff.
drop policy if exists orders_self on public.food_orders;
create policy orders_self on public.food_orders
for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_food_staff()));

drop policy if exists order_items_self on public.food_order_items;
create policy order_items_self on public.food_order_items
for select to authenticated
using (
  exists(
    select 1 from public.food_orders o
    where o.id = food_order_items.order_id
      and (o.user_id = (select auth.uid()) or (select private.is_food_staff()))
  )
);
