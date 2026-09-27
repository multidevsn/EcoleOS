-- École OS — Communauté scalable / contexte / rattrapage
-- Objectif : la communauté grandit sans devenir un fil géant illisible.

ALTER TABLE public.community_spaces
  ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'school',
  ADD COLUMN IF NOT EXISTS scope_key text,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 50;

ALTER TABLE public.community_spaces
  DROP CONSTRAINT IF EXISTS community_spaces_scope_type_check;
ALTER TABLE public.community_spaces
  ADD CONSTRAINT community_spaces_scope_type_check
  CHECK(scope_type IN ('school','role','class'));

CREATE INDEX IF NOT EXISTS community_spaces_scope_idx
  ON public.community_spaces(school_id,scope_type,scope_key,archived_at,priority);

-- Compatibilité : les anciens espaces avec target_role deviennent des espaces de rôle.
UPDATE public.community_spaces
SET scope_type='role', scope_key=target_role::text
WHERE target_role IS NOT NULL AND (scope_type='school' OR scope_key IS NULL);

DROP POLICY IF EXISTS community_spaces_read ON public.community_spaces;
CREATE POLICY community_spaces_read ON public.community_spaces FOR SELECT TO authenticated
USING(
  school_id=(SELECT school_id FROM public.profiles WHERE id=auth.uid())
  AND archived_at IS NULL
  AND (
    (scope_type='school')
    OR (scope_type='role' AND scope_key=(SELECT role::text FROM public.profiles WHERE id=auth.uid()))
    OR (scope_type='class' AND scope_key=COALESCE((SELECT class_name FROM public.profiles WHERE id=auth.uid()),''))
    OR (target_role IS NOT NULL AND target_role=(SELECT role FROM public.profiles WHERE id=auth.uid()))
  )
  AND (is_public OR EXISTS(SELECT 1 FROM public.community_space_members m WHERE m.space_id=id AND m.user_id=auth.uid()))
);

DROP POLICY IF EXISTS community_messages_read ON public.community_messages;
CREATE POLICY community_messages_read ON public.community_messages FOR SELECT TO authenticated
USING(
  school_id=(SELECT school_id FROM public.profiles WHERE id=auth.uid())
  AND EXISTS(
    SELECT 1 FROM public.community_spaces s
    WHERE s.id=space_id AND s.archived_at IS NULL
      AND (
        (s.scope_type='school')
        OR (s.scope_type='role' AND s.scope_key=(SELECT role::text FROM public.profiles WHERE id=auth.uid()))
        OR (s.scope_type='class' AND s.scope_key=COALESCE((SELECT class_name FROM public.profiles WHERE id=auth.uid()),''))
        OR (s.target_role IS NOT NULL AND s.target_role=(SELECT role FROM public.profiles WHERE id=auth.uid()))
      )
      AND (s.is_public OR EXISTS(SELECT 1 FROM public.community_space_members m WHERE m.space_id=s.id AND m.user_id=auth.uid()))
  )
);

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

  INSERT INTO public.community_spaces(school_id,name,description,kind,is_public,created_by,scope_type,scope_key,priority)
  VALUES
    (v_school,'Annonces de l''établissement','Informations importantes, vérifiées et faciles à retrouver.','announcement',true,v_user,'school',NULL,20),
    (v_school,'Vie de l''établissement','Échanges généraux utiles, sans fil social infini.','community',true,v_user,'school',NULL,50)
  ON CONFLICT(school_id,kind,name) WHERE archived_at IS NULL DO UPDATE
  SET description=excluded.description, scope_type=excluded.scope_type, scope_key=excluded.scope_key, priority=excluded.priority;

  IF NULLIF(trim(COALESCE(v_profile.class_name,'')),'') IS NOT NULL THEN
    INSERT INTO public.community_spaces(school_id,name,description,kind,is_public,created_by,scope_type,scope_key,priority)
    VALUES(
      v_school,
      'Classe '||trim(v_profile.class_name),
      'Votre espace de proximité : les informations liées à votre groupe restent ensemble.',
      'community',true,v_user,'class',trim(v_profile.class_name),10
    )
    ON CONFLICT(school_id,kind,name) WHERE archived_at IS NULL DO UPDATE
    SET scope_type='class', scope_key=trim(v_profile.class_name), priority=10, description=excluded.description;
  END IF;

  INSERT INTO public.community_space_members(space_id,user_id)
  SELECT id,v_user FROM public.community_spaces
  WHERE school_id=v_school AND archived_at IS NULL AND is_public=true
    AND (
      scope_type='school'
      OR (scope_type='role' AND scope_key=v_profile.role::text)
      OR (scope_type='class' AND scope_key=COALESCE(v_profile.class_name,''))
    )
  ON CONFLICT DO NOTHING;
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_default_community_spaces() TO authenticated;

