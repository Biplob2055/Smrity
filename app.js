import {
  auth, db,
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, setDoc
} from './firebase.js';
import { getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// ফায়ারবেস সেশন কন্ট্রোলের জন্য স্পেশাল ইম্পোর্ট
import { setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let currentUserEmail = null;
let chatPartnerEmail = null;
let chatRoomId = null;
let replyText = "";
let currentSelectedMsgId = null;

// 🔒 ফায়ারবেস ব্যাকএন্ডের দুটি ইমেইল
const PERSON_ONE_EMAIL = "sanwarhossain2055@gmail.com"; 
const PERSON_TWO_EMAIL = "nightq181@gmail.com"; 

/* ১. শুধু পাসওয়ার্ড দিয়ে দুইজনের আলাদা লগইন লজিক (ট্যাব বন্ধের সুরক্ষাসহ) */
window.loginWithKey = async function() {
  const password = document.getElementById('accessPassword').value.trim();
  if(!password) return alert("দয়া করে সিকিউরিটি পাসওয়ার্ডটি দিন!");

  let targetEmail = "";

  if (password === "553932") {
    targetEmail = PERSON_ONE_EMAIL;
  } else if (password === "861155") {
    targetEmail = PERSON_TWO_EMAIL;
  } else {
    return alert("ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।");
  }

  try {
    // 🛡️ ব্রাউজারকে নির্দেশ দেওয়া হচ্ছে যাতে ট্যাব বন্ধ করলেই সেশন ডিলিট হয়ে যায়
    await setPersistence(auth, browserSessionPersistence);
    
    // এরপর লগইন হবে
    await signInWithEmailAndPassword(auth, targetEmail, password);
    window.location = 'chat.html';
  } catch (error) {
    alert("লগইন ব্যর্থ হয়েছে! এরর: " + error.message);
  }
}

// লগআউট ফাংশন
window.logout = async function() {
  if (currentUserEmail) {
    try {
      await updateDoc(doc(db, "users", currentUserEmail), { 
        online: false, 
        typing: false,
        lastActive: serverTimestamp() 
      });
    } catch(e) { console.log(e); }
  }
  await signOut(auth);
  window.location = 'index.html';
}

/* ২. চ্যাটルーム কানেকশন কন্ট্রোল */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserEmail = user.email;
    chatPartnerEmail = (currentUserEmail === PERSON_ONE_EMAIL) ? PERSON_TWO_EMAIL : PERSON_ONE_EMAIL;
    
    const titleEl = document.getElementById('chatWithTitle');
    if(titleEl) {
      titleEl.innerText = (chatPartnerEmail === PERSON_ONE_EMAIL) ? "Mohammad Sanwar" : "Mayaboti";
    }

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

/* 🚨 ৩. ব্রাউজার মিনিমাইজ, নতুন ট্যাব ওপেন বা ব্যাকগ্রাউন্ডে গেলে অটো-লগআউট লজিক */
function handleAutoLogout() {
  if (currentUserEmail && window.location.pathname.includes('chat.html')) {
    logout();
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    handleAutoLogout();
  }
});

window.addEventListener('pagehide', () => {
  handleAutoLogout();
});


/* ৪. চ্যাট মেসেজ ও পার্টনার স্ট্যাটাস লজিক */

function timeAgo(timestamp) {
  if (!timestamp) return "offline";
  const now = new Date();
  const past = timestamp.toDate();
  const seconds = Math.floor((now - past) / 1000);
  
  if (seconds < 60) return "Active just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Last active: ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last active: ${hours}h ago`;
  
  return `Last active: ${past.toLocaleDateString([], {day: 'numeric', month: 'short'})} at ${past.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
}

function listenPartnerStatus() {
  onSnapshot(doc(db, "users", chatPartnerEmail), (snap) => {
    const statusEl = document.getElementById('status');
    if (snap.exists() && statusEl) {
      const data = snap.data();
      if (data.typing) {
        statusEl.innerText = "typing...";
      } else if (data.online) {
        statusEl.innerText = "online";
      } else {
        statusEl.innerText = timeAgo(data.lastActive);
      }
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

      let dateTimeString = "";
      if (data.time) {
        const msgDate = data.time.toDate();
        const timeOptions = { hour: '2-digit', minute: '2-digit' };
        const dateOptions = { day: 'numeric', month: 'short' };
        
        const isToday = new Date().toDateString() === msgDate.toDateString();
        if (isToday) {
          dateTimeString = msgDate.toLocaleTimeString([], timeOptions);
        } else {
          dateTimeString = `${msgDate.toLocaleDateString([], dateOptions)}, ${msgDate.toLocaleTimeString([], timeOptions)}`;
        }
      }

      // 🔓 দুইজনেই ডিলিট অপশন দেখতে পাবেন (কোনো ইমেইল লকিং নেই)
      div.innerHTML = `
        ${replyHTML}
        <div>${data.text}</div>
        <div class="action-links">
          <span onclick="triggerReply('${data.text}')">Reply</span> | 
          <span onclick="triggerReactionBox('${msgId}')">React</span> | 
          <span style="color:#ef5350" onclick="deleteTargetMsg('${msgId}')">Delete</span>
        </div>
        ${reactionHTML}
        <div class="meta-data">${dateTimeString} ${tickStatus}</div>
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
  if(!currentUserEmail) return;
  updateDoc(doc(db, "users", currentUserEmail), { typing: true });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    if(currentUserEmail) updateDoc(doc(db, "users", currentUserEmail), { typing: false });
  }, 1500);
}

