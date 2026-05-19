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

// 🔒 ফায়ারবেস ব্যাকএন্ডের দুটি ইমেইল (যা ফায়ারবেস Authentication-এ খোলা আছে)
const PERSON_ONE_EMAIL = "sanwarhossain2055@gmail.com"; 
const PERSON_TWO_EMAIL = "nightq1181@gmail.com"; 

/* ১. শুধু পাসওয়ার্ড দিয়ে দুইজনের আলাদা লগইন লজিক */
window.loginWithKey = async function() {
  const password = document.getElementById('accessPassword').value.trim();
  if(!password) return alert("দয়া করে সিকিউরিটি পাসওয়ার্ডটি দিন!");

  let targetEmail = "";

  // 🛠️ এখানে আপনি আপনার ইচ্ছামতো পাসওয়ার্ড পরিবর্তন করতে পারেন
  if (password === "553932") {
    targetEmail = PERSON_ONE_EMAIL; // এই পাসওয়ার্ড দিলে ১ নম্বর ব্যক্তি ঢুকবে
  } else if (password === "861155") {
    targetEmail = PERSON_TWO_EMAIL; // এই পাসওয়ার্ড দিলে ২ নম্বর ব্যক্তি ঢুকবে
  } else {
    return alert("ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।");
  }

  try {
    // ব্যাকএন্ডে ইমেইল ও পাসওয়ার্ড দিয়ে অটোমেটিক লগইন হবে
    await signInWithEmailAndPassword(auth, targetEmail, password);
    window.location = 'chat.html';
  } catch (error) {
    alert("লগইন ব্যর্থ হয়েছে! ফায়ারবেসে এই পাসওয়ার্ডটি সেট করা আছে তো? এরর: " + error.message);
  }
}

window.logout = async function() {
  if (currentUserEmail) {
    await updateDoc(doc(db, "users", currentUserEmail), { online: false, typing: false });
  }
  await signOut(auth);
  window.location = 'index.html';
}

/* ২. চ্যাট রুম কানেকশন কন্ট্রোল */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserEmail = user.email;
    
    // ১ নম্বর ব্যক্তি ঢুকলে পার্টনার হবে ২ নম্বর ব্যক্তি, আর ২ নম্বর ঢুকলে পার্টনার হবে ১ নম্বর
    chatPartnerEmail = (currentUserEmail === PERSON_ONE_EMAIL) ? PERSON_TWO_EMAIL : PERSON_ONE_EMAIL;
    
    // হেডার টাইটেল অটোমেটিক সেট হবে
    const titleEl = document.getElementById('chatWithTitle');
    if(titleEl) {
      titleEl.innerText = (chatPartnerEmail === PERSON_ONE_EMAIL) ? "Mohammad Sanwar" : "Mayaboti";
    }

    // দুইজনের জন্য একটি কমন চ্যাট রুম আইডি তৈরি
    chatRoomId = PERSON_ONE_EMAIL < PERSON_TWO_EMAIL 
      ? `${PERSON_ONE_EMAIL.replace(/[.@]/g, '_')}_${PERSON_TWO_EMAIL.replace(/[.@]/g, '_')}`
      : `${PERSON_TWO_EMAIL.replace(/[.@]/g, '_')}_${PERSON_ONE_EMAIL.replace(/[.@]/g, '_')}`;

    await setDoc(doc(db, "users", user.email), { online: true, typing: false }, { merge: true });

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

function listenPartnerStatus() {
  onSnapshot(doc(db, "users", chatPartnerEmail), (snap) => {
    const statusEl = document.getElementById('status');
    if (snap.exists() && statusEl) {
      const data = snap.data();
      statusEl.innerText = data.typing ? "typing..." : (data.online ? "online" : "offline");
    }
  });
}

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
      let reactionHTML = data.reaction ? `<div class="badge-reaction">${data.reaction}</div>` : "";
      let tickStatus = data.seen ? `<span class="seen-blue">✓✓</span>` : `<span>✓✓</span>`;
      if (!isMe) tickStatus = "";

      let timeString = data.time ? data.time.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "";

      div.innerHTML = `
        ${replyHTML}
        <div>${data.text}</div>
        <div class="action-links">
          <span onclick="triggerReply('${data.text}')">Reply</span> | 
          <span onclick="triggerReactionBox('${msgId}')">React</span>
          ${(isMe || currentUserEmail === PERSON_ONE_EMAIL) ? ` | <span style="color:#ef5350" onclick="deleteTargetMsg('${msgId}')">Delete</span>` : ""}
        </div>
        ${reactionHTML}
        <div class="meta-data">${timeString} ${tickStatus}</div>
      `;
      box.appendChild(div);
    });
    
    const mainArea = document.getElementById('messages');
    if(mainArea) mainArea.scrollTop = mainArea.scrollHeight;
  });
}

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
    document.getElementById('typing').innerText = "";
    await updateDoc(doc(db, "users", currentUserEmail), { typing: false });
  } catch (error) {
    alert("মেসেজ পাঠানো যায়নি: " + error.message);
  }
}

let typingTimer;
window.emitTyping = function() {
  updateDoc(doc(db, "users", currentUserEmail), { typing: true });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    updateDoc(doc(db, "users", currentUserEmail), { typing: false });
  }, 1500);
}

window.triggerReply = function(text) { replyText = text; document.getElementById('typing').innerText = "Replying to: " + text; }
window.triggerReactionBox = function(msgId) { currentSelectedMsgId = msgId; document.getElementById('emojiMenu').style.display = 'flex'; }
window.appendEmoji = async function(emoji) { if (currentSelectedMsgId) { await updateDoc(doc(db, 'rooms', chatRoomId, 'messages', currentSelectedMsgId), { reaction: emoji }); } document.getElementById('emojiMenu').style.display = 'none'; }
window.toggleEmojiMenu = function() { const menu = document.getElementById('emojiMenu'); menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex'; }
window.deleteTargetMsg = async function(msgId) { if (confirm("ডিলিট করতে চান?")) await deleteDoc(doc(db, 'rooms', chatRoomId, 'messages', msgId)); }
window.clearAllMessages = async function() { if (confirm("সব মেসেজ মুছে ফেলবেন?")) { const snap = await getDocs(collection(db, 'rooms', chatRoomId, 'messages')); snap.forEach((m) => deleteDoc(doc(db, 'rooms', chatRoomId, 'messages', m.id))); } }
