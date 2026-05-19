import {
  auth, db, storage,
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, setDoc
} from './firebase.js';
import { getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUserEmail = null;
let chatPartnerEmail = null;
let chatRoomId = null;
let replyText = "";
let currentSelectedMsgId = null;

// আপনার চ্যাটের দুটি নির্দিষ্ট ইমেইল আইডি
const ADMIN_EMAIL = "sanwarhossain2055@gmail.com"; 
const USER_EMAIL = "nightq1181@gmail.com"; 

/* ---------------- ১. লগইন এবং সেশন কন্ট্রোল ---------------- */
window.login = async function() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if(!email || !password) return alert("সবগুলো ঘর ঠিকঠাক পূরণ করুন!");

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location = 'chat.html';
  } catch (error) {
    alert("লগইন ব্যর্থ হয়েছে: " + error.message);
  }
}

window.logout = async function() {
  if (currentUserEmail) {
    await updateDoc(doc(db, "users", currentUserEmail), { online: false, typing: false });
  }
  await signOut(auth);
  window.location = 'index.html';
}

/* ---------------- ২. Minimize বা ব্যাকগ্রাউন্ডে গেলে অটো লগআউট ---------------- */
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "hidden" && auth.currentUser) {
    if (currentUserEmail) {
      await updateDoc(doc(db, "users", currentUserEmail), { online: false, typing: false });
    }
    await signOut(auth);
    window.location = 'index.html';
  }
});

/* ---------------- ৩. অটো চ্যাট রুম ডিটেকশন ও প্রোফাইল সেটআপ ---------------- */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserEmail = user.email;
    chatPartnerEmail = (currentUserEmail === ADMIN_EMAIL) ? USER_EMAIL : ADMIN_EMAIL;
    
    // হেডারে চ্যাট পার্টনারের নাম (ইমেইলের প্রথম অংশ) সেট করা
    const titleEl = document.getElementById('chatWithTitle');
    if(titleEl) {
      if (chatPartnerEmail === ADMIN_EMAIL) {
        titleEl.innerText = "Mohammad Sanwar";
      } else {
        titleEl.innerText = "sanwar Gp";
      }
    }

    // প্রোফাইল আইকনে নামের প্রথম অক্ষর দেওয়া
    const avatarEl = document.querySelector('.avatar-wa');
    if(avatarEl) avatarEl.innerText = chatPartnerEmail.charAt(0).toUpperCase();

    // ইউনিক চ্যাট রুম আইডি তৈরি
    chatRoomId = currentUserEmail < chatPartnerEmail 
      ? `${currentUserEmail.replace(/[.@]/g, '_')}_${chatPartnerEmail.replace(/[.@]/g, '_')}`
      : `${chatPartnerEmail.replace(/[.@]/g, '_')}_${currentUserEmail.replace(/[.@]/g, '_')}`;

    // ইউজারকে অনলাইন সেট করা
    await setDoc(doc(db, "users", user.email), {
      online: true,
      typing: false,
      lastSeen: Date.now()
    }, { merge: true });

    if(window.location.pathname.includes('chat.html')) {
      listenPartnerStatus();
      loadPrivateChatMessages();
    }

    window.addEventListener("beforeunload", () => {
      updateDoc(doc(db, "users", currentUserEmail), { online: false, typing: false });
    });
  } else {
    if(window.location.pathname.includes('chat.html')) {
      window.location = 'index.html';
    }
  }
});

