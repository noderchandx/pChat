// ============================================================
// chat.js
// চ্যাট লিস্ট, ইউজার সার্চ, ওয়ান-টু-ওয়ান কনভার্সেশন, মেসেজ পাঠানো/মুছা,
// রিয়্যাকশন, ব্লকিং — সবকিছুর মূল লজিক এখানে।
// ============================================================

const EMOJI_LIST = ["😀","😁","😂","🤣","😊","😍","😘","😎","🤔","😴","😭","😡",
  "👍","👎","👏","🙏","🔥","🎉","❤️","💔","😢","😮","🥳","🙌","💯","✨","😅","🤗"];
const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

let me = null;
let myProfile = null;
let activePeerId = null;
let activePeerProfile = null;
let messagesUnsub = null;
let chatListUnsub = null;
let blockedByPeer = false;

requireAuth(async (user) => {
  me = user;
  await loadMyProfile();
  listenChatList();
  bindUI();
});

/* ---------------- My Profile ---------------- */
async function loadMyProfile() {
  const doc = await db.collection("users").doc(me.uid).get();
  myProfile = doc.data();
  document.getElementById("myAvatar").src = myProfile.photoURL || "";
}

/* ---------------- Chat List (realtime) ---------------- */
function listenChatList() {
  chatListUnsub = db.collection("chats")
    .where("participants", "array-contains", me.uid)
    .orderBy("lastMessageAt", "desc")
    .onSnapshot(async (snap) => {
      const listEl = document.getElementById("chatList");
      const emptyEl = document.getElementById("chatListEmpty");

      if (snap.empty) {
        listEl.innerHTML = "";
        emptyEl.classList.remove("hidden");
        return;
      }
      emptyEl.classList.add("hidden");

      const rows = await Promise.all(snap.docs.map(async (docSnap) => {
        const chat = docSnap.data();
        const peerId = chat.participants.find((id) => id !== me.uid);
        const peerDoc = await db.collection("users").doc(peerId).get();
        if (!peerDoc.exists) return "";
        const peer = peerDoc.data();
        const unread = (chat.unread && chat.unread[me.uid]) || 0;
        const lastMsg = chat.deleted ? "" : (chat.lastMessage || "");

        return `
          <div class="chat-list-item" data-peer-id="${peerId}">
            <img class="avatar" src="${peer.photoURL || ""}" alt="">
            <div class="chat-list-item__body">
              <div class="chat-list-item__top">
                <span class="chat-list-item__name">${escapeHTML(peer.name)}</span>
                <span class="chat-list-item__time">${chat.lastMessageAt ? formatTimestamp(chat.lastMessageAt) : ""}</span>
              </div>
              <div class="chat-list-item__top">
                <span class="chat-list-item__msg">${escapeHTML(lastMsg) || "কোনো মেসেজ নেই"}</span>
                ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ""}
              </div>
            </div>
          </div>`;
      }));

      listEl.innerHTML = rows.join("");
      listEl.querySelectorAll(".chat-list-item").forEach((el) => {
        el.addEventListener("click", () => openConversation(el.dataset.peerId));
      });
    }, (err) => {
      console.error(err);
      showToast("চ্যাট লিস্ট লোড করতে সমস্যা হয়েছে।", "error");
    });
}

/* ---------------- User Search ---------------- */
let searchTimeout = null;
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("userSearch");
  if (!searchInput) return;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    const q = searchInput.value.trim();
    const resultsEl = document.getElementById("searchResults");
    const listEl = document.getElementById("chatList");
    if (!q) {
      resultsEl.classList.add("hidden");
      listEl.classList.remove("hidden");
      return;
    }
    searchTimeout = setTimeout(() => runUserSearch(q), 350);
  });
});

// +880 / 880 / স্পেস-ড্যাশসহ মোবাইল নম্বরকে "01XXXXXXXXX" ফরম্যাটে normalize করে
function normalizeMobileQuery(raw) {
  let m = raw.replace(/[^0-9+]/g, "");
  if (m.startsWith("+880")) m = "0" + m.slice(4);
  else if (m.startsWith("880")) m = "0" + m.slice(3);
  return m;
}

