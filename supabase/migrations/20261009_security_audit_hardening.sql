-- École OS — durcissement des champs d'identité et de privilège des profils.
-- Les changements de rôle / rattachement / identifiant scolaire sont réservés au serveur
-- (clé service_role), jamais à un jeton utilisateur, même si une policy RLS est élargie.

revoke update on table public.profiles from public, anon, authenticated;
grant update (full_name, updated_at) on table public.profiles to authenticated;

create or replace function private.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Le service_role et les triggers d'inscription côté serveur n'ont généralement pas auth.uid().
  -- Les clients authentifiés ne doivent jamais pouvoir s'attribuer des privilèges ni changer
  -- le rattachement scolaire / le code d'un autre profil.
  if auth.uid() is not null and (
       new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.school_id is distinct from old.school_id
       or new.student_code is distinct from old.student_code
     ) then
    raise exception using
      errcode = '42501',
      message = 'Les champs de rôle et de rattachement scolaire doivent être modifiés via une opération serveur autorisée.';
  end if;
  return new;
end;
$function$;

revoke all on function private.guard_profile_privileged_columns() from public, anon, authenticated;
drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
before update on public.profiles
for each row execute function private.guard_profile_privileged_columns();

comment on function private.guard_profile_privileged_columns() is
  'Bloque la modification côté client de role, school_id, student_code et id. Les opérations service_role restent possibles.';


-- Wave webhook events must be retryable until all business updates have succeeded.
alter table public.wave_events add column if not exists processed_at timestamptz;
alter table public.wave_events add column if not exists last_error text;
create index if not exists wave_events_unprocessed_idx
  on public.wave_events(received_at) where processed_at is null;
revoke all on public.wave_events from public, anon, authenticated;

-- Store the exact amount sent to Wave; recomputing from a later subscription state is unsafe.
alter table public.billing_cycles
  add column if not exists provider_checkout_amount_xof integer;

alter table public.paddle_events add column if not exists last_error text;