window.triggerReply = function(text) { replyText = text; document.getElementById('typing').innerText = "Replying to: " + text; }
window.triggerReactionBox = function(msgId) { currentSelectedMsgId = msgId; document.getElementById('emojiMenu').style.display = 'flex'; }
window.appendEmoji = async function(emoji) { if (currentSelectedMsgId) { await updateDoc(doc(db, 'rooms', chatRoomId, 'messages', currentSelectedMsgId), { reaction: emoji }); } document.getElementById('emojiMenu').style.display = 'none'; }
window.toggleEmojiMenu = function() { const menu = document.getElementById('emojiMenu'); menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex'; }


// 🤫 ১. একটি মেসেজ ডিলিট করলে গোপনে ব্যাকআপ রেখে ডিলিট করার ফাংশন
window.deleteTargetMsg = async function(msgId) {
  if (!chatRoomId) return;
  
  if (confirm("আপনি কি এই মেসেজটি ডিলিট করতে চান?")) {
    try {
      // ডিলিট করার আগে মেসেজের ডাটা তুলে আনা হচ্ছে
      const msgRef = doc(db, 'rooms', chatRoomId, 'messages', msgId);
      const snap = await getDocs(query(collection(db, 'rooms', chatRoomId, 'messages')));
      
      let targetData = null;
      snap.forEach((docSnap) => {
        if (docSnap.id === msgId) targetData = docSnap.data();
      });

      if (targetData) {
        // গোপনে 'admin_backups' কালেকশনে ব্যাকআপ সেভ হচ্ছে
        await addDoc(collection(db, 'admin_backups', chatRoomId, 'deleted_chats'), {
          text: targetData.text,
          sender: targetData.sender,
          reply: targetData.reply || "",
          reaction: targetData.reaction || "",
          original_time: targetData.time,
          backup_time: serverTimestamp(),
          deleted_by: currentUserEmail, // কে ডিলিট করলো তার ট্র্যাক
          type: "single_delete"
        });
      }

      // ব্যাকআপ শেষে মূল চ্যাট থেকে ডিলিট
      await deleteDoc(msgRef);
    } catch (error) {
      console.log("Error during single delete: ", error);
    }
  }
}

// 🤫 ২. সম্পূর্ণ চ্যাট ক্লিয়ার করলে গোপনে ব্যাকআপ রেখে ক্লিয়ার করার ফাংশন
window.clearAllMessages = async function() {
  if (!chatRoomId) return;

  // নোটিশে ব্যাকআপের কোনো কথা লেখা নেই, তাই কেউ বুঝতে পারবে না
  if (confirm("আপনি কি নিশ্চিত যে সম্পূর্ণ চ্যাটরুম খালি করতে চান? এই কাজ আর ফিরিয়ে আনা যাবে না।")) {
    try {
      const snap = await getDocs(collection(db, 'rooms', chatRoomId, 'messages'));
      if (snap.empty) return alert("চ্যাটরুম অলরেডি খালি আছে!");

      // লুপ চালিয়ে প্রতিটি মেসেজ প্রথমে গোপনে ব্যাকআপ করে তারপর ডিলিট করা হচ্ছে
      for (const m of snap.docs) {
        const msgData = m.data();
        
        await addDoc(collection(db, 'admin_backups', chatRoomId, 'deleted_chats'), {
          text: msgData.text,
          sender: msgData.sender,
          reply: msgData.reply || "",
          reaction: msgData.reaction || "",
          original_time: msgData.time,
          backup_time: serverTimestamp(),
          deleted_by: currentUserEmail, // কে ক্লিয়ার করলো তার ট্র্যাক
          type: "clear_chat"
        });

        await deleteDoc(doc(db, 'rooms', chatRoomId, 'messages', m.id));
      }

      alert("সম্পূর্ণ চ্যাটরুম সফলভাবে ক্লিয়ার করা হয়েছে!");
    } catch (error) {
      alert("চ্যাট ক্লিয়ার করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।");
    }
  }
}
