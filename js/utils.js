// ============================================================
// utils.js
// শেয়ার্ড হেল্পার ফাংশন: Toast, Validation, XSS-safe rendering,
// Rate limiting, Simple CAPTCHA, Loading indicator
// ============================================================

/* ---------------- Toast Notification ---------------- */
function showToast(message, type = "info", duration = 3000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message; // textContent => XSS safe, কোনো HTML parse হয় না
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast--show"));

  setTimeout(() => {
    toast.classList.remove("toast--show");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ---------------- Loading Indicator ---------------- */
function showLoader() {
  let loader = document.getElementById("global-loader");
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "global-loader";
    loader.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(loader);
  }
  loader.classList.add("loader--show");
}
function hideLoader() {
  const loader = document.getElementById("global-loader");
  if (loader) loader.classList.remove("loader--show");
}

/* ---------------- XSS-Safe Rendering ---------------- */
// কখনোই ইউজার-ইনপুট সরাসরি innerHTML এ বসাবেন না। এই ফাংশন প্লেইন টেক্সটকে
// escape করে নিরাপদ HTML string রিটার্ন করে (শুধু লাইন-ব্রেক <br> রাখে)।
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
function safeMultilineHTML(str) {
  return escapeHTML(str).replace(/\n/g, "<br>");
}

/* ---------------- Input Validation ---------------- */
function isValidMobile(mobile) {
  // বাংলাদেশি মোবাইল নম্বর ফরম্যাট: 01XXXXXXXXX (11 digits) — প্রয়োজনে পরিবর্তন করুন
  return /^01[0-9]{9}$/.test(mobile.trim());
}
function isValidPassword(password) {
  // কমপক্ষে ৬ ক্যারেক্টার, অন্তত ১টি অক্ষর ও ১টি সংখ্যা
  return /^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(password);
}
function isValidEmail(email) {
  if (!email) return true; // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isValidName(name) {
  return name.trim().length >= 2 && name.trim().length <= 50;
}
function sanitizeMessageText(text) {
  return text.replace(/\s+$/, "").slice(0, 2000); // ম্যাক্স ২০০০ ক্যারেক্টার, ট্রেইলিং স্পেস ছাঁটা
}

/* ---------------- Basic Client-side Rate Limiting ---------------- */
// একটি সাধারণ token-bucket রেট লিমিটার। Spam protection-এর প্রথম স্তর
// (আসল/কঠোর সুরক্ষা সবসময় Firestore Security Rules ও সার্ভার সাইডে হওয়া উচিত)।
class RateLimiter {
  constructor(maxActions, windowMs) {
    this.maxActions = maxActions;
    this.windowMs = windowMs;
    this.timestamps = [];
  }
  tryAction() {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
    if (this.timestamps.length >= this.maxActions) {
      return false;
    }
    this.timestamps.push(now);
    return true;
  }
}
// উদাহরণ: প্রতি ১০ সেকেন্ডে সর্বোচ্চ ৫টি মেসেজ
const messageRateLimiter = new RateLimiter(5, 10000);
// প্রতি ৩০ সেকেন্ডে সর্বোচ্চ ৫টি লগইন চেষ্টা
const loginRateLimiter = new RateLimiter(5, 30000);

/* ---------------- Simple Canvas CAPTCHA ---------------- */
// বাহ্যিক reCAPTCHA site key ছাড়া ব্যবহারযোগ্য একটি হালকা ক্যানভাস-ভিত্তিক CAPTCHA।
// চাইলে পরে গুগল reCAPTCHA v2 দিয়ে প্রতিস্থাপন করা যাবে।
function generateCaptcha(canvasId) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // বিভ্রান্তিকর ক্যারেক্টার বাদ
  let text = "";
  for (let i = 0; i < 5; i++) text += chars[Math.floor(Math.random() * chars.length)];

  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ব্যাকগ্রাউন্ড
  ctx.fillStyle = "#eef2f0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // নয়েজ লাইন
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = `rgba(47,143,110,${Math.random() * 0.4 + 0.1})`;
    ctx.beginPath();
    ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
    ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
    ctx.stroke();
  }

  // টেক্সট
  ctx.font = "bold 26px monospace";
  ctx.textBaseline = "middle";
  for (let i = 0; i < text.length; i++) {
    ctx.save();
    const x = 15 + i * 25;
    const y = canvas.height / 2 + (Math.random() * 8 - 4);
    ctx.translate(x, y);
    ctx.rotate((Math.random() * 30 - 15) * (Math.PI / 180));
    ctx.fillStyle = `hsl(${150 + Math.random() * 40}, 45%, 30%)`;
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }

  canvas.dataset.captcha = text;
  return text;
}
function verifyCaptcha(canvasId, inputValue) {
  const canvas = document.getElementById(canvasId);
  return canvas.dataset.captcha === inputValue.trim().toUpperCase();
}

/* ---------------- Confirm Dialog ---------------- */
function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        <p class="modal__message"></p>
        <div class="modal__actions">
          <button class="btn btn--ghost" data-action="cancel">বাতিল</button>
          <button class="btn btn--danger" data-action="confirm">নিশ্চিত করুন</button>
        </div>
      </div>`;
    overlay.querySelector(".modal__message").textContent = message;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      const action = e.target.dataset.action;
      if (action === "confirm") {
        overlay.remove();
        resolve(true);
      } else if (action === "cancel" || e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
  });
}

/* ---------------- Time Formatting ---------------- */
function formatTimestamp(date) {
  if (!date) return "";
  const now = new Date();
  const d = date instanceof Date ? date : date.toDate();
  const diffMs = now - d;
  const diffMin = diffMs / 60000;

  if (diffMin < 1) return "এইমাত্র";
  if (diffMin < 60) return `${Math.floor(diffMin)} মিনিট আগে`;
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("bn-BD", { day: "numeric", month: "short" }) +
    " " + d.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });
}

/* ---------------- Theme (Light/Dark) ---------------- */
function initTheme() {
  const saved = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
}
initTheme();
