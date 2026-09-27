# École OS — Scalabilité UX / SLC

## Principe

> La complexité du système peut augmenter. La complexité ressentie par l'utilisateur doit rester stable.

## Navigation

- 4 à 6 destinations principales selon le rôle.
- Les fonctions secondaires passent dans **Plus**.
- `Mon compte` reste stable.
- Les fonctions sensibles (`Ops`, `Pilotage`, `Membres`) restent réservées aux rôles autorisés.

## Communauté

La communauté n'est pas un flux global unique.

Ordre de priorité :

1. **Espace de proximité** — classe/groupe lié au profil.
2. **Annonces de l'établissement** — informations durables et vérifiées.
3. **Vie de l'établissement** — discussion générale, non prioritaire.

Chaque espace peut être scoped par `school`, `role` ou `class`.

## Rattrapage

La vue communauté expose :

- `À retenir maintenant`;
- compteur de non-lus par espace;
- dernier message utile par espace;
- action **Rattraper**;
- lecture limitée de l'historique au lieu d'un chargement massif.

## Performance et croissance

Le frontend ne charge plus un gros historique pour comprendre les espaces. Un RPC compact (`get_community_overview`) renvoie les informations d'état nécessaires : nombre de non-lus, dernier message et date d'activité.

## Nouvelles règles de produit

Une nouvelle fonctionnalité doit répondre à trois questions avant d'obtenir une place dans la navigation :

1. À qui sert-elle ?
2. À quel moment est-elle utile ?
3. Doit-elle être visible en permanence ?

Si la réponse à la troisième question est non, la fonction ne reçoit pas de bouton permanent.

## Frontière Communauté / Evolution

**Communauté** sert uniquement à lire, publier et retrouver des messages dans les espaces auxquels l'utilisateur a accès.

**Evolution** sert uniquement aux propositions d'amélioration, sondages, décisions et feuille de route.

Un message de Communauté n'est **jamais transféré automatiquement** vers Evolution.

### Détection d'idée non intrusive

Le compositeur peut détecter localement, avec des règles déterministes, qu'un brouillon ressemble à une proposition d'amélioration. Le détecteur ne publie rien et ne déplace aucun message.

Le système présente uniquement une suggestion facultative : **« Ajouter à Evolution »** ou **« Ignorer »**.

Cette approche est préférée à une classification automatique silencieuse : elle limite les faux positifs, garde l'utilisateur maître de la décision et évite de transformer chaque discussion en fiche produit.

### Règle de rédaction de la Communauté

Les textes de l'interface doivent préciser :
- qui peut publier ;
- qui peut lire ;
- où le message reste visible ;
- ce qui relève d'une annonce officielle ;
- ce qui relève d'une suggestion d'amélioration.

Éviter les formulations métaphoriques lorsqu'elles peuvent créer une ambiguïté fonctionnelle.

## Frontière Communauté / Evolution

**Communauté** sert uniquement à lire, publier et retrouver des messages dans les espaces auxquels l'utilisateur a accès.

**Evolution** sert uniquement aux propositions d'amélioration, sondages, décisions et feuille de route.

Un message de Communauté n'est **jamais transféré automatiquement** vers Evolution.

### Détection d'idée non intrusive

Le compositeur peut détecter localement, avec des règles déterministes, qu'un brouillon ressemble à une proposition d'amélioration. Le détecteur ne publie rien et ne déplace aucun message.

Le système présente uniquement une suggestion facultative : **« Ajouter à Evolution »** ou **« Ignorer »**.

Cette approche est préférée à une classification automatique silencieuse : elle limite les faux positifs, garde l'utilisateur maître de la décision et évite de transformer chaque discussion en fiche produit.

### Règle de rédaction de la Communauté

Les textes de l'interface doivent préciser :
- qui peut publier ;
- qui peut lire ;
- où le message reste visible ;
- ce qui relève d'une annonce officielle ;
- ce qui relève d'une suggestion d'amélioration.

Éviter les formulations métaphoriques lorsqu'elles peuvent créer une ambiguïté fonctionnelle.
