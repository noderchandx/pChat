# পার্সোনাল চ্যাট ওয়েব অ্যাপ

Vanilla HTML/CSS/JS + Firebase (Auth, Firestore, Storage) দিয়ে তৈরি একটি
সিম্পল, নিরাপদ, রেসপনসিভ ওয়ান-টু-ওয়ান চ্যাট অ্যাপ। কোনো build step লাগে না,
তাই সরাসরি GitHub Pages-এ হোস্ট করা যায়।

## ফোল্ডার স্ট্রাকচার

```
chat-app/
├── index.html          # লগইন স্টেট চেক করে redirect করে
├── login.html
├── signup.html
├── chat.html            # চ্যাট লিস্ট + কনভার্সেশন
├── profile.html
├── firestore.rules       # Firestore Security Rules
├── storage.rules         # Storage Security Rules
├── css/
│   └── style.css
└── js/
    ├── firebase-config.js   # 🔑 এখানে আপনার Firebase কনফিগ বসাতে হবে
    ├── utils.js              # Toast, validation, XSS-safe render, captcha, rate-limit
    ├── auth.js               # Auth guard, inactivity auto-logout, presence
    ├── signup.js
    ├── login.js
    ├── chat.js
    └── profile.js
```

## ধাপ ১ — Firebase প্রজেক্ট তৈরি

1. https://console.firebase.google.com → **Add project**
2. **Build → Authentication → Get started → Sign-in method** থেকে
   **Email/Password** প্রোভাইডার চালু করুন (আমরা মোবাইল নম্বরকে
   `<mobile>@chatapp.local` ফরম্যাটে ইমেইলে রূপান্তর করে ব্যবহার করছি,
   যেহেতু আসল OTP-ভিত্তিক Phone Auth চাওয়া হয়নি)।
3. **Build → Firestore Database → Create database** (production mode)।
   Auth ও Firestore দুটোই Firebase-এর ফ্রি (Spark) প্ল্যানে চলে, কোনো
   কার্ড লাগে না।
4. **Project settings → General → Your apps → Web app (</> আইকন)** থেকে
   Firebase config অবজেক্টটি কপি করুন এবং `js/firebase-config.js` ফাইলে বসান।

> 📌 এই অ্যাপে **Firebase Storage ব্যবহার করা হচ্ছে না** — ফেব্রুয়ারি ২০২৬
> থেকে Firebase Storage ব্যবহার করতে বাধ্যতামূলক Blaze (billing) প্ল্যান
> লাগে, যেখানে কার্ড লিংক করতে হয়। তার বদলে ছবি আপলোডের জন্য **Cloudinary**
> ব্যবহার করা হয়েছে, যা সম্পূর্ণ ফ্রি এবং কোনো কার্ড লাগে না।

## ধাপ ২ — Cloudinary সেটআপ (ছবি আপলোডের জন্য)

1. https://cloudinary.com → **Sign up for free** (Google/GitHub/Email দিয়ে,
   কোনো কার্ড লাগবে না)।
2. লগইন করার পর Dashboard-এর উপরের দিকে আপনার **Cloud name** দেখতে পাবেন —
   সেটা কপি করুন।
3. বাম পাশের মেনু থেকে **Settings (⚙️) → Upload** ট্যাবে যান।
4. **Upload presets → Add upload preset** ক্লিক করুন।
   - **Signing Mode**: অবশ্যই **Unsigned** সিলেক্ট করুন (এতে কোনো secret
     key ব্রাউজারে এক্সপোজ হয় না, নিরাপদে ক্লায়েন্ট থেকে সরাসরি আপলোড
     করা যায়)।
   - প্রিসেট Save করার পর তার নামটি (যেমন `ml_default` বা আপনার দেওয়া নাম)
     নোট করুন।
5. `js/cloudinary-config.js` ফাইল খুলে `CLOUDINARY_CLOUD_NAME` ও
   `CLOUDINARY_UPLOAD_PRESET` এর জায়গায় আপনার মান বসান।

## ধাপ ৩ — Security Rules প্রকাশ করুন

- Firestore Rules ট্যাবে `firestore.rules`-এর কনটেন্ট পেস্ট করে **Publish** করুন।
- `storage.rules` ফাইলটি এখন ব্যবহার হচ্ছে না (Cloudinary ব্যবহারের কারণে) —
  ভবিষ্যতে Blaze-এ আপগ্রেড করে Firebase Storage-এ ফিরতে চাইলে তখন এটি
  প্রয়োজন হবে।

## ধাপ ৪ — প্রয়োজনীয় Firestore Index

চ্যাট লিস্ট রিয়েলটাইম লোড করার কোয়েরি (`participants array-contains` +
`orderBy lastMessageAt`) একটি Composite Index চায়। প্রথমবার অ্যাপ চালানোর
সময় Firestore কনসোলে এরর মেসেজে একটি ডাইরেক্ট লিংক আসবে — সেই লিংকে ক্লিক
করলেই ইনডেক্স স্বয়ংক্রিয়ভাবে তৈরি হয়ে যাবে (তৈরি হতে ১-২ মিনিট সময় লাগতে
পারে)।

