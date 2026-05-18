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

const ADMIN_EMAIL = "sanwarhossain2055@gmail.com"; 
const USER_EMAIL = "nightq1181@gmail.com"; // এখানে আপনার অপর ইউজারের সঠিক ইমেইলটি দিন

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

/* ---------------- ২. Minimize করলে অটো লগআউট ---------------- */
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "hidden" && auth.currentUser) {
    if (currentUserEmail) {
      await updateDoc(doc(db, "users", currentUserEmail), { online: false, typing: false });
    }
    await signOut(auth);
    window.location = 'index.html';
  }
});

/* ---------------- ৩. অটো চ্যাট রুম ডিটেকশন ও ইনিশিয়ালাইজেশন ---------------- */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserEmail = user.email;
    
    chatPartnerEmail = (currentUserEmail === ADMIN_EMAIL) ? USER_EMAIL : ADMIN_EMAIL;
    
    const titleEl = document.getElementById('chatWithTitle');
    if(titleEl) titleEl.innerText = `${chatPartnerEmail}`;

    chatRoomId = currentUserEmail < chatPartnerEmail 
      ? `${currentUserEmail.replace(/[.@]/g, '_')}_${chatPartnerEmail.replace(/[.@]/g, '_')}`
      : `${chatPartnerEmail.replace(/[.@]/g, '_')}_${currentUserEmail.replace(/[.@]/g, '_')}`;

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

function listenPartnerStatus() {
  onSnapshot(doc(db, "users", chatPartnerEmail), (snap) => {
    const statusEl = document.getElementById('status');
    if (statusEl && snap.exists()) {
      const data = snap.data();
      if (data.typing) {
        statusEl.innerText = "typing...";
        statusEl.className = "status-online";
      } else if (data.online) {
        statusEl.innerText = "Online";
        statusEl.className = "status-online";
      } else {
        statusEl.innerText = "Offline";
        statusEl.className = "status-offline";
      }
    }
  });
}

/* ---------------- ৪. মেসেজ লোড ও রিয়্যাল-টাইম সিন সিস্টেম ---------------- */
function loadPrivateChatMessages() {
  if (!chatRoomId) return;
  const q = query(collection(db, 'rooms', chatRoomId, 'messages'), orderBy('time'));
  
  onSnapshot(q, (snap) => {
    const box = document.getElementById('messages');
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
      
      let contentHTML = "";
      if(data.audio) {
        contentHTML = `<audio controls src="${data.audio}" style="max-width:100%;"></audio>`;
      } else {
        let formattedText = data.text || "";
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        formattedText = formattedText.replace(urlRegex, (url) => `<a href="${url}" target="_blank" style="color: #53bdeb; text-decoration: underline;">${url}</a>`);
        contentHTML = `<div class="msg-content">${formattedText}</div>`;
      }

      let tickStatus = data.seen ? `<span class="seen-blue">✓✓ Seen</span>` : "✓ Delivered";
      let isAdmin = currentUserEmail === ADMIN_EMAIL;
      
      let actionControlHTML = `
        <div class="action-links">
          <span onclick="triggerReply('${data.text ? data.text.replace(/'/g, "\\'") : 'ভয়েস মেসেজ'}')">Reply</span> | 
          <span onclick="triggerReactionBox('${msgId}')">React</span>
          ${(isMe || isAdmin) ? ` | <span class="del-admin" onclick="deleteTargetMsg('${msgId}')">Delete</span>` : ""}
        </div>
      `;

      div.innerHTML = `
        <div class="user-tag">${data.sender}</div>
        ${replyHTML}
        ${contentHTML}
        ${actionControlHTML}
        ${reactionHTML}
        <div class="meta-data">${tickStatus}</div>
      `;

      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  });
}

