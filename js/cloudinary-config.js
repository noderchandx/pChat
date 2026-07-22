// ============================================================
// cloudinary-config.js
// ------------------------------------------------------------
// Firebase Storage-এর বদলে Cloudinary ব্যবহার করা হচ্ছে (ফ্রি, কোনো
// কার্ড/বিলিং লাগে না)। শুধু ছবি আপলোডের জন্য এটি ব্যবহৃত হয়;
// Auth ও Firestore আগের মতোই Firebase দিয়ে চলবে।
//
// সেটআপ (একবারই করতে হবে):
// ১. https://cloudinary.com এ ফ্রি অ্যাকাউন্ট খুলুন (কোনো কার্ড লাগবে না)।
// ২. Console → Dashboard থেকে আপনার "Cloud name" কপি করুন।
// ৩. Console → Settings (⚙️) → Upload → "Upload presets" →
//    "Add upload preset" ক্লিক করুন।
//    - Signing Mode: "Unsigned" সিলেক্ট করুন (এটি জরুরি — client-side
//      থেকে সরাসরি আপলোডের জন্য দরকার, কোনো secret key এক্সপোজ হয় না)।
//    - প্রিসেটের নামটি নোট করে রাখুন (নিচে বসাতে হবে)।
// ৪. নিচের দুইটা ভ্যালু পূরণ করুন।
// ============================================================

const CLOUDINARY_CLOUD_NAME = "rzfqcddu";
const CLOUDINARY_UPLOAD_PRESET = "pChat7";

/**
 * Cloudinary-তে একটি ছবি আপলোড করে তার পাবলিক URL রিটার্ন করে।
 * @param {File} file - আপলোড করার ছবি ফাইল
 * @param {string} folder - Cloudinary-তে ফোল্ডার পাথ (যেমন "avatars/uid123")
 * @returns {Promise<string>} secure_url
 */
async function uploadImageToCloudinary(file, folder) {
  if (CLOUDINARY_CLOUD_NAME === "YOUR_CLOUD_NAME") {
    throw new Error("Cloudinary কনফিগার করা হয়নি — js/cloudinary-config.js ফাইলে cloud name ও upload preset বসান।");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  if (folder) formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || "ছবি আপলোড ব্যর্থ হয়েছে।");
  }

  const data = await res.json();
  return data.secure_url;
}