## ধাপ ৫ — লোকালি টেস্ট করা

কোনো build tool দরকার নেই। যেকোনো static server দিয়ে চালান, উদাহরণ:

```bash
cd chat-app
python3 -m http.server 8080
# ব্রাউজারে http://localhost:8080 খুলুন
```

## ধাপ ৬ — GitHub Pages-এ Deploy

```bash
git init
git add .
git commit -m "Initial commit: personal chat app"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

তারপর GitHub রিপোর **Settings → Pages → Source → Deploy from branch →
main / (root)** সিলেক্ট করুন। কিছুক্ষণ পর
`https://<your-username>.github.io/<repo-name>/` লিংকে অ্যাপ লাইভ হয়ে যাবে।

> ⚠️ Firebase Console → Authentication → Settings → **Authorized domains**-এ
> আপনার GitHub Pages ডোমেইন (`<your-username>.github.io`) যোগ করতে ভুলবেন না,
> নাহলে লগইন/সাইনআপ ব্লক হয়ে যাবে।

## নিরাপত্তা সংক্রান্ত নোট

- **পাসওয়ার্ড হ্যাশিং**: Firebase Authentication নিজেই সব পাসওয়ার্ড
  hash/salt করে সংরক্ষণ করে (আমরা কখনও প্লেইনটেক্সট পাসওয়ার্ড নিজেদের
  ডাটাবেজে রাখি না)।
- **XSS Protection**: সব ইউজার-জেনারেটেড টেক্সট (নাম, মেসেজ ইত্যাদি) `textContent`
  ভিত্তিক `escapeHTML()`/`safeMultilineHTML()` দিয়ে রেন্ডার করা হয়, কখনো সরাসরি
  raw ইনপুট `innerHTML`-এ বসানো হয় না।
- **Rate Limiting**: ক্লায়েন্ট সাইডে বেসিক রেট লিমিটার আছে (মেসেজ স্প্যাম ও
  লগইন ব্রুট-ফোর্স রোধে)। প্রোডাকশনে আরও কড়া সুরক্ষার জন্য Firebase App
  Check ও Cloud Functions-ভিত্তিক সার্ভার-সাইড রেট লিমিট যোগ করার পরামর্শ
  থাকলো।
- **Firestore Rules**: প্রকৃত অ্যাক্সেস কন্ট্রোল `firestore.rules`-এই
  প্রয়োগ করা হয়েছে — ক্লায়েন্ট কোড শুধু UX-এর জন্য।
- **Cloudinary Upload**: unsigned upload preset ব্যবহার করা হয়েছে বলে কোনো
  secret key ব্রাউজারে এক্সপোজ হয় না। চাইলে Cloudinary Console →
  Upload presets-এ গিয়ে ফাইল সাইজ/ফরম্যাট সীমাবদ্ধতা আরও কড়া করতে পারবেন।
- **CAPTCHA**: সাইনআপ ফর্মে বট প্রতিরোধে একটি সাধারণ ক্যানভাস-ভিত্তিক
  CAPTCHA যুক্ত করা হয়েছে (কোনো external API key দরকার নেই)। চাইলে পরে Google
  reCAPTCHA v2/v3 দিয়ে প্রতিস্থাপন করা যাবে।

## মূল ফিচার সারসংক্ষেপ

| ফিচার | অবস্থা |
|---|---|
| মোবাইল+পাসওয়ার্ড সাইনআপ/লগইন | ✅ |
| বাধ্যতামূলক প্রোফাইল ছবি | ✅ |
| সাইনআপ CAPTCHA | ✅ |
| ৩ মিনিট নিষ্ক্রিয়তায় অটো-লগআউট | ✅ |
| ওয়ান-টু-ওয়ান টেক্সট/ইমেজ চ্যাট | ✅ |
| ইমোজি পিকার ও রিয়্যাকশন | ✅ |
| Seen/Delivered স্ট্যাটাস | ✅ |
| আনরিড কাউন্ট, ইউজার সার্চ | ✅ |
| অনলাইন/অফলাইন + Last Seen | ✅ |
| প্রোফাইল এডিট, পাসওয়ার্ড পরিবর্তন | ✅ |
| ইউজার ব্লক/আনব্লক | ✅ |
| নিজের মেসেজ ডিলিট (কনফার্মেশনসহ) | ✅ |
| লাইট/ডার্ক মোড | ✅ |
| Toast, Loader, Empty State | ✅ |

## জানা সীমাবদ্ধতা / ভবিষ্যৎ উন্নতি

- Presence (অনলাইন/অফলাইন) Firestore দিয়ে করা হয়েছে (best-effort) — একদম
  রিয়েল-টাইম নিখুঁত presence-এর জন্য Firebase **Realtime Database** এর
  `onDisconnect()` ব্যবহার করা আরও নির্ভরযোগ্য।
- Delivered vs Seen — বর্তমানে সরলীকৃত (রিসিভার conversation ওপেন করলেই
  seen মার্ক হয়)।
- Group chat নেই — শুধুমাত্র One-to-One।
