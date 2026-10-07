-- Correctif : un directeur qui inscrit son école ne doit pas rester « Élève ».
--
-- Origine du bug : `handle_new_user()` créait TOUJOURS le profil avec le rôle par défaut
-- 'student'. La promotion en 'director' n'arrivait que si `/api/onboarding/school`
-- aboutissait. Avec la confirmation d'email activée, `signUp` ne renvoie pas de session :
-- la finalisation était repoussée, et tout échec laissait le directeur classé Élève
-- de façon définitive, sans aucun moyen de réparation.
--
-- Ce correctif agit sur les deux plans :
--   1. le rôle demandé à l'inscription est honoré, mais uniquement pour 'director'
--      (seul rôle qu'un compte peut légitimement réclamer seul) ;
--   2. la transaction d'onboarding répare un profil désaligné au lieu de refuser.

-- 1. Rôle demandé à l'inscription -------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
begin
  -- Un nouveau compte n'a le droit de se déclarer que « director » : c'est le seul rôle
  -- accessible par auto-inscription. Toute autre valeur (y compris 'admin') retombe sur
  -- le rôle par défaut 'student'. Le rattachement à un établissement reste, lui, contrôlé
  -- par create_school_onboarding() côté service_role.
  v_role := 'student';
  if lower(coalesce(new.raw_user_meta_data ->> 'role', '')) = 'director' then
    v_role := 'director';
  end if;

  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), v_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- 2. Réparation d'un onboarding partiel -------------------------------------------------
