// ============================================================
// auth.js
// প্রতিটি প্রোটেক্টেড পেজে (chat.html, profile.html) লোড হয়।
// - লগইন চেক করে, না থাকলে login.html এ পাঠায়
// - ৩ মিনিট Inactive থাকলে Auto Logout করে
// - Online/Offline Presence ও Last Seen আপডেট করে
// ============================================================

const INACTIVITY_LIMIT_MS = 3 * 60 * 1000; // ৩ মিনিট
let inactivityTimer = null;
let currentUserId = null;

/**
 * প্রোটেক্টেড পেজে auth guard বসাতে কল করুন।
 * @param {(user: firebase.User) => void} onReady - ইউজার লগইন থাকলে কলব্যাক
 */
function requireAuth(onReady) {
  showLoader();
  auth.onAuthStateChanged(async (user) => {
    hideLoader();
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    currentUserId = user.uid;
    await setPresence(true);
    startInactivityWatcher();
    onReady(user);
  });
}

/* ---------------- Auto Logout on Inactivity ---------------- */
function startInactivityWatcher() {
  const resetTimer = () => {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(async () => {
      showToast("৩ মিনিট নিষ্ক্রিয় থাকার কারণে অটো লগআউট হয়েছে।", "info");
      await logoutUser();
    }, INACTIVITY_LIMIT_MS);
  };

  ["mousemove", "keydown", "click", "scroll", "touchstart"].forEach((evt) =>
    document.addEventListener(evt, resetTimer, { passive: true })
  );
  resetTimer();
}

/* ---------------- Presence (Online/Offline + Last Seen) ---------------- */
async function setPresence(isOnline) {
  if (!currentUserId) return;
  try {
    await db.collection("users").doc(currentUserId).update({
      status: isOnline ? "online" : "offline",
      lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("Presence update failed:", err);
  }
}

// ব্রাউজার/ট্যাব বন্ধ বা মিনিমাইজ করলে অফলাইন মার্ক করা
window.addEventListener("beforeunload", () => {
  if (currentUserId) {
    // beforeunload-এ async কাজ নিশ্চিতভাবে শেষ হবার গ্যারান্টি নেই,
    // তাই sendBeacon-স্টাইল ফায়ার-অ্যান্ড-ফরগেট আপডেট ব্যবহার করা হলো।
    db.collection("users").doc(currentUserId).update({
      status: "offline",
      lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }
});
document.addEventListener("visibilitychange", () => {
  if (!currentUserId) return;
  setPresence(document.visibilityState === "visible");
});

/* ---------------- Logout ---------------- */
async function logoutUser() {
  try {
    await setPresence(false);
    await auth.signOut();
    window.location.href = "login.html";
  } catch (err) {
    showToast("লগআউট করতে সমস্যা হয়েছে।", "error");
  }
}
