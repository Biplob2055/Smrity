import {
  auth, db, storage,
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, setDoc,
  ref, uploadBytes, getDownloadURL
} from './firebase.js';

let currentUserEmail = null;
let chatPartnerEmail = null;
let chatRoomId = null;
let replyText = "";
let currentSelectedMsgId = null;

// সুপার অ্যাডমিন ইমেইল ডিফাইন করা (অ্যাডমিন ডিলিট কন্ট্রোলের জন্য)
const ADMIN_EMAIL = "sanwarhossain2055@gmail.com"; 

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

/* ---------------- ২. FEATURE: Minimize করলে অটো লগআউট ---------------- */
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "hidden" && auth.currentUser) {
    if (currentUserEmail) {
      await updateDoc(doc(db, "users", currentUserEmail), { online: false, typing: false });
    }
    await signOut(auth);
    window.location = 'index.html';
  }
});

/* ---------------- ৩. ইউজার অথ স্ট্যাটাস ও লাইভ স্ট্যাটাস সেট ---------------- */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserEmail = user.email;
    
    await setDoc(doc(db, "users", user.email), {
      online: true,
      typing: false,
      lastSeen: Date.now()
    }, { merge: true });

    window.addEventListener("beforeunload", () => {
      updateDoc(doc(db, "users", currentUserEmail), { online: false, typing: false });
    });
  } else {
    if(window.location.pathname.includes('chat.html')) {
      window.location = 'index.html';
    }
  }
});

/* ---------------- ৪. FEATURE: Private 2-User Chat রুম জেনারেটর ---------------- */
window.startPrivateChat = function() {
  const partnerInput = document.getElementById('chatWithEmail').value.trim();
  if(!partnerInput || partnerInput === currentUserEmail) {
    alert("দয়া করে পার্টনারের সঠিক ইমেইল আইডি দিন!");
    return;
  }
  chatPartnerEmail = partnerInput;
  document.getElementById('chatWithTitle').innerText = `${chatPartnerEmail}`;
  document.getElementById('userSelector').style.display = 'none';

  // অ্যালফাবেট অনুসারে ২ জনের ইমেইল সর্ট করে ইউনিক প্রাইভেট রুম আইডি তৈরি
  chatRoomId = currentUserEmail < chatPartnerEmail 
    ? `${currentUserEmail.replace(/[.@]/g, '_')}_${chatPartnerEmail.replace(/[.@]/g, '_')}`
    : `${chatPartnerEmail.replace(/[.@]/g, '_')}_${currentUserEmail.replace(/[.@]/g, '_')}`;

  listenPartnerStatus();
  loadPrivateChatMessages();
}

// পার্টনারের লাইভ অনলাইন এবং টাইপিং ইন্ডিকেটর ওয়াচ করা
function listenPartnerStatus() {
  onSnapshot(doc(db, "users", chatPartnerEmail), (snap) => {
    const statusEl = document.getElementById('status');
    if (snap.exists()) {
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

/* ---------------- ৫. FEATURE: Proper Seen System (Real-time Update) ---------------- */
function loadPrivateChatMessages() {
  const q = query(collection(db, 'rooms', chatRoomId, 'messages'), orderBy('time'));
  
  onSnapshot(q, (snap) => {
    const box = document.getElementById('messages');
    if (!box) return;
    box.innerHTML = "";

    snap.forEach((d) => {
      const data = d.data();
      const msgId = d.id;

      // রিয়েল-টাইম সিন লজিক: মেসেজটি অন্যের হলে এবং আমি স্ক্রিনে দেখলে সাথে সাথে ডাটাবেসে seen: true হবে
      if (data.sender !== currentUserEmail && !data.seen) {
        updateDoc(doc(db, 'rooms', chatRoomId, 'messages', msgId), { seen: true });
      }

      let div = document.createElement('div');
      const isMe = data.sender === currentUserEmail;
      div.className = isMe ? "message me" : "message other";

      // রিপ্লাই এবং রিয়্যাকশন সাব-কম্পোনেন্ট জেনারেট করা
      let replyHTML = data.reply ? `<div class="inside-reply">↪ ${data.reply}</div>` : "";
      let reactionHTML = data.reaction ? `<div class="badge-reaction" onclick="removeReaction('${msgId}')">${data.reaction}</div>` : "";
      
      // লিঙ্ক শেয়ারিং এবং টেক্সট/অডিও ডিটেকশন
      let contentHTML = "";
      if(data.audio) {
        contentHTML = `<audio controls src="${data.audio}" style="max-width:100%;"></audio>`;
      } else {
        // অটোমেটিক ইউআরএল/লিঙ্ক ডিটেকশন (Link Support)
        let formattedText = data.text || "";
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        formattedText = formattedText.replace(urlRegex, (url) => `<a href="${url}" target="_blank" style="color: #53bdeb; text-decoration: underline;">${url}</a>`);
        contentHTML = `<div class="msg-content">${formattedText}</div>`;
      }

      // সিন স্ট্যাটাস টিক চিহ্ন নির্ধারণ
      let tickStatus = data.seen ? `<span class="seen-blue">✓✓ Seen</span>` : "✓ Delivered";

      // FEATURE: Admin Delete Control লজিক
      let isAdmin = currentUserEmail === ADMIN_EMAIL;
      let actionControlHTML = `
        <div class="action-links">
          <span onclick="triggerReply('${data.text ? data.text : 'ভয়েস মেসেজ'}')">Reply</span> | 
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
    box.scrollTop = box.scrollHeight; // অটো স্ক্রোল টু বটম
  });
}

/* ---------------- ৬. মেসেজ পাঠানো (Text, Reply, Link Support) ---------------- */
window.sendMessage = async function() {
  const input = document.getElementById('messageInput');
  if (!input.value.trim() || !chatRoomId) return;

  await addDoc(collection(db, 'rooms', chatRoomId, 'messages'), {
    text: input.value,
    sender: currentUserEmail,
    reply: replyText,
    seen: false,
    time: serverTimestamp()
  });

  input.value = "";
  replyText = "";
  document.getElementById('typing').innerText = "";
  await updateDoc(doc(db, "users", currentUserEmail), { typing: false });
}

/* ---------------- ৭. FEATURE: Typing Indicator লজিক ---------------- */
let typingDelayTimer;
window.emitTyping = function() {
  if (!currentUserEmail) return;
  
  updateDoc(doc(db, "users", currentUserEmail), { typing: true });
  
  clearTimeout(typingDelayTimer);
  typingDelayTimer = setTimeout(() => {
    updateDoc(doc(db, "users", currentUserEmail), { typing: false });
  }, 2000); 
}

/* ---------------- ৮. FEATURE: Reply এবং Emoji Reaction সিস্টেম ---------------- */
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

/* ---------------- ৯. FEATURE: Admin Delete Control ---------------- */
window.deleteTargetMsg = async function(msgId) {
  if (confirm("আপনি কি এই মেসেজটি সবার জন্য ডিলিট করতে চান?")) {
    await deleteDoc(doc(db, 'rooms', chatRoomId, 'messages', msgId));
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
