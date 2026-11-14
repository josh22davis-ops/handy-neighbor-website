// The Handy Neighbor Co — project request form
//
// Replaces the old Formspree POST. Writes a document to /leads and uploads any
// photos to leads/{leadId}/, then a Cloud Function turns that into a real
// Customer + Property + Project and pushes a notification to Josh's phone.
//
// Photos are resized client-side before upload — a modern phone shoots 4-6 MB
// per frame, and a homeowner on cell service will abandon the form before six
// of those finish. 2048px JPEG at 0.82 quality is plenty to see wood rot.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, doc, collection, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadBytes,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// --- Optional: App Check. Uncomment after registering a reCAPTCHA v3 key. ---
// import { initializeAppCheck, ReCaptchaV3Provider }
//   from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js";
// import { recaptchaSiteKey } from "./firebase-config.js";
// if (recaptchaSiteKey) {
//   initializeAppCheck(app, {
//     provider: new ReCaptchaV3Provider(recaptchaSiteKey),
//     isTokenAutoRefreshEnabled: true,
//   });
// }

const MAX_PHOTOS = 10;
const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.82;


/* ------------------------------------------------------------------ *
 * image resizing
 * ------------------------------------------------------------------ */

async function shrinkImage(file) {
  // Anything that isn't an image, or is already small, goes up untouched.
  if (!file.type.startsWith("image/") || file.size < 400 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 2 * 1024 * 1024) return file;

    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // if anything about canvas fails, just send the original
  }
}


/* ------------------------------------------------------------------ *
 * form wiring
 * ------------------------------------------------------------------ */

export function initLeadForm({
  formId = "contactForm",
  fileInputId = "photos",
  statusId = "formStatus",
  submitSelector = ".form-submit",
  thanksUrl = "contact-thanks.html",
} = {}) {
  const form = document.getElementById(formId);
  if (!form) return;

  const fileInput = document.getElementById(fileInputId);
  const statusEl = document.getElementById(statusId);
  const submitBtn = form.querySelector(submitSelector);
  const originalLabel = submitBtn ? submitBtn.textContent : "Send";

  const say = (msg, kind = "info") => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.dataset.kind = kind;
    statusEl.style.display = msg ? "block" : "none";
  };

  // Live count + size feedback on the photo picker.
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const n = fileInput.files.length;
      const label = document.getElementById("photoLabel");
      if (!label) return;
      label.textContent = n === 0
        ? "Add photos (optional)"
        : `${n} photo${n > 1 ? "s" : ""} selected${n > MAX_PHOTOS ? ` — only the first ${MAX_PHOTOS} will be sent` : ""}`;
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const message = String(data.get("message") || "").trim();

    if (!name || !message) {
      say("Please add your name and a short description.", "error");
      return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Sending..."; }

    // Pre-generate the id so photos can go into the right folder before the
    // document exists. The Cloud Function only trusts paths under leads/{id}/.
    const leadRef = doc(collection(db, "leads"));
    const leadId = leadRef.id;
    const photoPaths = [];

    try {
      const files = fileInput ? Array.from(fileInput.files).slice(0, MAX_PHOTOS) : [];

      for (const [i, raw] of files.entries()) {
        say(`Uploading photo ${i + 1} of ${files.length}...`);
        const file = await shrinkImage(raw);
        const safeName = `${String(i + 1).padStart(2, "0")}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const path = `leads/${leadId}/${safeName}`;
        await uploadBytes(storageRef(storage, path), file, { contentType: file.type });
        photoPaths.push(path);
      }

      say("Sending your request...");

      await setDoc(leadRef, {
        name,
        phone: String(data.get("phone") || "").trim(),
        email: String(data.get("email") || "").trim(),
        address: String(data.get("address") || "").trim(),
        message,
        photoPaths,
        sourcePage: location.pathname.replace(/^\//, "") || "index.html",
        userAgent: navigator.userAgent.slice(0, 300),
        createdAt: serverTimestamp(),
        processed: false,
      });

      window.location.href = thanksUrl;
    } catch (err) {
      console.error("lead submit failed", err);
      say(
        "Something went wrong sending that. Please call or text (402) 350-2583 — " +
        "I'd rather hear from you directly than have you give up on the form.",
        "error"
      );
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalLabel; }
    }
  });
}
