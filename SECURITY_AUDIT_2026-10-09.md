# École OS — audit de sécurité et de fiabilité

**Date :** 9 octobre 2026  
**Base auditée :** archive `EcoleOS-SasPay-integration.zip` fournie dans cette conversation, avec corrections locales.  
**Nature :** revue statique ciblée du dépôt ; ce n'est ni un pentest de production ni une attestation de conformité.

## Résumé de décision

Le correctif CI pour `sdkmanager tools` est appliqué. Plusieurs risques de sécurité et de « panne silencieuse » ont aussi été corrigés dans la copie locale : garde de mise à jour des profils, contrôle des URL de retour/checkout, validation d'événements de paiement, reprise après échec, réduction des données personnelles stockées dans les événements, en-têtes anti-cache d'API, CSP Paddle, et routage Wave hors WebView.

**Ne pas activer les paiements réels avant de résoudre le point bloquant SasPay ci-dessous et d'avoir exécuté le pipeline complet et des paiements de test.** Aucun déploiement production ni application de migration distante n'a été effectué.

## Défaut CI Android

**Cause établie :** le workflow/action demandait le paquet historique `tools`, que Google ne publie plus. `sdkmanager` échoue avec `Failed to find package 'tools'`.

**Correction apportée :** `.github/workflows/android-apk.yml` utilise `android-actions/setup-android@v4`, installe explicitement `platform-tools`, puis installe la plateforme `android-37` et les build-tools `36.0.0`. Le workflow lance `npm test`, puis le build de ressources spécifique à Android et Gradle. Il vérifie aussi la présence des secrets de signature et la signature de l'APK release.

Référence : README officiel de setup-android, section « The deprecated tools package » : https://github.com/android-actions/setup-android/blob/main/README.md

## Corrections apportées

- `vercel.json` : en-têtes de sécurité, CSP avec les hôtes Paddle nécessaires et `Cache-Control: no-store`/`Pragma: no-cache` sur `/api/*` uniquement.
- Profils/Supabase : migration de durcissement qui restreint l'UPDATE client de `profiles` à `full_name` et `updated_at`, avec trigger empêchant la modification directe de `id`, `role`, `school_id` et `student_code`. Ceci ne protège la base de production qu'après application effective de la migration.
- Wave : vérification HMAC du webhook sur le corps brut avec fenêtre anti-rejeu, rapprochement checkout/montant/devise, événements non acquittés avant succès du traitement, erreurs de rapprochement retryables, échec d'une tentative qui n'annule plus automatiquement la ressource payable, nettoyage de commandes Food incomplètes, montant de cycle persistant et activation limitée à l'abonnement courant.
- SasPay : validation stricte de `APP_URL` et du domaine `pay.saspay.me`, réutilisation prudente des sessions existantes, délais maximaux des requêtes fournisseur, rejet de lignes du panier mal formées au lieu de les ignorer, vérification côté serveur de l'état du checkout, minimisation du payload d'audit (pas de `msisdn`), garde de rapprochement et événements en attente en cas d'incohérence. Les échecs de paiement ne rendent plus automatiquement une ressource irrécupérable ; les échecs tardifs de sessions remplacées sont traités sans écraser la session actuelle.
- Paddle : payload webhook stocké réduit, résultat de mise à jour d'abonnement contrôlé, erreurs de rapprochement non acquittées silencieusement et statut non géré signalé au lieu d'être ignoré. La CSP autorise uniquement les origines Paddle nécessaires.
- Android WebView : le checkout Wave est ouvert dans le navigateur/app externe, comme le demande la documentation Wave, tout en gardant les retours SasPay/Paddle compatibles avec l'application.
- `SASPAY_SETUP.md` et `.env.example` : configuration documentée sans clés réelles.

## Résultats des contrôles exécutés

