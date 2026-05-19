import {
  auth, db,
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, setDoc
} from './firebase.js';
import { getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUserEmail = null;
let chatPartnerEmail = null;
let chatRoomId = null;
let replyText = "";
let currentSelectedMsgId = null;

// সিস্টেমে রেজিস্টার্ড ইমেইল দুটি ফিক্সড ব্যাকএন্ডে থাকবে
const ADMIN_EMAIL = "sanwarhossain2055@gmail.com"; 
const USER_EMAIL = "nightq1181@gmail.com"; 

/* ---------------- ১. পাসওয়ার্ড-অনলি লগইন সিস্টেম ---------------- */
window.loginWithKey = async function() {
  const password = document.getElementById('accessPassword').value.trim();
  if(!password) return alert("দয়া করে সিকিউরিটি পাসওয়ার্ডটি দিন!");

  let targetEmail = "";
  
  // পাসওয়ার্ডের ভিত্তিতে অটো ইউজার ডিটেকশন
  if (password === "553932") {
    targetEmail = ADMIN_EMAIL;
  } else if (password === "861155") {
    targetEmail = USER_EMAIL;
  } else {
    return alert("ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।");
  }

  try {
    // ব্যাকএন্ডে অটো সাইন ইন হবে (পাসওয়ার্ডটি অবশ্যই ফায়ারবেস অথেন্টিকেশনে সেট থাকতে হবে)
    await signInWithEmailAndPassword(auth, targetEmail, password);
    window.location = 'chat.html';
  } catch (error) {
    alert("লগইন ব্যর্থ: ফায়ারবেস প্যানেলে এই পাসওয়ার্ড সেট আছে কি না নিশ্চিত করুন। " + error.message);
  }
}

window.logout = async function() {
  if (currentUserEmail) {
    await updateDoc(doc(db, "users", currentUserEmail), { online: false, typing: false });
  }
  await signOut(auth);
  window.location = 'index.html';
}

/* ---------------- ২. ব্যাকগ্রাউন্ড বা মিনিমাইজ প্রোটেকশন ---------------- */
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "hidden" && auth.currentUser) {
    if (currentUserEmail) {
      await updateDoc(doc(db, "users", currentUserEmail), { online: false, typing: false });
    }
    await signOut(auth);
    window.location = 'index.html';
  }
});

/* ---------------- ৩. সেশন এবং রুম মেকিং ---------------- */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserEmail = user.email;
    chatPartnerEmail = (currentUserEmail === ADMIN_EMAIL) ? USER_EMAIL : ADMIN_EMAIL;
    
    const titleEl = document.getElementById('chatWithTitle');
    if(titleEl) {
      titleEl.innerText = (chatPartnerEmail === ADMIN_EMAIL) ? "Mohammad" : "Mayaboti";
    }

    const avatarEl = document.querySelector('.avatar-wa');
    if(avatarEl) avatarEl.innerText = chatPartnerEmail.charAt(0).toUpperCase();

    chatRoomId = currentUserEmail < chatPartnerEmail 
      ? `${currentUserEmail.replace(/[.@]/g, '_')}_${chatPartnerEmail.replace(/[.@]/g, '_')}`
      : `${chatPartnerEmail.replace(/[.@]/g, '_')}_${currentUserEmail.replace(/[.@]/g, '_')}`;

    await setDoc(doc(db, "users", user.email), { online: true, typing: false, lastSeen: Date.now() }, { merge: true });

    if(window.location.pathname.includes('chat.html')) {
      listenPartnerStatus();
      loadPrivateChatMessages();
    }
  } else {
    if(window.location.pathname.includes('chat.html')) {
      window.location = 'index.html';
    }
  }
});

/* ---------------- ৪. অনলাইন ও টাইপিং লাইভ লিসেনার ---------------- */
function listenPartnerStatus() {
  onSnapshot(doc(db, "users", chatPartnerEmail), (snap) => {
    const statusEl = document.getElementById('status');
    const typingIndicatorEl = document.getElementById('typing'); 
    if (snap.exists()) {
      const data = snap.data();
      if (data.typing) {
        if (statusEl) statusEl.innerText = "typing...";
        if (typingIndicatorEl) typingIndicatorEl.innerText = "typing...";
      } else if (data.online) {
        if (statusEl) statusEl.innerText = "online";
        if (typingIndicatorEl) typingIndicatorEl.innerText = "";
      } else {
        if (statusEl) statusEl.innerText = "offline";
        if (typingIndicatorEl) typingIndicatorEl.innerText = "";
      }
    }
  });
}