-- Remplace la branche qui levait ONBOARDING_INCOMPLETE quand l'école existait mais que le
-- profil n'était pas (ou plus) aligné : la transaction répare maintenant le profil et
-- renvoie l'état réel, exactement comme un rejeu idempotent.
create or replace function public.create_school_onboarding(
  p_director_id uuid,
  p_school_name text,
  p_city text,
  p_plan text,
  p_referral_code text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_profile_school_id uuid;
  v_profile_role public.profiles.role%type;
  v_existing_school public.schools%rowtype;
  v_plan public.subscription_plan;
  v_price_xof integer;
  v_referrer_id uuid;
  v_referral_id uuid;
  v_referral_code text;
  v_existing_referral_code text;
  v_candidate_code text;
  v_school_id uuid;
  v_cycle_id uuid;
  v_subscription public.school_subscriptions%rowtype;
  v_attempt integer;
  v_repaired boolean := false;
begin
  if p_director_id is null
     or p_school_name is null
     or pg_catalog.length(pg_catalog.btrim(p_school_name)) not between 1 and 120
     or p_city is null
     or pg_catalog.length(pg_catalog.btrim(p_city)) not between 1 and 100
     or p_plan is null
     or pg_catalog.lower(pg_catalog.btrim(p_plan)) not in ('simple', 'extra')
     or pg_catalog.length(coalesce(p_referral_code, '')) > 40 then
    raise exception using message = 'ONBOARDING_INVALID_INPUT', errcode = '22023';
  end if;

  select p.school_id, p.role
    into v_profile_school_id, v_profile_role
    from public.profiles as p
   where p.id = p_director_id
   for update;
  if not found then
    raise exception using message = 'ONBOARDING_PROFILE_NOT_FOUND', errcode = 'P0002';
  end if;

  select s.*
    into v_existing_school
    from public.schools as s
   where s.director_id = p_director_id;

  if found then
    select ss.*
      into v_subscription
      from public.school_subscriptions as ss
     where ss.school_id = v_existing_school.id
     order by ss.created_at desc, ss.id desc
     limit 1;
    if not found then
      raise exception using message = 'ONBOARDING_INCOMPLETE', errcode = '55000';
    end if;

    select rc.code
      into v_referral_code
      from public.referral_codes as rc
     where rc.owner_id = p_director_id;

    -- Réparation : l'école existe mais le profil n'a pas été promu (échec d'un onboarding
    -- antérieur, import manuel, ou inscription antérieure au correctif de rôle).
    if v_referral_code is null
       or v_profile_school_id is distinct from v_existing_school.id
       or v_profile_role::text is distinct from 'director' then

      update public.profiles
         set role = 'director',
             school_id = v_existing_school.id,
             updated_at = pg_catalog.now()
       where id = p_director_id;
      v_profile_school_id := v_existing_school.id;
      v_profile_role := 'director';
      v_repaired := true;

      if v_referral_code is null then
        for v_attempt in 1..10 loop
          v_candidate_code := 'EO-' || pg_catalog.upper(
            pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 10)
          );
          insert into public.referral_codes (owner_id, code)
          values (p_director_id, v_candidate_code)
          on conflict (code) do nothing
          returning code into v_referral_code;
          if v_referral_code is not null then
            exit;
          end if;
        end loop;
        if v_referral_code is null then
          raise exception using message = 'ONBOARDING_REFERRAL_CODE_FAILED', errcode = '23505';
        end if;
      end if;
    end if;

    if not exists (
      select 1 from public.school_billing_settings as sbs
       where sbs.school_id = v_existing_school.id
    ) then
      insert into public.school_billing_settings (
        school_id, autopilot_enabled, auto_scaling_enabled, usage_pricing_enabled
      ) values (v_existing_school.id, true, true, true)
      on conflict (school_id) do nothing;
      v_repaired := true;
    end if;

    if v_subscription.referral_id is not null then
      select r.referral_code
        into v_existing_referral_code
        from public.referrals as r
       where r.id = v_subscription.referral_id;
    end if;

    -- Un rejeu avec la même demande est un succès en lecture seule.
    if not v_repaired
       and (v_existing_school.name is distinct from pg_catalog.btrim(p_school_name)
            or v_existing_school.city is distinct from pg_catalog.btrim(p_city)
            or v_subscription.plan::text is distinct from pg_catalog.lower(pg_catalog.btrim(p_plan))
            or coalesce(v_existing_referral_code, '') is distinct from
               coalesce(nullif(pg_catalog.upper(pg_catalog.btrim(p_referral_code)), ''), '')) then
      raise exception using message = 'ONBOARDING_SCHOOL_ALREADY_EXISTS', errcode = '23505';
    end if;

    return pg_catalog.jsonb_build_object(
      'school_id', v_existing_school.id,
      'school_name', v_existing_school.name,
      'city', v_existing_school.city,
      'plan', v_subscription.plan::text,
      'price_xof', v_subscription.billing_price_xof,
      'referral_code', v_referral_code,
      'role', 'director',
      'repaired', v_repaired,
      'replayed', not v_repaired
    );
  end if;

  if v_profile_school_id is not null then
    raise exception using message = 'ONBOARDING_PROFILE_ALREADY_LINKED', errcode = '23505';
  end if;

  select sp.id, sp.price_xof
    into v_plan, v_price_xof
    from public.subscription_plans as sp
   where sp.id::text = pg_catalog.lower(pg_catalog.btrim(p_plan))
     and sp.active = true;
  if not found then
    raise exception using message = 'ONBOARDING_PLAN_UNAVAILABLE', errcode = '22023';
  end if;

  if nullif(pg_catalog.btrim(p_referral_code), '') is not null then
    select rc.owner_id
      into v_referrer_id
      from public.referral_codes as rc
     where rc.code = pg_catalog.upper(pg_catalog.btrim(p_referral_code))
     for key share;
    if not found then
      raise exception using message = 'ONBOARDING_REFERRAL_INVALID', errcode = '22023';
    end if;
    if v_referrer_id = p_director_id then
      raise exception using message = 'ONBOARDING_REFERRAL_SELF', errcode = '22023';
    end if;
  end if;

  insert into public.schools(name, city, director_id)
  values (pg_catalog.btrim(p_school_name), pg_catalog.btrim(p_city), p_director_id)
  returning id into v_school_id;

  update public.profiles
     set role = 'director', school_id = v_school_id, updated_at = pg_catalog.now()
   where id = p_director_id;
  if not found then
    raise exception using message = 'ONBOARDING_PROFILE_NOT_FOUND', errcode = 'P0002';
  end if;

  select rc.code
    into v_referral_code
    from public.referral_codes as rc
   where rc.owner_id = p_director_id;
  if not found then
    for v_attempt in 1..10 loop
      v_candidate_code := 'EO-' || pg_catalog.upper(
        pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 10)
      );
      insert into public.referral_codes(owner_id, code)
      values (p_director_id, v_candidate_code)
      on conflict (code) do nothing
      returning code into v_referral_code;
      if v_referral_code is not null then
        exit;
      end if;
    end loop;
    if v_referral_code is null then
      raise exception using message = 'ONBOARDING_REFERRAL_CODE_FAILED', errcode = '23505';
    end if;
  end if;

  if v_referrer_id is not null then
    insert into public.referrals(referrer_id, referred_school_id, referral_code)
    values (v_referrer_id, v_school_id, pg_catalog.upper(pg_catalog.btrim(p_referral_code)))
    returning id into v_referral_id;
  end if;

  insert into public.school_subscriptions(
    school_id, plan, status, billing_price_xof, referral_id
  ) values (
    v_school_id, v_plan, 'pending', v_price_xof, v_referral_id
  );

  insert into public.school_billing_settings(
    school_id, autopilot_enabled, auto_scaling_enabled, usage_pricing_enabled
  ) values (v_school_id, true, true, true)
  on conflict (school_id) do nothing;

  v_cycle_id := public.ensure_school_billing_cycle(
    v_school_id,
    pg_catalog.date_trunc('month', pg_catalog.statement_timestamp())::date
  );
  if v_cycle_id is null then
    raise exception using message = 'ONBOARDING_BILLING_CYCLE_FAILED', errcode = '55000';
  end if;

  return pg_catalog.jsonb_build_object(
    'school_id', v_school_id,
    'school_name', pg_catalog.btrim(p_school_name),
    'city', pg_catalog.btrim(p_city),
    'plan', v_plan::text,
    'price_xof', v_price_xof,
    'referral_code', v_referral_code,
    'role', 'director',
    'repaired', false,
    'replayed', false
  );
end;
$function$;

revoke all on function public.create_school_onboarding(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_school_onboarding(uuid, text, text, text, text)
  to service_role;

-- 3. Réparation des comptes déjà créés --------------------------------------------------
-- Tout profil qui possède une école mais n'est pas marqué 'director' est réaligné.
update public.profiles as p
   set role = 'director', updated_at = now()
  from public.schools as s
 where s.director_id = p.id
   and p.role <> 'director';
