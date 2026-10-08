-- Restore the Food catalogue on projects where the base SQL was only partially applied.
-- Safe to run more than once; existing item names and prices are deliberately preserved.

create table if not exists public.food_items (
  id text primary key,
  name text not null,
  price_xof integer not null check (price_xof > 0),
  active boolean not null default true
);

alter table public.food_items enable row level security;
grant select on public.food_items to anon, authenticated;

-- The demo login is anonymous, so it needs a separate active-menu read policy.
drop policy if exists food_catalog_anon_read on public.food_items;
create policy food_catalog_anon_read
  on public.food_items for select to anon
  using (active = true);

drop policy if exists food_catalog_authenticated_read on public.food_items;
create policy food_catalog_authenticated_read
  on public.food_items for select to authenticated
  using (active = true);

insert into public.food_items (id, name, price_xof, active)
values
  ('burger', 'Burger maison', 1500, true),
  ('sandwich', 'Sandwich poulet', 1000, true),
  ('pizza', 'Mini pizza', 2000, true),
  ('drink', 'Boisson', 500, true)
on conflict (id) do nothing;
