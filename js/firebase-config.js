// The Handy Neighbor Co — Firebase web config
//
// ---------------------------------------------------------------------------
// HOW TO FILL THIS IN
//   Firebase Console -> Project Settings -> General
//   -> "Your apps" -> Web app (add one if there isn't a </> app yet)
//   -> "SDK setup and configuration" -> Config
//   Copy the values into the object below.
// ---------------------------------------------------------------------------
//
// These values are NOT secret. They identify your project to Firebase, and
// they ship in every Firebase web app on the internet. What actually protects
// your data is firestore.rules / storage.rules (the public can create a lead
// and nothing else) plus App Check. Don't let the word "apiKey" worry you.

export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.firebasestorage.app",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

// Optional but recommended once the form is live: App Check with reCAPTCHA v3
// stops bots from filling your leads collection with garbage.
//   Firebase Console -> App Check -> Apps -> register the web app -> reCAPTCHA v3
// Paste the site key here, then uncomment the App Check block in lead-form.js.
export const recaptchaSiteKey = "";