| Contrôle | Résultat |
| --- | --- |
| Transpilation syntaxique TypeScript/TSX (39 fichiers non-déclaration) | Réussie, zéro diagnostic syntaxique |
| Lecture JSON de `vercel.json` et `package.json` | Réussie |
| Lecture des `tsconfig` en format JSONC TypeScript | Réussie |
| Parsing YAML du workflow Android | Réussi |
| Tests automatisés Vitest | **Non exécutés** : `vitest: not found` (dépendances npm absentes) |
| Type-check/build API complet | **Non confirmé** : dépendances et types de projet non disponibles dans l'environnement |
| Build Gradle / APK signé | **Non exécuté** dans cet environnement |
| Tests réels sur SasPay, Wave, Paddle | **Non exécutés** : aucune clé ni environnement test du client |
| Migrations Supabase de production | **Non appliquées** : demande accès opérateur du projet |

La transpilation syntaxique n'équivaut pas à un type-check complet et ne remplace pas le build CI.

## Risques et blocages restants

### P1 — SasPay : rapprochement webhook limité à 300 sessions

Le webhook SasPay peut ne donner que l'identifiant de transaction tandis que le code doit retrouver la session checkout par liste de sessions. La logique actuelle ne parcourt que les trois premières pages de 100 entrées. Au-delà de cette fenêtre, une transaction réelle peut rester non rapprochée ; le handler répond `503` pour provoquer les retries, mais SasPay documente une politique de tentatives limitée. Ce problème n'est **pas résolu par les changements locaux**.

**Avant production :** demander à SasPay d'inclure un `checkout_session_id` stable (ou une référence marchand EcoleOS vérifiable) dans chaque webhook de transaction, ou de fournir un endpoint de recherche documenté et exact par transaction ID. Valider un événement de succès sur une école de test. Ne pas considérer cette intégration comme industrialisée avant cette vérification.

Documentation de référence : https://docs.saspay.me/api-reference/webhooks et https://docs.saspay.me/api-reference/payments/checkout-status

### P1 — Interopérabilité SIMEN / services publics non démontrée

Le dépôt audité ne contient pas de connecteur SIMEN, d'appel API officiel du ministère, de configuration SSO, ni de mapping vérifié d'identifiants scolaires. Le fait que le portail du ministère existe n'est pas un contrat d'intégration API.

**Avant toute synchronisation :** obtenir de l'autorité compétente la documentation API/SSO, les identifiants de test, le schéma d'identifiant école/élève, les scopes, le protocole d'authentification et l'autorisation écrite. Réaliser une matrice de correspondance et des tests sandbox (création, mise à jour, erreurs, reprise, doublons, révocation) sans aspirer le portail par scraping. Ne pas transférer automatiquement les données d'élèves vers SIMEN sans base juridique et accord appropriés.

Références contextuelles : portail SIMEN du ministère https://www.education.sn/pages/systeme-dinformation-et-de-management-de-leducation-nationale-simen ; portail APPMEN https://apps.education.sn/ ; loi sénégalaise sur la protection des données personnelles (loi 2008-12) : https://senlii.org/en/akn/sn/act/2008/12/fra@2008-05-03 . Le dossier ne permet pas de conclure à la conformité juridique.

### P1 — Vérification de la migration et configuration en production

Avant déploiement, appliquer dans Supabase le fichier `supabase/migrations/20261009_saspay_payments.sql`, puis `supabase/migrations/20261009_security_audit_hardening.sql`. Puis vérifier les policies/permissions sur un compte authentifié standard, parent, professeur, directeur et admin technique.

