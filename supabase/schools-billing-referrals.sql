DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'director';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_plan AS ENUM ('simple','extra');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('pending','active','past_due','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.referral_status AS ENUM ('pending','qualified','rewarded','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id uuid;

CREATE TABLE IF NOT EXISTS public.schools(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  director_id uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscription_plans(
  id public.subscription_plan PRIMARY KEY,
  name text NOT NULL,
  price_xof integer NOT NULL,
  ads_enabled boolean NOT NULL DEFAULT true,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.school_subscriptions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  plan public.subscription_plan NOT NULL,
  status public.subscription_status NOT NULL DEFAULT 'pending',
  billing_price_xof integer NOT NULL,
  current_period_end date,
  wave_checkout_id text UNIQUE,
  wave_transaction_id text UNIQUE,
  referral_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referral_codes(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referrals(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  referred_school_id uuid UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  referral_code text NOT NULL REFERENCES public.referral_codes(code) ON DELETE RESTRICT,
  status public.referral_status NOT NULL DEFAULT 'pending',
  qualified_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.school_subscriptions DROP CONSTRAINT IF EXISTS school_subscriptions_referral_id_fkey;
ALTER TABLE public.school_subscriptions ADD CONSTRAINT school_subscriptions_referral_id_fkey FOREIGN KEY (referral_id) REFERENCES public.referrals(id) ON DELETE SET NULL;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_school_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE SET NULL;

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.schools,public.subscription_plans,public.school_subscriptions,public.referral_codes,public.referrals TO authenticated;

DROP POLICY IF EXISTS school_owner_read ON public.schools;
CREATE POLICY school_owner_read ON public.schools FOR SELECT TO authenticated
USING(director_id=auth.uid() OR (select private.is_staff()));

DROP POLICY IF EXISTS plans_read ON public.subscription_plans;
CREATE POLICY plans_read ON public.subscription_plans FOR SELECT TO authenticated USING(active=true OR (select private.is_staff()));

DROP POLICY IF EXISTS subscription_owner_read ON public.school_subscriptions;
CREATE POLICY subscription_owner_read ON public.school_subscriptions FOR SELECT TO authenticated
USING(exists(select 1 from public.schools s where s.id=school_id and (s.director_id=auth.uid() or (select private.is_staff()))));

DROP POLICY IF EXISTS referral_code_owner_read ON public.referral_codes;
CREATE POLICY referral_code_owner_read ON public.referral_codes FOR SELECT TO authenticated
USING(owner_id=auth.uid() OR (select private.is_staff()));

DROP POLICY IF EXISTS referral_owner_read ON public.referrals;
CREATE POLICY referral_owner_read ON public.referrals FOR SELECT TO authenticated
USING(referrer_id=auth.uid() OR exists(select 1 from public.schools s where s.id=referred_school_id and s.director_id=auth.uid()) OR (select private.is_staff()));

INSERT INTO public.subscription_plans(id,name,price_xof,ads_enabled,features)
VALUES
('simple','Simple',5000,true,'["Accueil","Notes","Emploi du temps","Food","Paiements","Points"]'::jsonb),
('extra','Extra',10000,false,'["Toutes les fonctions Simple","Sans publicité","Automatisations avancées","Statistiques école","Priorité support"]'::jsonb)
ON CONFLICT(id) DO UPDATE SET name=excluded.name,price_xof=excluded.price_xof,ads_enabled=excluded.ads_enabled,features=excluded.features;

-- Demo school + director profile association.
INSERT INTO public.profiles(id,full_name,role,email)
VALUES('00000000-0000-0000-0000-000000000106','Ibrahima Sarr','director','directeur.demo@ecole.sn')
ON CONFLICT(id) DO UPDATE SET full_name=excluded.full_name,role='director',email=excluded.email;

INSERT INTO public.schools(id,name,city,director_id)
VALUES('00000000-0000-0000-0000-000000000201','École Démo Horizon','Dakar','00000000-0000-0000-0000-000000000106')
ON CONFLICT(id) DO UPDATE SET name=excluded.name,city=excluded.city,director_id=excluded.director_id;
UPDATE public.profiles SET school_id='00000000-0000-0000-0000-000000000201' WHERE id='00000000-0000-0000-0000-000000000106';
INSERT INTO public.referral_codes(owner_id,code) VALUES('00000000-0000-0000-0000-000000000106','EO-DEMO01') ON CONFLICT(owner_id) DO UPDATE SET code='EO-DEMO01';
INSERT INTO public.school_subscriptions(id,school_id,plan,status,billing_price_xof,current_period_end)
VALUES('00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000201','simple','active',5000,'2026-10-31')
ON CONFLICT(id) DO UPDATE SET plan='simple',status='active',billing_price_xof=5000,current_period_end='2026-10-31';


CREATE TABLE IF NOT EXISTS public.demo_school_accounts(id uuid primary key default gen_random_uuid(),profile_id uuid unique not null references public.demo_profiles(id) on delete cascade,school_name text not null,city text not null,plan public.subscription_plan not null,status text not null,price_xof integer not null,period_end date,referral_code text);
ALTER TABLE public.demo_school_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.demo_school_accounts TO anon,authenticated;
DROP POLICY IF EXISTS demo_school_accounts_read ON public.demo_school_accounts;
CREATE POLICY demo_school_accounts_read ON public.demo_school_accounts FOR SELECT TO anon,authenticated USING(true);
INSERT INTO public.demo_school_accounts(profile_id,school_name,city,plan,status,price_xof,period_end,referral_code) VALUES('00000000-0000-0000-0000-000000000106','École Démo Horizon','Dakar','simple','active',5000,'2026-10-31','EO-DEMO01') ON CONFLICT(profile_id) DO UPDATE SET school_name=excluded.school_name,city=excluded.city,plan=excluded.plan,status=excluded.status,price_xof=excluded.price_xof,period_end=excluded.period_end,referral_code=excluded.referral_code;
INSERT INTO public.demo_profiles(id,full_name,role,email) VALUES('00000000-0000-0000-0000-000000000106','Ibrahima Sarr','director','directeur.demo@ecole.sn') ON CONFLICT(id) DO UPDATE SET full_name='Ibrahima Sarr',role='director',email='directeur.demo@ecole.sn';