-- Vue logique côté serveur : un appel compact pour les espaces visibles et leur contexte.
CREATE OR REPLACE FUNCTION public.get_community_overview()
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  kind text,
  created_at timestamptz,
  scope_type text,
  scope_key text,
  priority integer,
  unread_count bigint,
  latest_body text,
  latest_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT
    s.id,s.name,s.description,s.kind,s.created_at,s.scope_type,s.scope_key,s.priority,
    COALESCE((SELECT count(*) FROM public.community_messages m
      LEFT JOIN public.community_space_reads r ON r.space_id=m.space_id AND r.user_id=auth.uid()
      WHERE m.space_id=s.id AND m.deleted_at IS NULL
        AND m.created_at > COALESCE(r.last_read_at,'epoch'::timestamptz)),0) AS unread_count,
    lm.body AS latest_body,
    lm.created_at AS latest_at
  FROM public.community_spaces s
  LEFT JOIN LATERAL (
    SELECT m.body,m.created_at FROM public.community_messages m
    WHERE m.space_id=s.id AND m.deleted_at IS NULL
    ORDER BY m.created_at DESC LIMIT 1
  ) lm ON true
  WHERE s.school_id=(SELECT school_id FROM public.profiles WHERE id=auth.uid())
    AND s.archived_at IS NULL
    AND (
      s.scope_type='school'
      OR (s.scope_type='role' AND s.scope_key=(SELECT role::text FROM public.profiles WHERE id=auth.uid()))
      OR (s.scope_type='class' AND s.scope_key=COALESCE((SELECT class_name FROM public.profiles WHERE id=auth.uid()),''))
      OR (s.target_role IS NOT NULL AND s.target_role=(SELECT role FROM public.profiles WHERE id=auth.uid()))
    )
    AND (s.is_public OR EXISTS(SELECT 1 FROM public.community_space_members sm WHERE sm.space_id=s.id AND sm.user_id=auth.uid()))
  ORDER BY s.priority ASC, COALESCE(lm.created_at,s.created_at) DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_community_overview() TO authenticated;

-- Sécurise l'accès et le contexte lors des actions serveur.
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
  SELECT id,school_id,full_name,role,class_name INTO v_profile FROM public.profiles WHERE id=v_user;
  IF v_profile.id IS NULL OR v_profile.school_id IS NULL THEN RAISE EXCEPTION 'Profil établissement introuvable.'; END IF;
  SELECT id,school_id,kind,is_public,archived_at,scope_type,scope_key,target_role INTO v_space FROM public.community_spaces WHERE id=p_space_id;
  IF v_space.id IS NULL OR v_space.school_id<>v_profile.school_id OR v_space.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Espace indisponible.'; END IF;
  IF NOT (
    v_space.scope_type='school'
    OR (v_space.scope_type='role' AND v_space.scope_key=v_profile.role::text)
    OR (v_space.scope_type='class' AND v_space.scope_key=COALESCE(v_profile.class_name,''))
    OR (v_space.target_role IS NOT NULL AND v_space.target_role=v_profile.role)
  ) THEN RAISE EXCEPTION 'Cet espace ne correspond pas à votre contexte.'; END IF;
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
  IF NOT EXISTS(
    SELECT 1 FROM public.community_spaces s
    JOIN public.profiles p ON p.id=auth.uid()
    WHERE s.id=p_space_id AND s.school_id=p.school_id AND s.archived_at IS NULL
      AND (s.scope_type='school' OR (s.scope_type='role' AND s.scope_key=p.role::text) OR (s.scope_type='class' AND s.scope_key=COALESCE(p.class_name,'')) OR (s.target_role IS NOT NULL AND s.target_role=p.role))
  ) THEN RAISE EXCEPTION 'Espace indisponible.'; END IF;
  INSERT INTO public.community_space_reads(space_id,user_id,last_read_at)
  VALUES(p_space_id,auth.uid(),now())
  ON CONFLICT(space_id,user_id) DO UPDATE SET last_read_at=excluded.last_read_at;
END $$;
GRANT EXECUTE ON FUNCTION public.mark_community_space_read(uuid) TO authenticated;

-- Temps réel reste limité aux messages ; le tableau d'ensemble reste peu bavard.
ALTER TABLE public.community_messages REPLICA IDENTITY FULL;