Configurer les secrets serveur dans Vercel : `SUPABASE_SECRET_KEY`, `SECURITY_HASH_SALT`, `CRON_SECRET`, `PLATFORM_ADMIN_EMAILS`, `APP_URL`, `SASPAY_API_KEY`, `SASPAY_WEBHOOK_SECRET`, `WAVE_API_KEY`, `WAVE_WEBHOOK_SECRET`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET` et les tokens de coûts si le tableau Ops est utilisé. Ne jamais utiliser `VITE_` pour un secret serveur. Les valeurs dans `.env.example` sont toutes fictives.

### P2 — Idempotence de la création de checkout Wave

La garde client réduit les doubles clics, mais elle ne fournit pas une idempotence distribuée complète à l'API de création Wave face à deux requêtes concurrentes/réessayées. Tester les doubles soumissions et, si Wave prend en charge une clé d'idempotence contractuelle, l'utiliser ; sinon ajouter une réservation/contrainte atomique côté base avant création du checkout. Les événements réussis anciens non rapprochés doivent être examinés manuellement, car les ignorer sans rapprochement pourrait masquer un double paiement.

### P2 — Limitation de débit distribuée

Aucune limite de débit fiable partagée entre les instances serverless n'a été confirmée dans la revue statique. Les journaux de sécurité aident à détecter les anomalies mais ne sont pas un rate limiter. Ajouter un limiteur partagé (RPC transactionnel/Postgres ou service de rate-limit) sur les routes d'authentification, provisioning, checkout et endpoints de génération coûteuse avant une ouverture publique importante.

### P2 — Données personnelles d'enfants

Le produit traite des données d'élèves, parents, notes et paiements. Les événements d'audit des webhooks ont été minimisés, mais une revue de conformité, de rétention, de sauvegarde, de contrôle d'accès par rôle et d'accès au support reste nécessaire. Formaliser qui accède aux données, la durée de conservation, les exports/suppressions, les sous-traitants et tout transfert hors du Sénégal ; solliciter un avis compétent/CDP en fonction des traitements réels.

### P2 — Ordre temporel des événements Paddle

Les événements Paddle sont contrôlés et rapprochés, mais la revue n'a pas ajouté de mécanisme persistant comparant l'ordre temporel des événements d'un même abonnement. Tester explicitement le scénario « événement ancien reçu après un événement récent » et conserver un timestamp fournisseur/ID d'événement par abonnement avant de dépendre de l'automatisation en production.

### P3 — Observabilité

`server/security.ts` laisse l'application continuer quand l'observabilité échoue. C'est souhaitable pour la disponibilité, mais l'absence de `SECURITY_HASH_SALT`, des permissions RPC incorrectes ou une panne Supabase peuvent rendre les alertes silencieusement incomplètes. Vérifier l'existence des alertes et un événement de bout en bout après déploiement, puis alerter si la télémétrie est désactivée.

## Plan de validation avant mise en production

1. Installer les dépendances avec `npm ci`, exécuter `npm test`, `npm run build` et `npm run build:android` dans le CI ; corriger tout diagnostic.
2. Appliquer les migrations sur un environnement de test cloné et tester les contrôles RLS avec un compte par rôle, en particulier l'impossibilité pour un utilisateur de changer son `role` ou son `school_id`.
3. Tester pour Wave et SasPay : succès, échec, annulation, webhook falsifié, même webhook répété, événements dans le désordre, timeout fournisseur, montant/devise inexacts, session remplacée et panne Supabase après réception.
4. Tester Paddle avec des événements désordonnés et événements inconnus/non rapprochés.
5. Tester l'APK debug réel sur Android, vérifier la navigation checkout Wave externe et les retours SasPay/Paddle ; ne créer/signature pas de release avec des secrets de test.
6. N'ouvrir l'intégration SIMEN qu'après réception d'un contrat API/SSO officiel et validation sécurité/données personnelles.

## Sources officielles utilisées pour cette revue

- Android SDK action : https://github.com/android-actions/setup-android/blob/main/README.md
- Wave Checkout : https://docs.wave.com/checkout
- Wave webhooks : https://docs.wave.com/webhook
- SasPay webhooks : https://docs.saspay.me/api-reference/webhooks
- SasPay checkout status : https://docs.saspay.me/api-reference/payments/checkout-status
- Ministère de l'Éducation, SIMEN : https://www.education.sn/pages/systeme-dinformation-et-de-management-de-leducation-nationale-simen
- Loi sénégalaise 2008-12 : https://senlii.org/en/akn/sn/act/2008/12/fra@2008-05-03
