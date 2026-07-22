// ============================================================
// profile.js
// ============================================================

let profileUser = null;
let newAvatarFile = null;

requireAuth((user) => {
  profileUser = user;
  loadProfile();
  bindUI();
});

async function loadProfile() {
  showLoader();
  try {
    const doc = await db.collection("users").doc(profileUser.uid).get();
    if (!doc.exists) {
      // এই uid-এর জন্য কোনো প্রোফাইল ডকুমেন্ট নেই (সাইনআপের সময় অসম্পূর্ণভাবে তৈরি হয়ে থাকতে পারে)।
      // লগআউট করে আবার সাইনআপ করতে বলা ছাড়া আর কিছু করার নেই।
      showToast("প্রোফাইল খুঁজে পাওয়া যায়নি। আবার লগইন/সাইনআপ করুন।", "error");
      await auth.signOut();
      window.location.href = "signup.html";
      return;
    }
    const data = doc.data();
    document.getElementById("name").value = data.name || "";
    document.getElementById("mobile").value = data.mobile || "";
    document.getElementById("email").value = data.email || "";
    if (data.photoURL) {
      document.getElementById("avatarPreview").innerHTML = `<img src="${data.photoURL}" alt="avatar">`;
    }
  } catch (err) {
    console.error("Profile load error:", err.code || err.message, err);
    showToast("প্রোফাইল লোড করতে সমস্যা হয়েছে।", "error");
  } finally {
    hideLoader();
  }
}

function bindUI() {
  document.getElementById("backBtn").addEventListener("click", () => {
    window.location.href = "chat.html";
  });
  document.getElementById("themeToggleBtn").addEventListener("click", toggleTheme);
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    const ok = await confirmDialog("আপনি কি লগআউট করতে চান?");
    if (ok) logoutUser();
  });

  const avatarInput = document.getElementById("avatarInput");
  document.getElementById("avatarPreview").addEventListener("click", () => avatarInput.click());
  avatarInput.addEventListener("change", () => {
    const file = avatarInput.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 4 * 1024 * 1024) {
      showToast("সঠিক ছবি (৪MB এর কম) নির্বাচন করুন।", "error");
      return;
    }
    newAvatarFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById("avatarPreview").innerHTML = `<img src="${e.target.result}" alt="avatar">`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("profileForm").addEventListener("submit", saveProfile);
  document.getElementById("passwordForm").addEventListener("submit", changePassword);
}

async function saveProfile(e) {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();

  document.getElementById("nameError").textContent = "";
  document.getElementById("emailError").textContent = "";

  let valid = true;
  if (!isValidName(name)) {
    document.getElementById("nameError").textContent = "সঠিক নাম দিন।";
    valid = false;
  }
  if (!isValidEmail(email)) {
    document.getElementById("emailError").textContent = "সঠিক ইমেইল দিন অথবা ফাঁকা রাখুন।";
    valid = false;
  }
  if (!valid) return;

  showLoader();
  try {
    const updates = { name, nameLower: name.toLowerCase(), email: email || null };

    if (newAvatarFile) {
      updates.photoURL = await uploadImageToCloudinary(newAvatarFile, `avatars/${profileUser.uid}`);
      newAvatarFile = null;
    }

    await db.collection("users").doc(profileUser.uid).update(updates);
    showToast("প্রোফাইল সংরক্ষিত হয়েছে।", "success");
  } catch (err) {
    console.error(err);
    showToast("প্রোফাইল সংরক্ষণ করতে সমস্যা হয়েছে।", "error");
  } finally {
    hideLoader();
  }
}

async function changePassword(e) {
  e.preventDefault();
  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  document.getElementById("newPasswordError").textContent = "";

  if (!isValidPassword(newPassword)) {
    document.getElementById("newPasswordError").textContent = "কমপক্ষে ৬ ক্যারেক্টার, ১টি অক্ষর ও ১টি সংখ্যা থাকতে হবে।";
    return;
  }

  showLoader();
  try {
    // Re-authenticate — Firebase নিরাপত্তার জন্য sensitive অপারেশনের আগে এটি প্রয়োজন করে
    const credential = firebase.auth.EmailAuthProvider.credential(profileUser.email, currentPassword);
    await profileUser.reauthenticateWithCredential(credential);
    await profileUser.updatePassword(newPassword);
    showToast("পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে।", "success");
    document.getElementById("passwordForm").reset();
  } catch (err) {
    console.error(err);
    let msg = "পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে।";
    if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
      msg = "বর্তমান পাসওয়ার্ড সঠিক নয়।";
    }
    showToast(msg, "error");
  } finally {
    hideLoader();
  }
}