/* ---------------- ৪. লাইভ টাইপিং ও অনলাইন স্ট্যাটাস লিসেনার ---------------- */
function listenPartnerStatus() {
  onSnapshot(doc(db, "users", chatPartnerEmail), (snap) => {
    const statusEl = document.getElementById('status');
    const typingIndicatorEl = document.getElementById('typing'); 
    
    if (snap.exists()) {
      const data = snap.data();
      
      if (data.typing) {
        if (statusEl) { statusEl.innerText = "typing..."; statusEl.className = "status-wa status-online-wa"; }
        if (typingIndicatorEl) { typingIndicatorEl.innerText = "typing..."; }
      } else if (data.online) {
        if (statusEl) { statusEl.innerText = "online"; statusEl.className = "status-wa status-online-wa"; }
        if (typingIndicatorEl) { typingIndicatorEl.innerText = ""; }
      } else {
        if (statusEl) { statusEl.innerText = "offline"; statusEl.className = "status-wa"; }
        if (typingIndicatorEl) { typingIndicatorEl.innerText = ""; }
      }
    }
  });
}

/* ---------------- ৫. মেসেজ লোড ও রিয়্যাল-টাইম 'Seen' সিস্টেম ---------------- */
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

      // মেসেজ ওপেন করলেই ওপার প্রান্তের ইউজারের মেসেজ 'Seen' হয়ে যাবে
      if (data.sender !== currentUserEmail && !data.seen) {
        updateDoc(doc(db, 'rooms', chatRoomId, 'messages', msgId), { seen: true });
      }

      let div = document.createElement('div');
      const isMe = data.sender === currentUserEmail;
      div.className = isMe ? "message me" : "message other";

      // রিপ্লাই এবং রিয়্যাকশন লেআউট
      let replyHTML = data.reply ? `<div class="inside-reply">↪ ${data.reply}</div>` : "";
      let reactionHTML = data.reaction ? `<div class="badge-reaction" onclick="removeReaction('${msgId}')">${data.reaction}</div>` : "";
      
      // টেক্সট মেসেজের ভেতর কোনো লিংক থাকলে তা ক্লিকেবল করা
      let contentHTML = "";
      let formattedText = data.text || "";
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      formattedText = formattedText.replace(urlRegex, (url) => `<a href="${url}" target="_blank" style="color: #53bdeb; text-decoration: underline;">${url}</a>`);
      contentHTML = `<div class="msg-content">${formattedText}</div>`;

      // হোয়াটসঅ্যাপ স্টাইল ডাবল টিক (✓✓) স্ট্যাটাস
      let tickStatus = data.seen ? `<span class="seen-blue">✓✓</span>` : `<span style="color:#8696a0;">✓✓</span>`;
      if (!isMe) tickStatus = ""; // ওপার থেকে আসা মেসেজে নিজের টিক দেখানোর প্রয়োজন নেই

      // মেসেজের পাশে সময় দেখানোর ফরম্যাট (HH:MM)
      let timeString = "";
      if(data.time) {
        const date = data.time.toDate();
        timeString = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      }

      let isAdmin = currentUserEmail === ADMIN_EMAIL;
      
      let actionControlHTML = `
        <div class="action-links">
          <span onclick="triggerReply('${data.text ? data.text.replace(/'/g, "\\'") : 'মেসেজ'}')">Reply</span> | 
          <span onclick="triggerReactionBox('${msgId}')">React</span>
          ${(isMe || isAdmin) ? ` | <span class="del-admin" onclick="deleteTargetMsg('${msgId}')">Delete</span>` : ""}
        </div>
      `;

      div.innerHTML = `
        ${replyHTML}
        ${contentHTML}
        ${actionControlHTML}
        ${reactionHTML}
        <div class="meta-data">${timeString} ${tickStatus}</div>
      `;

      box.appendChild(div);
    });
    
    // নতুন মেসেজ আসলে স্ক্রিন অটো স্ক্রোল হয়ে নিচে চলে যাবে
    setTimeout(() => {
      const mainArea = document.getElementById('messages');
      if(mainArea) mainArea.scrollTop = mainArea.scrollHeight;
    }, 50);
  });
}

