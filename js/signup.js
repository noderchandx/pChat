// ============================================================
// signup.js
// ============================================================

let selectedAvatarFile = null;

// ইতিমধ্যে লগইন থাকলে সরাসরি চ্যাটে পাঠানো
auth.onAuthStateChanged((user) => {
  if (user) window.location.replace("chat.html");
});

generateCaptcha("captchaCanvas");
document.getElementById("refreshCaptcha").addEventListener("click", () => {
  generateCaptcha("captchaCanvas");
});

const avatarInput = document.getElementById("avatarInput");
const avatarPreview = document.getElementById("avatarPreview");
avatarPreview.addEventListener("click", () => avatarInput.click());
avatarInput.addEventListener("change", () => {
  const file = avatarInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("শুধু ছবি ফাইল আপলোড করুন।", "error");
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    showToast("ছবির সাইজ ৪MB এর কম হতে হবে।", "error");
    return;
  }
  selectedAvatarFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    avatarPreview.innerHTML = `<img src="${e.target.result}" alt="avatar preview">`;
  };
  reader.readAsDataURL(file);
});

function setError(id, msg) {
  document.getElementById(id).textContent = msg || "";
}

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const mobile = document.getElementById("mobile").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const captchaInput = document.getElementById("captchaInput").value;

  // ---- Reset errors ----
  ["avatarError", "nameError", "mobileError", "emailError", "passwordError", "confirmPasswordError", "captchaError"]
    .forEach((id) => setError(id, ""));

  let valid = true;

  if (!selectedAvatarFile) {
    setError("avatarError", "প্রোফাইল ছবি বাধ্যতামূলক।");
    valid = false;
  }
  if (!isValidName(name)) {
    setError("nameError", "সঠিক নাম দিন (কমপক্ষে ২ ক্যারেক্টার)।");
    valid = false;
  }
  if (!isValidMobile(mobile)) {
    setError("mobileError", "সঠিক মোবাইল নম্বর দিন (যেমন 017XXXXXXXX)।");
    valid = false;
  }
  if (!isValidEmail(email)) {
    setError("emailError", "সঠিক ইমেইল দিন অথবা ফাঁকা রাখুন।");
    valid = false;
  }
  if (!isValidPassword(password)) {
    setError("passwordError", "পাসওয়ার্ডে কমপক্ষে ৬ ক্যারেক্টার, ১টি অক্ষর ও ১টি সংখ্যা থাকতে হবে।");
    valid = false;
  }
  if (password !== confirmPassword) {
    setError("confirmPasswordError", "পাসওয়ার্ড মিলছে না।");
    valid = false;
  }
  if (!verifyCaptcha("captchaCanvas", captchaInput)) {
    setError("captchaError", "ক্যাপচা সঠিক নয়, আবার চেষ্টা করুন।");
    generateCaptcha("captchaCanvas");
    valid = false;
  }

  if (!valid) return;

  const signupBtn = document.getElementById("signupBtn");
  signupBtn.disabled = true;
  showLoader();

  try {
    // ১. মোবাইল নম্বর ইতিমধ্যে ব্যবহৃত কিনা যাচাই (Uniqueness)
    const mobileDoc = await db.collection("mobileIndex").doc(mobile).get();
    if (mobileDoc.exists) {
      setError("mobileError", "এই মোবাইল নম্বর দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে।");
      hideLoader();
      signupBtn.disabled = false;
      return;
    }

    // ২. Firebase Auth অ্যাকাউন্ট তৈরি
    // নোট: Firebase Auth নিজেই পাসওয়ার্ড হ্যাশ করে সংরক্ষণ করে (bcrypt/scrypt সদৃশ),
    // আমরা কখনোই প্লেইনটেক্সট পাসওয়ার্ড নিজেদের ডাটাবেজে সংরক্ষণ করি না।
    const pseudoEmail = mobileToPseudoEmail(mobile);
    const cred = await auth.createUserWithEmailAndPassword(pseudoEmail, password);
    const uid = cred.user.uid;

    // ৩. প্রোফাইল ছবি Cloudinary-তে আপলোড
    const photoURL = await uploadImageToCloudinary(selectedAvatarFile, `avatars/${uid}`);

    // ৪. Firestore-এ ইউজার প্রোফাইল ও মোবাইল ইনডেক্স সংরক্ষণ (batch — atomicity)
    const batch = db.batch();
    batch.set(db.collection("users").doc(uid), {
      name,
      mobile,
      email: email || null,
      photoURL,
      status: "online",
      lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      blocked: [],
    });
    batch.set(db.collection("mobileIndex").doc(mobile), { uid });
    await batch.commit();

    showToast("অ্যাকাউন্ট তৈরি হয়েছে! স্বাগতম।", "success");
    window.location.href = "chat.html";
  } catch (err) {
    console.error(err);
    let msg = "সাইন আপ ব্যর্থ হয়েছে, আবার চেষ্টা করুন।";
    if (err.code === "auth/email-already-in-use") msg = "এই মোবাইল নম্বর দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে।";
    if (err.code === "auth/weak-password") msg = "পাসওয়ার্ড খুবই দুর্বল।";
    showToast(msg, "error");
    generateCaptcha("captchaCanvas");
  } finally {
    hideLoader();
    signupBtn.disabled = false;
  }
});
