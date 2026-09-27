-- École OS — Messagerie / Communauté sereine
-- Espaces structurés, annonces vérifiées, messages, signalements et lecture temps réel.

CREATE TABLE IF NOT EXISTS public.community_spaces(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 3 AND 100),
  description text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'community' CHECK(kind IN ('announcement','community')),
  target_role public.app_role,
  is_public boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE INDEX IF NOT EXISTS community_spaces_school_idx ON public.community_spaces(school_id, archived_at, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS community_spaces_default_uidx ON public.community_spaces(school_id,kind,name) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.community_space_members(
  space_id uuid NOT NULL REFERENCES public.community_spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  muted_until timestamptz,
  PRIMARY KEY(space_id,user_id)
);
CREATE INDEX IF NOT EXISTS community_space_members_user_idx ON public.community_space_members(user_id,space_id);

CREATE TABLE IF NOT EXISTS public.community_messages(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES public.community_spaces(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name text NOT NULL DEFAULT 'Membre',
  sender_role public.app_role NOT NULL,
  body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS community_messages_space_idx ON public.community_messages(space_id,created_at);
CREATE INDEX IF NOT EXISTS community_messages_school_idx ON public.community_messages(school_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_space_reads(
  space_id uuid NOT NULL REFERENCES public.community_spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(space_id,user_id)
);

CREATE TABLE IF NOT EXISTS public.community_message_reports(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.community_messages(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 400),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewed','dismissed','removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS community_message_reports_once_uidx ON public.community_message_reports(message_id,reporter_id) WHERE status='open';

ALTER TABLE public.community_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_space_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_message_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_spaces_read ON public.community_spaces;
CREATE POLICY community_spaces_read ON public.community_spaces FOR SELECT TO authenticated
USING(
  school_id=(SELECT school_id FROM public.profiles WHERE id=auth.uid())
  AND archived_at IS NULL
  AND (target_role IS NULL OR target_role=(SELECT role FROM public.profiles WHERE id=auth.uid()))
  AND (is_public OR EXISTS(SELECT 1 FROM public.community_space_members m WHERE m.space_id=id AND m.user_id=auth.uid()))
);

DROP POLICY IF EXISTS community_space_members_read ON public.community_space_members;
CREATE POLICY community_space_members_read ON public.community_space_members FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.community_spaces s WHERE s.id=space_id AND s.school_id=(SELECT school_id FROM public.profiles WHERE id=auth.uid())) AND user_id=auth.uid());

DROP POLICY IF EXISTS community_messages_read ON public.community_messages;
CREATE POLICY community_messages_read ON public.community_messages FOR SELECT TO authenticated
USING(
  school_id=(SELECT school_id FROM public.profiles WHERE id=auth.uid())
  AND EXISTS(
    SELECT 1 FROM public.community_spaces s
    WHERE s.id=space_id AND s.archived_at IS NULL
      AND (s.target_role IS NULL OR s.target_role=(SELECT role FROM public.profiles WHERE id=auth.uid()))
      AND (s.is_public OR EXISTS(SELECT 1 FROM public.community_space_members m WHERE m.space_id=s.id AND m.user_id=auth.uid()))
  )
);

DROP POLICY IF EXISTS community_space_reads_read ON public.community_space_reads;
CREATE POLICY community_space_reads_read ON public.community_space_reads FOR SELECT TO authenticated USING(user_id=auth.uid());
DROP POLICY IF EXISTS community_space_reads_insert ON public.community_space_reads;
DROP POLICY IF EXISTS community_space_reads_update ON public.community_space_reads;
CREATE POLICY community_space_reads_update ON public.community_space_reads FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());

DROP POLICY IF EXISTS community_reports_read ON public.community_message_reports;
CREATE POLICY community_reports_read ON public.community_message_reports FOR SELECT TO authenticated USING(reporter_id=auth.uid());

-- Crée/assure les deux espaces de base pour une école et rattache le membre aux espaces publics.
CREATE OR REPLACE FUNCTION public.ensure_default_community_spaces()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_school uuid;
  v_user uuid := auth.uid();
  v_profile record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=v_user;
  v_school := v_profile.school_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Votre compte n''est rattaché à aucune école.'; END IF;

  INSERT INTO public.community_spaces(school_id,name,description,kind,is_public,created_by)
  VALUES
    (v_school,'Annonces de l''établissement','Informations importantes, vérifiées et faciles à retrouver.','announcement',true,v_user),
    (v_school,'Communauté École OS','Questions, entraide et échanges utiles au quotidien.','community',true,v_user)
  ON CONFLICT(school_id,kind,name) WHERE archived_at IS NULL DO NOTHING;

  INSERT INTO public.community_space_members(space_id,user_id)
  SELECT id,v_user FROM public.community_spaces
  WHERE school_id=v_school AND archived_at IS NULL AND is_public=true
  ON CONFLICT DO NOTHING;
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_default_community_spaces() TO authenticated;

-- Envoi contrôlé : pas d'INSERT direct côté client. Les annonces sont réservées au personnel.
CREATE OR REPLACE FUNCTION public.send_community_message(p_space_id uuid,p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_profile record;
  v_space record;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF length(trim(coalesce(p_body,''))) < 1 OR length(trim(p_body)) > 2000 THEN RAISE EXCEPTION 'Message invalide.'; END IF;
  SELECT id,school_id,full_name,role INTO v_profile FROM public.profiles WHERE id=v_user;
  IF v_profile.id IS NULL OR v_profile.school_id IS NULL THEN RAISE EXCEPTION 'Profil établissement introuvable.'; END IF;
  SELECT id,school_id,kind,is_public,archived_at INTO v_space FROM public.community_spaces WHERE id=p_space_id;
  IF v_space.id IS NULL OR v_space.school_id<>v_profile.school_id OR v_space.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Espace indisponible.'; END IF;
  IF NOT v_space.is_public AND NOT EXISTS(SELECT 1 FROM public.community_space_members WHERE space_id=v_space.id AND user_id=v_user) THEN RAISE EXCEPTION 'Vous n''êtes pas membre de cet espace.'; END IF;
  IF v_space.kind='announcement' AND v_profile.role NOT IN ('admin','director','teacher') THEN RAISE EXCEPTION 'Les annonces sont réservées au personnel autorisé.'; END IF;

  INSERT INTO public.community_messages(school_id,space_id,sender_id,sender_name,sender_role,body)
  VALUES(v_profile.school_id,v_space.id,v_user,coalesce(nullif(trim(v_profile.full_name),''),'Membre'),v_profile.role,trim(p_body))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.send_community_message(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_community_space_read(p_space_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.community_space_reads(space_id,user_id,last_read_at)
  VALUES(p_space_id,auth.uid(),now())
  ON CONFLICT(space_id,user_id) DO UPDATE SET last_read_at=excluded.last_read_at;
END $$;
GRANT EXECUTE ON FUNCTION public.mark_community_space_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.report_community_message(p_message_id uuid,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF length(trim(coalesce(p_reason,''))) < 3 THEN RAISE EXCEPTION 'Précisez la raison du signalement.'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.community_messages m
    JOIN public.profiles p ON p.id=auth.uid()
    WHERE m.id=p_message_id AND m.school_id=p.school_id
  ) THEN RAISE EXCEPTION 'Message introuvable.'; END IF;
  INSERT INTO public.community_message_reports(message_id,reporter_id,reason)
  VALUES(p_message_id,auth.uid(),trim(p_reason))
  ON CONFLICT(message_id,reporter_id) WHERE status='open' DO UPDATE SET reason=excluded.reason
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.report_community_message(uuid,text) TO authenticated;

-- Prépare les espaces par défaut pour les établissements existants.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.schools LOOP
    INSERT INTO public.community_spaces(school_id,name,description,kind,is_public)
    VALUES
      (r.id,'Annonces de l''établissement','Informations importantes, vérifiées et faciles à retrouver.','announcement',true),
      (r.id,'Communauté École OS','Questions, entraide et échanges utiles au quotidien.','community',true)
    ON CONFLICT(school_id,kind,name) WHERE archived_at IS NULL DO NOTHING;
  END LOOP;
END $$;

-- Temps réel Supabase pour les nouveaux messages.
ALTER TABLE public.community_messages REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS durcie : les écritures passent par les fonctions SECURITY DEFINER ci-dessus.
REVOKE INSERT,UPDATE,DELETE ON public.community_messages FROM authenticated,anon;
REVOKE INSERT,UPDATE,DELETE ON public.community_spaces FROM authenticated,anon;
REVOKE INSERT,UPDATE,DELETE ON public.community_space_members FROM authenticated,anon;
REVOKE INSERT,UPDATE,DELETE ON public.community_message_reports FROM authenticated,anon;
