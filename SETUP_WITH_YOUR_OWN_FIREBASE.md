# Setting this up with your own Firebase project

This copy of the project has all project-specific credentials removed. To run it,
create your own Firebase project and plug your credentials into the placeholders below.

## 1. Create a Firebase project

In the [Firebase console](https://console.firebase.google.com/), create a project, then
enable **Authentication** (Email/Password) and **Firestore**.

## 2. App config (`split_app/src/config/firebase.ts`)

Firebase console -> Project settings -> General -> Your apps -> add a **Web app** ->
copy the config values into the `firebaseConfig` object (currently placeholders like
`YOUR_FIREBASE_API_KEY`).

## 3. Android (`split_app/android/app/google-services.json`)

Firebase console -> Project settings -> General -> Your apps -> add an **Android app**
(package name `com.split_app`) -> download `google-services.json` and save it as
`split_app/android/app/google-services.json` (a `.example` template is provided next
to it — copy and fill in, or just use the downloaded file directly).

## 4. Android release signing (optional)

Only needed if you want to build a signed release APK. Without it, release builds fall
back to the debug key.

Generate a keystore and put it at `split_app/android/app/splitapp-release.keystore`,
then copy `split_app/android/keystore.properties.example` to
`split_app/android/keystore.properties` and fill in the password.

## 5. Firestore rules / Cloud Functions (`firebase/`)

Copy `firebase/.firebaserc` and replace `YOUR_FIREBASE_PROJECT_ID` with your project's
ID, then run `firebase init` / `firebase deploy` from that directory if you want to
deploy the rules and functions (see `CLAUDE.md` — as shipped, none of this is deployed
and the app does all balance calculations client-side).

## 6. Push sender (optional, `firebase/push-sender/`)

Only needed for the standalone push-notification sender script. Firebase console ->
Project settings -> Service accounts -> Generate new private key -> save as
`firebase/push-sender/serviceAccountKey.json` (a `.example` template is provided).

## 7. Create the first admin user

Self-registration is disabled server-side. Create your first admin user directly in
Firebase Authentication + a matching `users` document in Firestore (see `CLAUDE.md`
for the `User` type shape), then use that account to create further users from the app.

## What was removed from this copy

- Real Firebase web config, `google-services.json`, release keystore + password,
  Firestore project ID, and the push-sender service account private key.
- `node_modules`, build artifacts (`build/`, `.gradle`, `Pods`, `firebase/functions/lib`), and local IDE/tool settings.

Nothing else was changed — this is otherwise the same codebase described in `CLAUDE.md`.
