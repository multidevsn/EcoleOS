-- École OS — Agora + Impact universel
-- Idées, votes, sondages, récompenses par rôle et échanges atomiques.

ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS audience_role public.app_role;

CREATE TABLE IF NOT EXISTS public.community_ideas(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  role public.app_role NOT NULL,
  title text NOT NULL CHECK(length(trim(title)) BETWEEN 8 AND 120),
  description text NOT NULL CHECK(length(trim(description)) BETWEEN 12 AND 600),
  status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','review','planned','building','done')),
  vote_count integer NOT NULL DEFAULT 0 CHECK(vote_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_ideas_school_created_idx ON public.community_ideas(school_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_idea_votes(
  idea_id uuid NOT NULL REFERENCES public.community_ideas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(idea_id,user_id)
);

CREATE TABLE IF NOT EXISTS public.community_surveys(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  question text NOT NULL,
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  expires_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_surveys_school_active_idx ON public.community_surveys(school_id,active,created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_survey_options(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.community_surveys(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS community_survey_options_survey_idx ON public.community_survey_options(survey_id,sort_order);

CREATE TABLE IF NOT EXISTS public.community_survey_responses(
  survey_id uuid NOT NULL REFERENCES public.community_surveys(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.community_survey_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(survey_id,user_id)
);
CREATE INDEX IF NOT EXISTS community_survey_responses_option_idx ON public.community_survey_responses(option_id);

ALTER TABLE public.community_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_idea_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_survey_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_survey_responses ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.community_ideas TO authenticated;
GRANT SELECT ON public.community_idea_votes TO authenticated;
GRANT SELECT ON public.community_surveys,public.community_survey_options TO authenticated;
GRANT SELECT ON public.community_survey_responses TO authenticated;
GRANT SELECT ON public.rewards TO authenticated;

DROP POLICY IF EXISTS community_ideas_read ON public.community_ideas;
CREATE POLICY community_ideas_read ON public.community_ideas FOR SELECT TO authenticated
USING(school_id=(SELECT school_id FROM public.profiles WHERE id=auth.uid()));
DROP POLICY IF EXISTS community_ideas_insert ON public.community_ideas;

DROP POLICY IF EXISTS community_votes_read ON public.community_idea_votes;
CREATE POLICY community_votes_read ON public.community_idea_votes FOR SELECT TO authenticated
USING(user_id=auth.uid());
DROP POLICY IF EXISTS community_votes_insert ON public.community_idea_votes;

DROP POLICY IF EXISTS community_surveys_read ON public.community_surveys;
CREATE POLICY community_surveys_read ON public.community_surveys FOR SELECT TO authenticated
USING(school_id=(SELECT school_id FROM public.profiles WHERE id=auth.uid()));
DROP POLICY IF EXISTS community_options_read ON public.community_survey_options;
CREATE POLICY community_options_read ON public.community_survey_options FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.community_surveys s WHERE s.id=survey_id AND s.school_id=(SELECT school_id FROM public.profiles WHERE id=auth.uid())));
DROP POLICY IF EXISTS community_responses_read ON public.community_survey_responses;
CREATE POLICY community_responses_read ON public.community_survey_responses FOR SELECT TO authenticated
USING(user_id=auth.uid());
DROP POLICY IF EXISTS community_responses_insert ON public.community_survey_responses;

-- Ajoute une contribution à l'utilisateur connecté, sans exposer d'INSERT direct sur le ledger.
CREATE OR REPLACE FUNCTION public.add_impact(p_points integer,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_points = 0 OR p_points < -100000 OR p_points > 100000 THEN RAISE EXCEPTION 'Invalid impact amount'; END IF;
  INSERT INTO public.point_ledger(user_id,points,reason) VALUES(auth.uid(),p_points,left(trim(p_reason),180));
END $$;
REVOKE ALL ON FUNCTION public.add_impact(integer,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.submit_community_idea(p_title text,p_description text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_school uuid; v_name text; v_role public.app_role; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT school_id,full_name,role INTO v_school,v_name,v_role FROM public.profiles WHERE id=auth.uid();
  IF v_school IS NULL THEN RAISE EXCEPTION 'Votre compte n''est rattaché à aucune école.'; END IF;
  INSERT INTO public.community_ideas(school_id,author_id,author_name,role,title,description)
  VALUES(v_school,auth.uid(),coalesce(nullif(trim(v_name),''),'Membre'),v_role,trim(p_title),trim(p_description)) RETURNING id INTO v_id;
  INSERT INTO public.point_ledger(user_id,points,reason) VALUES(auth.uid(),10,'Idée proposée dans Agora');
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.submit_community_idea(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.vote_community_idea(p_idea_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_new boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF EXISTS(SELECT 1 FROM public.community_idea_votes v JOIN public.community_ideas i ON i.id=v.idea_id WHERE v.idea_id=p_idea_id AND v.user_id=auth.uid() AND i.school_id=(SELECT school_id FROM public.profiles WHERE id=auth.uid())) THEN
    RETURN false;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.community_ideas i WHERE i.id=p_idea_id AND i.school_id=(SELECT school_id FROM public.profiles WHERE id=auth.uid())) THEN
    RAISE EXCEPTION 'Idée introuvable pour votre école.';
  END IF;
  INSERT INTO public.community_idea_votes(idea_id,user_id) VALUES(p_idea_id,auth.uid());
  UPDATE public.community_ideas SET vote_count=vote_count+1 WHERE id=p_idea_id;
  INSERT INTO public.point_ledger(user_id,points,reason) VALUES(auth.uid(),2,'Vote utile dans Agora');
  v_new := true;
  RETURN v_new;
END $$;
GRANT EXECUTE ON FUNCTION public.vote_community_idea(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_community_survey(p_survey_id uuid,p_option_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_school uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT school_id INTO v_school FROM public.profiles WHERE id=auth.uid();
  IF v_school IS NULL THEN RAISE EXCEPTION 'École introuvable.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.community_surveys WHERE id=p_survey_id AND school_id=v_school AND active=true) THEN RAISE EXCEPTION 'Sondage indisponible.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.community_survey_options WHERE id=p_option_id AND survey_id=p_survey_id) THEN RAISE EXCEPTION 'Option de sondage invalide.'; END IF;
  INSERT INTO public.community_survey_responses(survey_id,option_id,user_id) VALUES(p_survey_id,p_option_id,auth.uid()) ON CONFLICT(survey_id,user_id) DO NOTHING;
  IF FOUND THEN INSERT INTO public.point_ledger(user_id,points,reason) VALUES(auth.uid(),2,'Participation à un sondage'); END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.respond_community_survey(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_reward(p_reward_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_reward public.rewards%ROWTYPE; v_balance integer; v_id uuid; v_role public.app_role;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id=auth.uid();
  SELECT * INTO v_reward FROM public.rewards WHERE id=p_reward_id AND active=true AND (audience_role IS NULL OR audience_role=v_role) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Récompense indisponible pour ce rôle.'; END IF;
  SELECT coalesce(sum(points),0) INTO v_balance FROM public.point_ledger WHERE user_id=auth.uid();
  IF v_balance < v_reward.points_cost THEN RAISE EXCEPTION 'Impact insuffisant.'; END IF;
  INSERT INTO public.reward_redemptions(user_id,reward_id,points_spent) VALUES(auth.uid(),v_reward.id,v_reward.points_cost) RETURNING id INTO v_id;
  INSERT INTO public.point_ledger(user_id,points,reason) VALUES(auth.uid(),-v_reward.points_cost,'Échange : '||v_reward.name);
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO authenticated;

-- Récompenses universelles + rôles métiers. Les montants sont volontairement simples :
-- l'établissement peut les remplacer par ses propres avantages/partenaires.
UPDATE public.rewards SET audience_role='student' WHERE name='Boisson offerte';
INSERT INTO public.rewards(name,points_cost,active,audience_role)
SELECT v.name,v.points_cost,true,v.audience_role
FROM (VALUES
  ('Bon famille 2 000 F',1200,'parent'::public.app_role),
  ('Crédit reprographie',1000,'teacher'::public.app_role),
  ('Crédit services école',1200,'admin'::public.app_role),
  ('Réduction abonnement École OS · 1 000 F',1500,'director'::public.app_role),
  ('Bon partenaire cantine',1200,'cafeteria'::public.app_role)
) v(name,points_cost,audience_role)
WHERE NOT EXISTS(SELECT 1 FROM public.rewards r WHERE r.name=v.name AND r.audience_role=v.audience_role);

-- Quelques données de démo pour montrer que l'Impact concerne tous les rôles.
DO $$
BEGIN
  IF to_regclass('public.demo_points') IS NOT NULL THEN
    INSERT INTO public.demo_points(id,profile_id,points,reason,created_at) VALUES
    ('00000000-0000-0000-0000-000000000502','00000000-0000-0000-0000-000000000102',80,'Participation à un sondage','2026-09-20'),
    ('00000000-0000-0000-0000-000000000503','00000000-0000-0000-0000-000000000103',160,'Contribution pédagogique','2026-09-18'),
    ('00000000-0000-0000-0000-000000000504','00000000-0000-0000-0000-000000000104',220,'Amélioration du processus d''inscription','2026-09-17'),
    ('00000000-0000-0000-0000-000000000505','00000000-0000-0000-0000-000000000105',90,'Suggestion Food utile','2026-09-19'),
    ('00000000-0000-0000-0000-000000000506','00000000-0000-0000-0000-000000000106',340,'Pilotage et amélioration de l''établissement','2026-09-16')
    ON CONFLICT(id) DO NOTHING;
  END IF;
END $$;

-- Lecture des résultats globaux des sondages de son établissement.
DROP POLICY IF EXISTS community_responses_read ON public.community_survey_responses;
CREATE POLICY community_responses_read ON public.community_survey_responses FOR SELECT TO authenticated
USING(EXISTS(
  SELECT 1 FROM public.community_surveys s
  WHERE s.id=survey_id AND s.school_id=(SELECT school_id FROM public.profiles WHERE id=auth.uid())
));

-- Premier sondage pour l'école démo, afin que la section ne soit pas vide après installation.
DO $$
DECLARE v_survey uuid := '00000000-0000-0000-0000-000000000401';
BEGIN
  IF EXISTS(SELECT 1 FROM public.schools WHERE id='00000000-0000-0000-0000-000000000201') THEN
    INSERT INTO public.community_surveys(id,school_id,question,description,active,expires_at)
    VALUES(v_survey,'00000000-0000-0000-0000-000000000201','Quel service devrait être amélioré ensuite ?','Un vote simple. Les résultats servent à prioriser la feuille de route.',true,'2026-10-02')
    ON CONFLICT(id) DO UPDATE SET question=excluded.question,description=excluded.description,active=true,expires_at=excluded.expires_at;
    INSERT INTO public.community_survey_options(id,survey_id,label,sort_order) VALUES
      ('00000000-0000-0000-0000-000000000411',v_survey,'Messagerie',1),
      ('00000000-0000-0000-0000-000000000412',v_survey,'Cantine',2),
      ('00000000-0000-0000-0000-000000000413',v_survey,'Emploi du temps',3),
      ('00000000-0000-0000-0000-000000000414',v_survey,'Paiements',4)
    ON CONFLICT(id) DO UPDATE SET label=excluded.label,sort_order=excluded.sort_order;
  END IF;
END $$;
