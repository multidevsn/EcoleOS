# ScholaSync — coûts fournisseurs réels

Le dashboard Ops distingue volontairement deux bases :

- `provider_reported` : le fournisseur renvoie directement un coût ou un total de prix.
- `usage_derived` : le système utilise un volume réel exposé par le fournisseur et calcule le coût avec le plan/tarif configuré. Cette base n'est pas présentée comme une facture finale.

## Fournisseurs branchés

### Vercel
Variables :
- `VERCEL_BILLING_TOKEN`
- `VERCEL_TEAM_ID`

Source : Billing Charges API.
Base : `provider_reported`.
Limitation : l'API de charges de facturation est réservée aux périmètres Vercel éligibles (notamment Pro/Enterprise teams).

### Supabase
Variables :
- `SUPABASE_MGMT_TOKEN`
- `SUPABASE_ORG_SLUG`
- `SUPABASE_PROJECT_REFS`
- `SUPABASE_PLAN_USD_MONTHLY` (optionnel)
- `SUPABASE_COMPUTE_CREDIT_USD` (optionnel)

Le connecteur récupère le plan de l'organisation et les add-ons des projets via la Management API.
Base : `usage_derived`.
Limitation : les consommations variables qui ne sont pas exposées comme coût final par cette API peuvent différer de la facture Supabase.

### Resend
Variables :
- `RESEND_API_KEY`
- `RESEND_PLAN=free|pro|scale`
- `RESEND_MONTHLY_USD` (optionnel)
- `RESEND_INCLUDED_EMAILS` (optionnel)
- `RESEND_OVERAGE_USD_PER_1000` (optionnel)

Le connecteur compte les emails envoyés sur la période avec l'API `/emails` puis applique le plan configuré.
Base : `usage_derived`.

### Twilio
Variables :
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

Source : Usage Records API / catégorie `totalprice`.
Base : `provider_reported`.

## Conversion FCFA

Le dashboard peut afficher le total en XOF si les taux sont configurés :

- `COST_USD_TO_XOF`
- `COST_EUR_TO_XOF`

Ces valeurs doivent être maintenues à jour par l'opérateur de la plateforme ou remplacées plus tard par une source FX automatique de confiance.

## Synchronisation

L'endpoint `/api/admin/provider-costs` accepte :

- `POST` depuis le dashboard Ops pour une synchronisation manuelle ;
- `GET` appelé par Vercel Cron avec `Authorization: Bearer $CRON_SECRET` pour une synchronisation automatique.

Le cron est configuré à `01:50 UTC`, avant le recalcul de facturation de `02:30 UTC`.

Les snapshots sont stockés dans `provider_cost_snapshots`, puis utilisés pour :

1. alimenter le dashboard technique ;
2. distinguer les coûts réels/estimés ;
3. allouer le coût fournisseur aux écoles selon leur part d'utilisateurs actifs lorsque les données XOF sont disponibles ;
4. recalculer la marge projetée.

## Sécurité

Les tokens fournisseurs sont strictement côté serveur. Ils ne doivent jamais être placés dans `VITE_*` ni exposés au navigateur.