async function runUserSearch(qRaw) {
  const resultsEl = document.getElementById("searchResults");
  const listEl = document.getElementById("chatList");
  listEl.classList.add("hidden");
  resultsEl.classList.remove("hidden");
  resultsEl.innerHTML = `<div class="center-pad text-muted">খোঁজা হচ্ছে...</div>`;

  try {
    let results = [];
    const mobileQuery = normalizeMobileQuery(qRaw);
    if (/^01[0-9]*$/.test(mobileQuery)) {
      // মোবাইল নম্বর দিয়ে সার্চ (prefix match), +880/880/স্পেস normalize করার পর
      const snap = await db.collection("users")
        .where("mobile", ">=", mobileQuery).where("mobile", "<=", mobileQuery + "\uf8ff").limit(15).get();
      results = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
      // কেস-ইনসেনসিটিভ নাম সার্চের জন্য nameLower ফিল্ড ব্যবহার
      // (সরাসরি "name" ফিল্ডে সার্চ করলে ক্যাপিটাল/স্মল অক্ষর না মিললে ফলাফল আসত না)
      const qLower = qRaw.toLowerCase();
      const snap = await db.collection("users")
        .where("nameLower", ">=", qLower).where("nameLower", "<=", qLower + "\uf8ff").limit(15).get();
      results = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    results = results.filter((u) => u.id !== me.uid && !(myProfile.blocked || []).includes(u.id));

    if (results.length === 0) {
      resultsEl.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔍</div><h3>কেউ পাওয়া যায়নি</h3><p>ভিন্ন নাম বা নম্বর দিয়ে চেষ্টা করুন</p></div>`;
      return;
    }

    resultsEl.innerHTML = results.map((u) => `
      <div class="chat-list-item" data-peer-id="${u.id}">
        <img class="avatar" src="${u.photoURL || ""}" alt="">
        <div class="chat-list-item__body">
          <div class="chat-list-item__name">${escapeHTML(u.name)}</div>
          <div class="chat-list-item__msg">${escapeHTML(u.mobile)}</div>
        </div>
      </div>`).join("");

    resultsEl.querySelectorAll(".chat-list-item").forEach((el) => {
      el.addEventListener("click", () => {
        document.getElementById("userSearch").value = "";
        resultsEl.classList.add("hidden");
        listEl.classList.remove("hidden");
        openConversation(el.dataset.peerId);
      });
    });
  } catch (err) {
    console.error(err);
    resultsEl.innerHTML = `<div class="center-pad text-muted">সার্চ করতে সমস্যা হয়েছে।</div>`;
  }
}

/* ---------------- Chat ID helper ---------------- */
function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

/* ---------------- Open Conversation ---------------- */
async function openConversation(peerId) {
  activePeerId = peerId;
  const peerDoc = await db.collection("users").doc(peerId).get();
  if (!peerDoc.exists) {
    showToast("ইউজার খুঁজে পাওয়া যায়নি।", "error");
    return;
  }
  activePeerProfile = peerDoc.data();
  blockedByPeer = (activePeerProfile.blocked || []).includes(me.uid);

  document.getElementById("noConversationSelected").classList.add("hidden");
  document.getElementById("conversationView").classList.remove("hidden");
  // মোবাইল ভিউতে চ্যাট খোলার সময় লিস্ট লুকানো হয় (single-column নেভিগেশন)
  if (window.innerWidth < 900) {
    document.getElementById("sidebarView").classList.add("hidden");
  }

  document.getElementById("peerAvatar").src = activePeerProfile.photoURL || "";
  document.getElementById("peerName").textContent = activePeerProfile.name;
  updatePeerStatusUI();
  updateBlockButton();

  // পিয়ার প্রোফাইল রিয়েলটাইম আপডেট (অনলাইন স্ট্যাটাস)
  db.collection("users").doc(peerId).onSnapshot((doc) => {
    if (doc.exists) {
      activePeerProfile = doc.data();
      updatePeerStatusUI();
    }
  });

  const chatId = getChatId(me.uid, peerId);

  // চ্যাট ডকুমেন্ট না থাকলে তৈরি করা
  const chatRef = db.collection("chats").doc(chatId);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists) {
    await chatRef.set({
      participants: [me.uid, peerId],
      lastMessage: "",
      lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
      unread: { [me.uid]: 0, [peerId]: 0 },
    });
  }

  // নিজের unread count রিসেট
  chatRef.update({ [`unread.${me.uid}`]: 0 }).catch(() => {});

  if (messagesUnsub) messagesUnsub();
  messagesUnsub = chatRef.collection("messages")
    .orderBy("createdAt", "asc")
    .limit(200)
    .onSnapshot((snap) => renderMessages(snap, chatRef), (err) => {
      console.error(err);
      showToast("মেসেজ লোড করতে সমস্যা হয়েছে।", "error");
    });
}

function updatePeerStatusUI() {
  const dot = document.getElementById("peerStatusDot");
  const text = document.getElementById("peerStatusText");
  if (activePeerProfile.status === "online") {
    dot.classList.add("status-dot--online");
    text.textContent = "অনলাইন";
  } else {
    dot.classList.remove("status-dot--online");
    text.textContent = activePeerProfile.lastSeen
      ? `সর্বশেষ দেখা ${formatTimestamp(activePeerProfile.lastSeen)}`
      : "অফলাইন";
  }
}

function updateBlockButton() {
  const isBlocked = (myProfile.blocked || []).includes(activePeerId);
  document.getElementById("blockBtn").textContent = isBlocked ? "✅" : "⛔";
  document.getElementById("blockBtn").title = isBlocked ? "আনব্লক করুন" : "ব্লক করুন";
}

/* ---------------- Render Messages ---------------- */
function renderMessages(snap, chatRef) {
  const container = document.getElementById("messages");
  const emptyEl = document.getElementById("conversationEmpty");

  if (snap.empty) {
    container.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  const batchSeen = db.batch();
  let hasSeenUpdates = false;

  container.innerHTML = snap.docs.map((docSnap) => {
    const msg = docSnap.data();
    const id = docSnap.id;
    const isMe = msg.senderId === me.uid;

    // পিয়ারের পাঠানো মেসেজ দেখলে "seen" মার্ক করা
    if (!isMe && msg.status !== "seen" && !msg.deleted) {
      batchSeen.update(chatRef.collection("messages").doc(id), { status: "seen" });
      hasSeenUpdates = true;
    }

    let bodyHTML = "";
    if (msg.deleted) {
      bodyHTML = `<div class="bubble__body bubble--deleted">এই মেসেজটি মুছে ফেলা হয়েছে</div>`;
    } else if (msg.type === "image") {
      bodyHTML = `<img class="msg-image" src="${msg.imageURL}" alt="ছবি" data-full="${msg.imageURL}">`;
      if (msg.text) bodyHTML += `<div class="bubble__body">${safeMultilineHTML(msg.text)}</div>`;
    } else {
      bodyHTML = `<div class="bubble__body">${safeMultilineHTML(msg.text)}</div>`;
    }

    const reactions = msg.reactions ? Object.values(msg.reactions) : [];
    const reactionCounts = {};
    reactions.forEach((r) => { reactionCounts[r] = (reactionCounts[r] || 0) + 1; });
    const reactionHTML = reactions.length
      ? `<div class="bubble__reactions">${Object.entries(reactionCounts).map(([e, c]) => `${e}${c > 1 ? c : ""}`).join(" ")}</div>`
      : "";

    let statusIcon = "";
    if (isMe && !msg.deleted) {
      statusIcon = msg.status === "seen" ? "✓✓" : msg.status === "delivered" ? "✓✓" : "✓";
    }

    return `
      <div class="msg-row ${isMe ? "msg-row--me" : "msg-row--them"}" data-msg-id="${id}" data-deleted="${!!msg.deleted}" data-is-me="${isMe}">
        <div class="bubble">
          ${bodyHTML}
          <div class="bubble__meta">
            <span>${msg.createdAt ? formatTimestamp(msg.createdAt) : ""}</span>
            <span>${statusIcon}</span>
          </div>
          ${reactionHTML}
        </div>
      </div>`;
  }).join("");

  if (hasSeenUpdates) batchSeen.commit().catch(() => {});

  // image click => full preview
  container.querySelectorAll(".msg-image").forEach((img) => {
    img.addEventListener("click", () => showImagePreview(img.dataset.full));
  });

  // long-press / click => reaction picker + delete (own messages)
  container.querySelectorAll(".msg-row").forEach((row) => {
    if (row.dataset.deleted === "true") return;
    let pressTimer;
    const open = () => openMessageActions(row, chatRef);
    row.addEventListener("mousedown", () => { pressTimer = setTimeout(open, 450); });
    row.addEventListener("mouseup", () => clearTimeout(pressTimer));
    row.addEventListener("mouseleave", () => clearTimeout(pressTimer));
    row.addEventListener("touchstart", () => { pressTimer = setTimeout(open, 450); }, { passive: true });
    row.addEventListener("touchend", () => clearTimeout(pressTimer));
  });

  container.scrollTop = container.scrollHeight; // Auto scroll to latest
}

/* ---------------- Message Actions: React / Delete ---------------- */
function openMessageActions(row, chatRef) {
  document.querySelectorAll(".reaction-picker").forEach((p) => p.remove());
  const msgId = row.dataset.msgId;
  const isMe = row.dataset.isMe === "true";

  const picker = document.createElement("div");
  picker.className = "reaction-picker";
  picker.innerHTML = REACTIONS.map((r) => `<span data-emoji="${r}">${r}</span>`).join("") +
    (isMe ? `<span data-action="delete">🗑️</span>` : "");

  const bubble = row.querySelector(".bubble");
  bubble.appendChild(picker);

  picker.addEventListener("click", async (e) => {
    const emoji = e.target.dataset.emoji;
    const action = e.target.dataset.action;
    picker.remove();

    if (emoji) {
      await chatRef.collection("messages").doc(msgId).update({
        [`reactions.${me.uid}`]: emoji,
      });
    } else if (action === "delete") {
      const ok = await confirmDialog("আপনি কি এই মেসেজটি মুছে ফেলতে চান? এটি ফিরিয়ে আনা যাবে না।");
      if (ok) {
        await chatRef.collection("messages").doc(msgId).update({
          deleted: true,
          text: "",
          imageURL: null,
        });
        showToast("মেসেজ মুছে ফেলা হয়েছে।", "success");
      }
    }
  });

  setTimeout(() => document.addEventListener("click", function handler(ev) {
    if (!picker.contains(ev.target)) {
      picker.remove();
      document.removeEventListener("click", handler);
    }
  }), 10);
}

/* ---------------- Image Preview Modal ---------------- */
function showImagePreview(url) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<img class="image-viewer" src="${url}" alt="প্রিভিউ">`;
  overlay.addEventListener("click", () => overlay.remove());
  document.body.appendChild(overlay);
}

/* ---------------- Send Message ---------------- */
async function sendTextMessage() {
  const input = document.getElementById("messageInput");
  const text = sanitizeMessageText(input.value);
  if (!text) return;
  if (!activePeerId) return;

  if (blockedByPeer) {
    showToast("এই ইউজার আপনাকে ব্লক করেছেন, মেসেজ পাঠানো যাবে না।", "error");
    return;
  }
  if ((myProfile.blocked || []).includes(activePeerId)) {
    showToast("আপনি এই ইউজারকে ব্লক করেছেন। মেসেজ পাঠাতে আনব্লক করুন।", "error");
    return;
  }
  if (!messageRateLimiter.tryAction()) {
    showToast("খুব দ্রুত মেসেজ পাঠাচ্ছেন। একটু ধীরে চেষ্টা করুন।", "error");
    return;
  }

  input.value = "";
  autoResizeTextarea(input);

  const chatId = getChatId(me.uid, activePeerId);
  const chatRef = db.collection("chats").doc(chatId);

  try {
    await chatRef.collection("messages").add({
      senderId: me.uid,
      type: "text",
      text,
      imageURL: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: "sent",
      reactions: {},
      deleted: false,
    });
    await chatRef.update({
      lastMessage: text,
      lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
      [`unread.${activePeerId}`]: firebase.firestore.FieldValue.increment(1),
    });
  } catch (err) {
    console.error(err);
    showToast("মেসেজ পাঠাতে সমস্যা হয়েছে।", "error");
  }
}

async function sendImageMessage(file) {
  if (!activePeerId) return;
  if (!file.type.startsWith("image/")) {
    showToast("শুধু ছবি ফাইল পাঠানো যাবে।", "error");
    return;
  }
  if (file.size > 6 * 1024 * 1024) {
    showToast("ছবির সাইজ ৬MB এর কম হতে হবে।", "error");
    return;
  }
  if (blockedByPeer || (myProfile.blocked || []).includes(activePeerId)) {
    showToast("এই ইউজারের সাথে মেসেজ আদান-প্রদান সম্ভব নয়।", "error");
    return;
  }

  showLoader();
  try {
    const chatId = getChatId(me.uid, activePeerId);
    const chatRef = db.collection("chats").doc(chatId);
    const imageURL = await uploadImageToCloudinary(file, `chatImages/${chatId}`);

    await chatRef.collection("messages").add({
      senderId: me.uid,
      type: "image",
      text: "",
      imageURL,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: "sent",
      reactions: {},
      deleted: false,
    });
    await chatRef.update({
      lastMessage: "📷 ছবি",
      lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
      [`unread.${activePeerId}`]: firebase.firestore.FieldValue.increment(1),
    });
  } catch (err) {
    console.error(err);
    showToast("ছবি পাঠাতে সমস্যা হয়েছে।", "error");
  } finally {
    hideLoader();
  }
}

/* ---------------- Block / Unblock ---------------- */
async function toggleBlock() {
  const isBlocked = (myProfile.blocked || []).includes(activePeerId);
  const ok = await confirmDialog(isBlocked ? "এই ইউজারকে আনব্লক করতে চান?" : "এই ইউজারকে ব্লক করতে চান? তিনি আর আপনাকে মেসেজ পাঠাতে পারবেন না।");
  if (!ok) return;

  try {
    await db.collection("users").doc(me.uid).update({
      blocked: isBlocked
        ? firebase.firestore.FieldValue.arrayRemove(activePeerId)
        : firebase.firestore.FieldValue.arrayUnion(activePeerId),
    });
    myProfile.blocked = myProfile.blocked || [];
    if (isBlocked) {
      myProfile.blocked = myProfile.blocked.filter((id) => id !== activePeerId);
    } else {
      myProfile.blocked.push(activePeerId);
    }
    updateBlockButton();
    showToast(isBlocked ? "আনব্লক করা হয়েছে।" : "ব্লক করা হয়েছে।", "success");
  } catch (err) {
    console.error(err);
    showToast("অপারেশন ব্যর্থ হয়েছে।", "error");
  }
}

/* ---------------- UI Bindings ---------------- */
function autoResizeTextarea(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 100) + "px";
}

function bindUI() {
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    const ok = await confirmDialog("আপনি কি লগআউট করতে চান?");
    if (ok) logoutUser();
  });

  document.getElementById("themeToggleBtn").addEventListener("click", toggleTheme);

  document.getElementById("backBtn").addEventListener("click", () => {
    document.getElementById("conversationView").classList.add("hidden");
    document.getElementById("sidebarView").classList.remove("hidden");
    document.getElementById("noConversationSelected").classList.remove("hidden");
    if (messagesUnsub) { messagesUnsub(); messagesUnsub = null; }
    activePeerId = null;
  });

  document.getElementById("blockBtn").addEventListener("click", toggleBlock);

  const messageInput = document.getElementById("messageInput");
  messageInput.addEventListener("input", () => autoResizeTextarea(messageInput));
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  });
  document.getElementById("sendBtn").addEventListener("click", sendTextMessage);

  document.getElementById("imageBtn").addEventListener("click", () => {
    document.getElementById("imageInput").click();
  });
  document.getElementById("imageInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) sendImageMessage(file);
    e.target.value = "";
  });

  const emojiPanel = document.getElementById("emojiPanel");
  emojiPanel.innerHTML = EMOJI_LIST.map((e) => `<span>${e}</span>`).join("");
  emojiPanel.addEventListener("click", (e) => {
    if (e.target.tagName === "SPAN") {
      messageInput.value += e.target.textContent;
      autoResizeTextarea(messageInput);
    }
  });
  document.getElementById("emojiBtn").addEventListener("click", () => {
    emojiPanel.classList.toggle("hidden");
  });
}
