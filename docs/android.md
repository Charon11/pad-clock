# Application Android (APK) — pad-clock

`android/` est un wrapper Capacitor qui affiche `https://tab-clock.web.app` (le site déjà déployé, voir `firebase.json`) en plein écran natif, sans barre de statut ni barre de navigation, avec l'écran maintenu allumé (usage horloge murale).

## Contrainte de version — Nexus 7 / Android 6.0.1

Cible : Nexus 7 (modèle 2013), seul à supporter officiellement Android 6.0.1 (API 23).

- **Ne jamais migrer vers Capacitor 8** : il impose `minSdkVersion = 24` (Android 7.0), ce qui exclurait le Nexus 7.
- Rester sur la branche **Capacitor 7.x** (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android` dans `package.json`), qui utilise `minSdkVersion = 23` (voir `android/variables.gradle`) — compatible exactement avec Android 6.0/6.0.1.
- Le projet build avec `compileSdkVersion`/`targetSdkVersion = 35`, mais ça n'affecte pas la compatibilité runtime sur un appareil API 23 : seul `minSdkVersion` détermine l'installabilité.
- `npm install` peut installer TypeScript en v7 (`latest`) par défaut, ce qui casse la lecture de `capacitor.config.ts` par `@capacitor/cli` (`Cannot read properties of undefined (reading 'CommonJS')`). Garder `typescript` en v5.x dans les devDependencies.

## Builder l'APK

Ce dépôt ne contient pas le SDK Android (pas buildé en CI/sandbox). Pour builder localement :

```bash
npm install
npx cap sync android
```

Puis soit :
- **Android Studio** : ouvrir le dossier `android/` (ou `npx cap open android`), puis *Build > Build Bundle(s)/APK(s) > Build APK(s)*.
- **Ligne de commande** (nécessite un SDK Android installé, `ANDROID_HOME`/`ANDROID_SDK_ROOT` configurés) :
  ```bash
  cd android
  ./gradlew assembleDebug
  ```
  L'APK est généré dans `android/app/build/outputs/apk/debug/app-debug.apk`.

## Installer sur le Nexus 7

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

Ou copier le fichier `.apk` sur la tablette et l'installer manuellement (activer "Sources inconnues" dans les paramètres Android 6.0.1).

## Limites connues

- L'app charge le site en direct via `server.url` (pas de bundle offline) : sans Wi-Fi, l'écran affiche une erreur de chargement au lieu du dashboard.
- Pas d'icône/splash screen personnalisés dans ce scaffold — l'icône par défaut de Capacitor est utilisée.
