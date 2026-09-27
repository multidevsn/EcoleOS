# École OS — Security model

École OS n'utilise pas un « mode obscur » côté client. La sécurité est appliquée côté serveur et en base.

## Barrière réelle
- Supabase Auth identifie le compte.
- Les RLS contrôlent l'accès aux données par utilisateur/école/rôle.
- Les fonctions SECURITY DEFINER sensibles sont explicitement limitées aux rôles nécessaires.
- Les routes Vercel sensibles sont instrumentées par `server/security.ts`.
- Les identifiants réseau ne sont jamais stockés en clair : IP et User-Agent sont hashés avec `SECURITY_HASH_SALT`.

## Observabilité
Le serveur enregistre les réponses 401, 403 et 5xx ainsi que les routes sensibles. Des alertes sont ouvertes lorsqu'une même source répète des refus ou erreurs au-delà de seuils simples sur une fenêtre courte.

Le Dashboard technique expose :
- événements sécurité des dernières 24 h ;
- avertissements ;
- critiques ;
- alertes ouvertes ;
- occurrence et route associée.

## Limites
Le système détecte des signaux et facilite la revue humaine. Il ne prétend pas « savoir » qu'une attaque a eu lieu. Les règles doivent être ajustées après observation du trafic réel.
