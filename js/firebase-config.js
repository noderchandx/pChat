// ============================================================
// firebase-config.js
// ------------------------------------------------------------
// এখানে আপনার নিজের Firebase প্রজেক্টের কনফিগারেশন বসান।
// Firebase Console → Project Settings → General → Your apps → SDK setup and configuration
// থেকে এই মানগুলো পাবেন।
//
// ⚠️ নিরাপত্তা নোট:
// এই config অবজেক্টে থাকা apiKey ইত্যাদি "গোপন" কিছু নয় — এটা পাবলিক
// ক্লায়েন্ট আইডেন্টিফায়ার মাত্র। প্রকৃত নিরাপত্তা নিশ্চিত হয় Firestore ও
// Storage Security Rules দিয়ে (দেখুন firestore.rules ও storage.rules)।
// তাই GitHub-এ পাবলিক রিপোতে এই ফাইল থাকলেও সমস্যা নেই, তবে Rules অবশ্যই
// শক্তভাবে সেট করতে হবে।
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCgMvMD_fKPez2c-BaeFrFdoJHKstOtUyQ",
  authDomain: "pchat-c39f7.firebaseapp.com",
  projectId: "pchat-c39f7",
  storageBucket: "pchat-c39f7.firebasestorage.app",
  messagingSenderId: "927321378744",
  appId: "1:927321378744:web:6e8c240a5250014c1fc94d",
  measurementId: "G-G673K2TSPW"
};

// Firebase App Initialize (v9 compat SDK ব্যবহার করা হয়েছে যাতে
// GitHub Pages-এ কোনো বান্ডলার/build step ছাড়াই সরাসরি <script> ট্যাগ দিয়ে চলে)
firebase.initializeApp(firebaseConfig);

// শেয়ার্ড ইনস্ট্যান্স — অন্য সব js ফাইল এগুলো ব্যবহার করবে
// (Storage আর ব্যবহার হচ্ছে না — ছবি আপলোডের জন্য Cloudinary ব্যবহার করা
// হচ্ছে, দেখুন js/cloudinary-config.js — কারণ Firebase Storage এখন Blaze
// (billing) প্ল্যান বাধ্যতামূলক করেছে)
const auth = firebase.auth();
const db = firebase.firestore();

// অফলাইন পারসিস্টেন্স (ঐচ্ছিক, ভালো UX দেয়)
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn("Firestore persistence not enabled:", err.code);
});

// মোবাইল নম্বরকে Firebase Auth ইমেইল ফরম্যাটে রূপান্তরের জন্য কনস্ট্যান্ট
// (Firebase Auth নিজে থেকে "phone+password" সাপোর্ট করে না OTP ছাড়া,
// তাই আমরা মোবাইল নম্বরকে একটি pseudo-email এ ম্যাপ করি)
const PSEUDO_EMAIL_DOMAIN = "@chatapp.local";

function mobileToPseudoEmail(mobile) {
  return `${mobile.replace(/\D/g, "")}${PSEUDO_EMAIL_DOMAIN}`;
}
