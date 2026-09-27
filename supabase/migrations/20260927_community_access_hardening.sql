-- École OS — correctif d'accès RLS pour private.is_staff()
-- Corrige « permission denied for function is_staff » sans changer la logique métier.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin','teacher','cafeteria')
  );
$$;

REVOKE ALL ON FUNCTION private.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_staff() TO authenticated;

-- Évite qu'une différence de déploiement entre les migrations historiques et la version actuelle
-- laisse une RLS appeler la fonction sans son droit EXECUTE.
