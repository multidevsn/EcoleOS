# Intégration SasPay — École OS

Cette intégration ajoute SasPay comme moyen de paiement hébergé tout en conservant Wave et Paddle. Elle cible les commandes Food, les échéances scolaires, les abonnements ponctuels du directeur et les cycles de facturation.

## 1. Migration Supabase

Appliquer dans l'ordre `supabase/migrations/20261009_saspay_payments.sql`, puis `supabase/migrations/20261009_security_audit_hardening.sql` au même projet Supabase que l’application. La première ajoute les identifiants de checkout/transaction et le montant immuable validé lors de la création du checkout, ainsi que la table d'événements. La seconde réserve les changements de rôle/rattachement/code scolaire aux opérations serveur et limite la modification directe du profil utilisateur à `full_name`. Aucune colonne Wave ou Paddle n'est remplacée.

## 2. Variables d’environnement Vercel

Dans **Vercel → EcoleOS → Settings → Environment Variables**, ajouter :

| Variable | Valeur |
| --- | --- |
| `SASPAY_API_KEY` | Clé secrète SasPay `sk_test_…` pour les tests, puis `sk_live_…` après validation. La clé doit avoir le scope `PAYIN` ou `BOTH`. |
| `SASPAY_WEBHOOK_SECRET` | Secret de signature du webhook, obtenu lors de sa création/rotation dans le tableau de bord SasPay. Ce n’est pas la clé API. |
| `SASPAY_COUNTRY_CODE` | `SN` pour présélectionner le Sénégal. Facultatif ; le code par défaut est `SN`. |
| `APP_URL` | URL canonique publique de l’application, par exemple `https://votre-domaine.example` (HTTPS obligatoire ; pas de paramètres, fragment ou identifiants). Utilisée pour les retours SasPay et Wave. |

Ne pas préfixer les deux secrets SasPay par `VITE_` : ils sont lus exclusivement côté serveur. Ne les commitez pas dans Git et ne les collez pas dans le code frontend.

## 3. Webhook SasPay

Dans le tableau de bord SasPay, créer un webhook pour l’environnement correspondant à la clé API :

`https://VOTRE-DOMAINE/api/saspay/webhook`

S’abonner aux événements `transaction.success`, `transaction.failed` et `transaction.cancelled`. Copier le secret de signature affiché à sa création et le conserver dans `SASPAY_WEBHOOK_SECRET`. La documentation SasPay indique que le secret de signature ne peut pas être relu ensuite ; en cas de perte, le renouveler depuis le tableau de bord.

Le serveur vérifie `X-Webhook-Signature` comme un HMAC-SHA256 de `timestamp.body_brut`, contrôle `X-Webhook-Timestamp` sur une fenêtre de 300 secondes, ne garde pas le numéro mobile dans l'historique d'audit et enregistre les événements avec un état d'erreur pour éviter les acquittements silencieux. Une session doit être rapprochée et relue auprès de SasPay avant application. L’application vérifie aussi le statut du checkout auprès de SasPay au retour du client ; l’URL de retour ne vaut jamais preuve de paiement.

## 4. Déployer et tester

1. Appliquer la migration Supabase.
2. Ajouter les variables Vercel de test et configurer le webhook de test.
3. Redéployer Vercel pour charger les variables.
4. Faire un paiement test sur chaque parcours (Food, échéance scolaire, cycle du directeur). Vérifier que le statut ne passe à payé qu’après confirmation SasPay et que les données sont rechargées au retour.
5. Examiner les journaux Vercel si SasPay répond par une erreur HTTP ; vérifier que la clé a bien le scope `PAYIN` ou `BOTH`.
6. Après validation, remplacer la clé de test par la clé live et configurer le webhook live correspondant.

## Notes

- Le paiement SasPay de l’abonnement d’école est ponctuel et couvre la période indiquée dans l’interface ; il n’active pas un prélèvement récurrent SasPay. Le renouvellement reste manuel.
- `SASPAY_API_KEY` et `SASPAY_WEBHOOK_SECRET` doivent provenir du même environnement (test/live) que le webhook configuré.
- La création de session SasPay utilise `POST https://api.saspay.me/api/v1/checkout-sessions/`. L’état est vérifié avec `GET /checkout-sessions/{id}/status/` et `GET /checkout-sessions/{id}/` conformément à la documentation officielle.

## 5. Build Android et CI

Le workflow GitHub Actions utilise `android-actions/setup-android@v4` avec `packages: platform-tools`. Ne pas demander `sdkmanager tools` : ce paquet SDK ancien n'est plus publié. Le workflow lance désormais aussi `npm test` avant de construire l'APK.

Le build Android n'embarque que le `dist/` généré dans ce dépôt ; il ne récupère plus un bundle voisin potentiellement périmé.


## 6. Bloquant avant passage en production

La documentation de webhook consultée ne garantit pas que chaque notification expose l'identifiant de session checkout. Le code de rapprochement utilise donc encore une recherche limitée aux 300 premières sessions, lorsqu'aucune référence de session n'est fournie. Cela ne suffit pas pour garantir une comptabilisation fiable à l'échelle : demande à SasPay d'inclure l'identifiant de session ou une référence marchand vérifiable dans le webhook, ou un endpoint officiel de recherche exacte par transaction. **Ne pas activer les paiements live tant que ce point n'est pas confirmé et testé.** Voir `SECURITY_AUDIT_2026-10-09.md`.

Pour toute nouvelle configuration, utiliser `.env.example` uniquement comme liste des noms attendus ; toutes les valeurs qui y figurent sont fictives et ne doivent pas être utilisées comme secrets.
