// ============================================================
// login.js
// ============================================================

auth.onAuthStateChanged((user) => {
  if (user) window.location.replace("chat.html");
});

function setError(id, msg) {
  document.getElementById(id).textContent = msg || "";
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  setError("mobileError", "");
  setError("passwordError", "");

  const mobile = document.getElementById("mobile").value.trim();
  const password = document.getElementById("password").value;

  if (!isValidMobile(mobile)) {
    setError("mobileError", "সঠিক মোবাইল নম্বর দিন।");
    return;
  }
  if (!password) {
    setError("passwordError", "পাসওয়ার্ড দিন।");
    return;
  }

  // Basic client-side rate limiting — brute-force চেষ্টা কমাতে সাহায্য করে
  if (!loginRateLimiter.tryAction()) {
    showToast("অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।", "error");
    return;
  }

  const loginBtn = document.getElementById("loginBtn");
  loginBtn.disabled = true;
  showLoader();

  try {
    const pseudoEmail = mobileToPseudoEmail(mobile);
    await auth.signInWithEmailAndPassword(pseudoEmail, password);
    showToast("সফলভাবে লগইন হয়েছে!", "success");
    window.location.href = "chat.html";
  } catch (err) {
    console.error(err);
    let msg = "লগইন ব্যর্থ হয়েছে।";
    if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
      msg = "মোবাইল নম্বর অথবা পাসওয়ার্ড সঠিক নয়।";
    } else if (err.code === "auth/too-many-requests") {
      msg = "অনেকবার ভুল চেষ্টা হয়েছে। কিছুক্ষণ পর চেষ্টা করুন।";
    }
    showToast(msg, "error");
  } finally {
    hideLoader();
    loginBtn.disabled = false;
  }
});