/* ---------------- ৫. মেসেজ পাঠানো (ফিক্সড লজিক) ---------------- */
window.sendMessage = async function() {
  const input = document.getElementById('messageInput');
  const messageText = input.value.trim();
  
  if (!messageText || !chatRoomId || !currentUserEmail) return;

  try {
    // ডাটাবেসে মেসেজ পাঠানো নিশ্চিত করা
    await addDoc(collection(db, 'rooms', chatRoomId, 'messages'), {
      text: messageText,
      sender: currentUserEmail,
      reply: replyText || "",
      seen: false,
      time: serverTimestamp() // এটি ফায়ারবেস সার্ভার টাইম নেবে
    });

    // ইনপুট এবং টাইপিং রিসেট করা
    input.value = "";
    replyText = "";
    document.getElementById('typing').innerText = "";
    await updateDoc(doc(db, "users", currentUserEmail), { typing: false });
  } catch (error) {
    alert("মেসেজ পাঠানো যায়নি: " + error.message);
  }
}

/* ---------------- ৬. Typing Indicator লজিক ---------------- */
let typingDelayTimer;
window.emitTyping = function() {
  if (!currentUserEmail) return;
  updateDoc(doc(db, "users", currentUserEmail), { typing: true });
  clearTimeout(typingDelayTimer);
  typingDelayTimer = setTimeout(() => {
    updateDoc(doc(db, "users", currentUserEmail), { typing: false });
  }, 2000); 
}

/* ---------------- ৭. Reply এবং Emoji Reaction সিস্টেম ---------------- */
window.triggerReply = function(text) {
  replyText = text;
  document.getElementById('typing').innerText = "Replying to: " + text;
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

/* ---------------- ৮. একক Message Delete ---------------- */
window.deleteTargetMsg = async function(msgId) {
  if (confirm("আপনি কি এই মেসেজটি সবার জন্য ডিলিট করতে চান?")) {
    await deleteDoc(doc(db, 'rooms', chatRoomId, 'messages', msgId));
  }
}

/* ---------------- ৯. সমস্ত মেসেজ একসাথে ক্লিয়ার করা ---------------- */
window.clearAllMessages = async function() {
  if (!chatRoomId) return;
  
  if (confirm("আপনি কি এই চ্যাটের সমস্ত মেসেজ স্থায়ীভাবে মুছে ফেলতে চান? (এটি আর ফিরিয়ে আনা যাবে না)")) {
    try {
      document.getElementById('typing').innerText = "চ্যাট ক্লিয়ার হচ্ছে...";
      const messagesRef = collection(db, 'rooms', chatRoomId, 'messages');
      const querySnapshot = await getDocs(messagesRef);
      
      const deletePromises = [];
      querySnapshot.forEach((msgDoc) => {
        deletePromises.push(deleteDoc(doc(db, 'rooms', chatRoomId, 'messages', msgDoc.id)));
      });
      
      await Promise.all(deletePromises);
      document.getElementById('typing').innerText = "";
      alert("চ্যাট হিস্ট্রি সফলভাবে ক্লিয়ার করা হয়েছে!");
    } catch (error) {
      document.getElementById('typing').innerText = "";
      alert("চ্যাট ক্লিয়ার করতে সমস্যা হয়েছে: " + error.message);
    }
  }
}

/* ---------------- ১০. ভয়েস মেসেজ রেকর্ডিং ---------------- */
let mediaRecorder;
let voiceChunks = [];
window.startRecording = async function() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    
    document.getElementById('typing').innerText = "🎙️ ভয়েস রেকর্ড হচ্ছে (৫ সেকেন্ড)...";
    mediaRecorder.ondataavailable = e => voiceChunks.push(e.data);

    mediaRecorder.onstop = async () => {
      document.getElementById('typing').innerText = "ভয়েস ফাইল পাঠানো হচ্ছে...";
      const blob = new Blob(voiceChunks, { type: 'audio/mp3' });
      const storageRef = ref(storage, 'voice/' + Date.now());
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'rooms', chatRoomId, 'messages'), {
        audio: url,
        sender: currentUserEmail,
        seen: false,
        time: serverTimestamp()
      });

      voiceChunks = [];
      document.getElementById('typing').innerText = "";
    };

    setTimeout(() => { if (mediaRecorder.state === "recording") mediaRecorder.stop(); }, 5000);
  } catch (err) {
    alert("মাইক্রোফোন অ্যাক্সেস করতে সমস্যা হয়েছে: " + err.message);
  }
}