/* ---------------- ৫. মেসেজ লোড ও অটো-স্ক্রোল ---------------- */
function loadPrivateChatMessages() {
  if (!chatRoomId) return;
  const q = query(collection(db, 'rooms', chatRoomId, 'messages'), orderBy('time'));
  
  onSnapshot(q, (snap) => {
    const box = document.getElementById('actualMessages');
    if (!box) return;
    box.innerHTML = "";

    snap.forEach((d) => {
      const data = d.data();
      const msgId = d.id;

      if (data.sender !== currentUserEmail && !data.seen) {
        updateDoc(doc(db, 'rooms', chatRoomId, 'messages', msgId), { seen: true });
      }

      let div = document.createElement('div');
      const isMe = data.sender === currentUserEmail;
      div.className = isMe ? "message me" : "message other";

      let replyHTML = data.reply ? `<div class="inside-reply">↪ ${data.reply}</div>` : "";
      let reactionHTML = data.reaction ? `<div class="badge-reaction" onclick="removeReaction('${msgId}')">${data.reaction}</div>` : "";
      
      let formattedText = data.text || "";
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      formattedText = formattedText.replace(urlRegex, (url) => `<a href="${url}" target="_blank" style="color: #53bdeb; text-decoration: underline;">${url}</a>`);

      let tickStatus = data.seen ? `<span class="seen-blue">✓✓</span>` : `<span style="color:#8696a0;">✓✓</span>`;
      if (!isMe) tickStatus = "";

      let timeString = "";
      if(data.time) {
        timeString = data.time.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      }

      let isAdmin = currentUserEmail === ADMIN_EMAIL;
      let actionControlHTML = `
        <div class="action-links">
          <span onclick="triggerReply('${data.text ? data.text.replace(/'/g, "\\'") : 'মেসেজ'}')">Reply</span> | 
          <span onclick="triggerReactionBox('${msgId}')">React</span>
          ${(isMe || isAdmin) ? ` | <span class="del-admin" onclick="deleteTargetMsg('${msgId}')">Delete</span>` : ""}
        </div>
      `;

      div.innerHTML = `${replyHTML}<div>${formattedText}</div>${actionControlHTML}${reactionHTML}<div class="meta-data">${timeString} ${tickStatus}</div>`;
      box.appendChild(div);
    });
    
    // নিখুঁত অটো স্ক্রোল লজিক
    const mainArea = document.getElementById('messages');
    if(mainArea) mainArea.scrollTop = mainArea.scrollHeight;
  });
}

/* ---------------- ৬. মেসেজ পাঠানো ---------------- */
window.sendMessage = async function() {
  const input = document.getElementById('messageInput');
  const messageText = input.value.trim();
  if (!messageText || !chatRoomId) return;

  try {
    await addDoc(collection(db, 'rooms', chatRoomId, 'messages'), {
      text: messageText,
      sender: currentUserEmail,
      reply: replyText || "",
      seen: false,
      time: serverTimestamp()
    });
    input.value = "";
    replyText = "";
    await updateDoc(doc(db, "users", currentUserEmail), { typing: false });
  } catch (error) {
    alert("মেসেজ পাঠানো যায়নি: " + error.message);
  }
}

/* ---------------- ৭. টাইপিং মেকানিজম ---------------- */
let typingDelayTimer;
window.emitTyping = function() {
  if (!currentUserEmail) return;
  updateDoc(doc(db, "users", currentUserEmail), { typing: true });
  clearTimeout(typingDelayTimer);
  typingDelayTimer = setTimeout(() => {
    updateDoc(doc(db, "users", currentUserEmail), { typing: false });
  }, 1500); 
}

/* ---------------- ৮. রিয়্যাকশন ও ইমোজি ---------------- */
window.triggerReply = function(text) {
  replyText = text;
  document.getElementById('typing').innerText = "Replying to: " + text;
}
window.triggerReactionBox = function(msgId) {
  currentSelectedMsgId = msgId;
  document.getElementById('emojiMenu').style.display = 'flex';
}
window.appendEmoji = async function(emoji) {
  if (currentSelectedMsgId) {
    await updateDoc(doc(db, 'rooms', chatRoomId, 'messages', currentSelectedMsgId), { reaction: emoji });
  }
  document.getElementById('emojiMenu').style.display = 'none';
}
window.removeReaction = async function(msgId) {
  await updateDoc(doc(db, 'rooms', chatRoomId, 'messages', msgId), { reaction: "" });
}
window.toggleEmojiMenu = function() {
  const menu = document.getElementById('emojiMenu');
  menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
}

/* ---------------- ৯. ডিলিট এবং ক্লিয়ার অল ---------------- */
window.deleteTargetMsg = async function(msgId) {
  if (confirm("মেসেজটি সবার জন্য ডিলিট করতে চান?")) {
    await deleteDoc(doc(db, 'rooms', chatRoomId, 'messages', msgId));
  }
}
window.clearAllMessages = async function() {
  if (confirm("সমস্ত মেসেজ ডিলিট করতে চান?")) {
    const snap = await getDocs(collection(db, 'rooms', chatRoomId, 'messages'));
    snap.forEach((msgDoc) => deleteDoc(doc(db, 'rooms', chatRoomId, 'messages', msgDoc.id)));
  }
}

/* ---------------- ১০. কিবোর্ড ফিক্স এবং এন্টার সেন্ড লজিক ---------------- */
const inputField = document.getElementById('messageInput');
if(inputField) {
  inputField.addEventListener('focus', () => {
    setTimeout(() => {
      const mainArea = document.getElementById('messages');
      if(mainArea) mainArea.scrollTop = mainArea.scrollHeight;
    }, 120); // কিবোর্ড পপআপ টাইমিং সেট
  });
  inputField.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') sendMessage();
  });
}
