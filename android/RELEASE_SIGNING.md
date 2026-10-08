# Signer le build release d'École OS

Le point 1 de l'audit signale que seul le build **debug** existe
(`android:debuggable="true"`, suffixe `-debug`). Un build debug permet à
quiconque a `adb` sur l'appareil de lire les données de l'app, y compris une
session Supabase active. Pour distribuer l'app, il faut un build **release**
signé — jamais le `.apk` déjà présent dans `android/app/build/outputs/apk/debug/`.

Cette clé est l'identité définitive de votre app : Google Play (et toute
réinstallation) exige la **même** clé pour chaque mise à jour future. Si vous
la perdez, vous ne pourrez plus jamais mettre à jour l'app publiée sous le même
`applicationId` — il faudra la republier comme une app neuve, avec une nouvelle
fiche, perdant avis et installations. Conservez l'original hors du dépôt, avec
une sauvegarde chiffrée que vous contrôlez. Si vous utilisez GitHub Actions pour
un release signé, GitHub aura nécessairement accès à une copie via ses secrets :
réservez cet accès à un dépôt et des administrateurs de confiance.

**Attention :** `keyPublish/keyPath` et `keyPublish/2Password.txt` ont déjà figuré
dans l'historique Git du dépôt. Ne les utilisez pas pour le workflow. Considérez
cette clé comme compromise si le dépôt a été partagé ; créez une nouvelle clé,
retirez ces fichiers de l'historique avant de distribuer une nouvelle application.
Si une version est déjà publiée, planifiez la rotation avec le canal de
publication (notamment Play App Signing) : changer de clé peut empêcher les mises à jour.

## 1. Générer la clé (une seule fois, en local)

Depuis un terminal, sur votre machine (nécessite le JDK, fourni avec Android
Studio) :

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore ecole-os-release.jks \
  -alias ecole-os \
  -keyalg RSA -keysize 2048 -validity 10000
```

`keytool` demande un mot de passe pour le fichier (`storePassword`), un mot de
passe pour la clé (`keyPassword` — vous pouvez réutiliser le même), puis votre
nom, organisation, ville, pays. Ces informations sont publiques dans le
certificat ; elles n'ont pas besoin d'être exactes, mais gardez-les
cohérentes pour de futures clés.

Déplacez `ecole-os-release.jks` dans `android/app/` (ce dossier est déjà
protégé par `.gitignore`, le fichier ne sera jamais commité).

## 2. Déclarer la clé pour Gradle

Créez `android/keystore.properties` (à la racine du dossier `android/`, à côté
de `settings.gradle`) :

```properties
storeFile=app/ecole-os-release.jks
storePassword=VOTRE_MOT_DE_PASSE_STORE
keyAlias=ecole-os
keyPassword=VOTRE_MOT_DE_PASSE_CLE
```

Ce fichier est aussi dans `.gitignore` — vérifiez-le avant un premier commit :

```bash
git check-ignore -v android/keystore.properties android/app/ecole-os-release.jks
```

Les deux lignes doivent s'afficher. Si rien ne s'affiche, ne committez pas
avant d'avoir corrigé `.gitignore`.

## 3. Construire le release signé

```bash
cd android
./gradlew assembleRelease
```

Sans `keystore.properties`, cette commande échoue maintenant avec un message
explicite plutôt que de produire un APK invalide ou non signé. Le résultat
signé apparaît dans :

```
android/app/build/outputs/apk/release/app-release.apk
```

Vérifiez qu'il n'est pas debuggable avant de le distribuer :

```bash
aapt dump badging app/build/outputs/apk/release/app-release.apk | grep -i debug
```

Cette commande ne doit rien afficher. Vérifiez aussi la version :

```bash
aapt dump badging app/build/outputs/apk/release/app-release.apk | grep versionName
```

Doit afficher `versionName='1.0.0'`, sans suffixe `-debug`.

## 4. Signer automatiquement avec GitHub Actions (facultatif)

Dans **Settings → Secrets and variables → Actions → New repository secret**, ajoutez :

| Secret | Contenu |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Le **nouveau** fichier `.jks` encodé en base64 sur une seule ligne |
| `ANDROID_STORE_PASSWORD` | Mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | Alias de la clé (`ecole-os` dans l'exemple) |
| `ANDROID_KEY_PASSWORD` | Mot de passe de la clé |

Par exemple, en local : `base64 -w 0 android/app/ecole-os-release.jks` (Linux) ou
`base64 < android/app/ecole-os-release.jks | tr -d '\n'` (macOS). Copiez le résultat
directement dans le secret GitHub, **jamais dans un commit, une issue ou ce chat**.
Un push d'un tag `v*` ou **Actions → APK Android → Run workflow → release** déclenche
l'assemblage signé. Le workflow vérifie la signature avec `apksigner` avant de rendre
l'APK téléchargeable dans les **Artifacts** de l'exécution (30 jours). Les secrets
ne sont pas fournis aux builds de pull requests ; seuls les tags et lancements
manuels peuvent demander un release. Protégez les droits d'écriture sur le dépôt
et le déclenchement manuel si vous y stockez une clé de distribution.

La version Android (`versionCode` et `versionName` dans `android/app/build.gradle`)
doit être augmentée pour chaque nouvelle mise à jour publiée. Le workflow ne
crée ni publication GitHub Release ni déploiement Play Store automatiquement.

## 5. Sauvegarder la clé en lieu sûr

Copiez `ecole-os-release.jks` et son mot de passe dans un gestionnaire de mots
de passe ou un coffre chiffré (jamais par email ou chat en clair). Si vous
prévoyez de publier sur Google Play, activez *Play App Signing* lors de la
première publication : Google conserve alors une copie sécurisée de la clé
d'upload et peut vous aider à la régénérer en cas de perte — contrairement à
une clé purement locale.
