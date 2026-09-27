-- Mode démo (visiteur non connecté = rôle `anon`) : autoriser la lecture des récompenses actives.
-- Sans cela, l'onglet « Points » de la démo affiche une liste de récompenses vide.
drop policy if exists rewards_anon_read on public.rewards;
create policy rewards_anon_read on public.rewards
  for select to anon
  using (active = true);