/* ---------------- ৬. মেসেজ পাঠানো ---------------- */
window.sendMessage = async function() {
  const input = document.getElementById('messageInput');
  const messageText = input.value.trim();
  
  if (!messageText || !chatRoomId || !currentUserEmail) return;

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
    const typingIndicatorEl = document.getElementById('typing');
    if(typingIndicatorEl) typingIndicatorEl.innerText = "";
    await updateDoc(doc(db, "users", currentUserEmail), { typing: false });
  } catch (error) {
    alert("মেসেজ পাঠানো যায়নি: " + error.message);
  }
}

/* ---------------- ৭. Typing Indicator ফায়ারবেস ট্রিগার ---------------- */
let typingDelayTimer;
window.emitTyping = function() {
  if (!currentUserEmail) return;
  updateDoc(doc(db, "users", currentUserEmail), { typing: true });
  clearTimeout(typingDelayTimer);
  typingDelayTimer = setTimeout(() => {
    updateDoc(doc(db, "users", currentUserEmail), { typing: false });
  }, 1500); 
}

/* ---------------- ৮. Reply এবং Emoji Reaction সিস্টেম ---------------- */
window.triggerReply = function(text) {
  replyText = text;
  const typingIndicatorEl = document.getElementById('typing');
  if(typingIndicatorEl) typingIndicatorEl.innerText = "Replying to: " + text;
}

window.triggerReactionBox = function(msgId) {
  currentSelectedMsgId = msgId;
  document.getElementById('emojiMenu').style.display = 'flex';
}

window.appendEmoji = async function(emoji) {
  if (currentSelectedMsgId && chatRoomId) {
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

/* ---------------- ৯. একক Message Delete ---------------- */
window.deleteTargetMsg = async function(msgId) {
  if (confirm("আপনি কি এই মেসেজটি সবার জন্য ডিলিট করতে চান?")) {
    try {
      await deleteDoc(doc(db, 'rooms', chatRoomId, 'messages', msgId));
    } catch (error) {
      alert("মেসেজ ডিলিট করা যায়নি: " + error.message);
    }
  }
}

/* ---------------- ১০. সমস্ত মেসেজ একসাথে ক্লিয়ার করা ---------------- */
window.clearAllMessages = async function() {
  if (!chatRoomId) return;
  
  if (confirm("আপনি কি এই চ্যাটের সমস্ত মেসেজ স্থায়ীভাবে মুছে ফেলতে চান?")) {
    try {
      const typingIndicatorEl = document.getElementById('typing');
      if(typingIndicatorEl) typingIndicatorEl.innerText = "ক্লিয়ার হচ্ছে...";
      
      const messagesRef = collection(db, 'rooms', chatRoomId, 'messages');
      const querySnapshot = await getDocs(messagesRef);
      
      const deletePromises = [];
      querySnapshot.forEach((msgDoc) => {
        deletePromises.push(deleteDoc(doc(db, 'rooms', chatRoomId, 'messages', msgDoc.id)));
      });
      
      await Promise.all(deletePromises);
      if(typingIndicatorEl) typingIndicatorEl.innerText = "";
    } catch (error) {
      const typingIndicatorEl = document.getElementById('typing');
      if(typingIndicatorEl) typingIndicatorEl.innerText = "";
      alert("চ্যাট ক্লিয়ার করতে সমস্যা হয়েছে: " + error.message);
    }
  }
}

/* ---------------- ১১. MOBILE KEYBOARD & SCROLL FIX ---------------- */
const inputField = document.getElementById('messageInput');
if(inputField) {
  // কিবোর্ড ওপেন হওয়ার সাথে সাথে চ্যাট স্ক্রিনকে ডাইনামিক্যালি নিচে পুশ করবে
  inputField.addEventListener('focus', () => {
    setTimeout(() => {
      const mainArea = document.getElementById('messages');
      if(mainArea) {
        mainArea.scrollTop = mainArea.scrollHeight;
      }
    }, 80); // কিবোর্ড ওঠার অ্যানিমেশন টাইমিং ফিক্স
  });

  // Enter চাপলে যেন সরাসরি মেসেজ সেন্ড হয় তার লজিক
  inputField.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') {
      sendMessage();
    }
  });
}
