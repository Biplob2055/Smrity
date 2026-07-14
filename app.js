import {
  db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, setDoc
} from './firebase.js';
import { getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔒 চ্যাটরুমের একমাত্র গোপন আইডি
const chatRoomId = "secret_secure_private_room_2026";

// 👥 দুজনের জন্য দুটি সম্পূর্ণ আলাদা গোপন পিন (PIN)
const PIN_USER_ONE = "01609"; // Mohammad Sanwar
const PIN_USER_TWO = "861155"; // Mayaboti

// ব্রাউজারের মেমোরিতে সাময়িক ডাটা রাখার ভেরিয়েবল
let currentUserPIN = null;
let currentUserName = null;
let replyText = "";
let currentSelectedMsgId = null;

/* ==========================================================================
   ১. সম্পূর্ণ নিরাপদ পিন লগইন সিস্টেম (অটো-সেভ ও অটো-লগইন প্রুফ)
   ========================================================================== */
window.loginWithKey = function() {
  const pinInput = document.getElementById('accessPassword');
  if (!pinInput) return;
  
  const enteredPIN = pinInput.value.trim();
  if (!enteredPIN) return alert("দয়া করে আপনার গোপন পিনটি দিন!");

  if (enteredPIN === PIN_USER_ONE) {
    currentUserName = "Mohammad Sanwar";
    currentUserPIN = PIN_USER_ONE;
  } else if (enteredPIN === PIN_USER_TWO) {
    currentUserName = "Mayaboti";
    currentUserPIN = PIN_USER_TWO;
  } else {
    return alert("ভুল পিন! প্রবেশাধিকার নিষিদ্ধ।");
  }

  // ব্রাউজারের ক্যাশ বা লোকাল স্টোরেজে কিচ্ছু সেভ না করে শুধু সেশন মেমোরিতে রাখা
  sessionStorage.setItem('secure_session_token', btoa(currentUserPIN));
  sessionStorage.setItem('secure_session_user', currentUserName);

  pinInput.value = "";
  window.location.href = 'chat.html';
};

// পেজ লোড হওয়ার সময় অটো-লগইন ব্লক করার লজিক
function checkSessionSecurity() {
  const token = sessionStorage.getItem('secure_session_token');
  const user = sessionStorage.getItem('secure_session_user');

  if (window.location.pathname.includes('chat.html')) {
    if (!token || !user) {
      clearSessionAndRedirect();
    } else {
      currentUserPIN = atob(token);
      currentUserName = user;
      
      const titleEl = document.getElementById('chatWithTitle');
      if (titleEl) {
        titleEl.innerText = (currentUserName === "Mohammad Sanwar") ? "Mayaboti" : "Mohammad Sanwar";
      }
      
      updateLiveStatus(true);
      listenPartnerStatus();
      loadPrivateChatMessages();
    }
  } else {
    const pinInput = document.getElementById('accessPassword');
    if (pinInput) {
      pinInput.setAttribute('autocomplete', 'off');
      pinInput.setAttribute('type', 'password');
      pinInput.value = "";
    }
  }
}

function clearSessionAndRedirect() {
  updateLiveStatus(false);
  sessionStorage.clear();
  if (window.location.pathname.includes('chat.html')) {
    window.location.href = 'index.html';
  }
}

window.logout = function() {
  clearSessionAndRedirect();
};

/* ==========================================================================
   ২. মিলিটারি-গ্রেড অটো-লগআউট (ট্যাব মিনিমাইজ বা বন্ধ করলেই সেশন হাওয়া)
   ========================================================================== */
function handleUltraSecurityLogout() {
  if (window.location.pathname.includes('chat.html')) {
    updateLiveStatus(false);
    sessionStorage.clear();
    window.location.href = 'index.html';
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    handleUltraSecurityLogout();
  }
});

window.addEventListener('pagehide', handleUltraSecurityLogout);
window.addEventListener('beforeunload', handleUltraSecurityLogout);
window.addEventListener('unload', handleUltraSecurityLogout);


/* ==========================================================================
   ৩. স্ট্যাটাস এবং চ্যাটরুম লজিক
   ========================================================================== */
async function updateLiveStatus(isOnline) {
  if (!currentUserName) return;
  try {
    const userRef = doc(db, "users", currentUserName);
    await setDoc(userRef, { 
      online: isOnline, 
      typing: false,
      lastActive: serverTimestamp() 
    }, { merge: true });
  } catch (e) {}
}

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
  
  return `Last active: ${past.toLocaleDateString([], {day: 'numeric', month: 'short'})}`;
}

function listenPartnerStatus() {
  const partnerName = (currentUserName === "Mohammad Sanwar") ? "Mayaboti" : "Mohammad Sanwar";
  onSnapshot(doc(db, "users", partnerName), (snap) => {
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

/* ==========================================================================
   ৪. চ্যাট মেসেজিং ও রিয়েলটাইম ডিসপ্লে (কোনো ইমেইল লকিং ছাড়া)
   ========================================================================== */
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

      if (data.sender !== currentUserName && !data.seen) {
        updateDoc(doc(db, 'rooms', chatRoomId, 'messages', msgId), { seen: true });
      }

      let div = document.createElement('div');
      const isMe = data.sender === currentUserName;
      div.className = isMe ? "message me" : "message other";

      let replyHTML = data.reply ? `<div class="inside-reply">↪ ${data.reply}</div>` : "";
      let reactionHTML = data.reaction ? `<div class="badge-reaction">${data.reaction}</div>` : "";
      let tickStatus = data.seen ? `<span class="seen-blue">✓✓</span>` : `<span>✓✓</span>`;
      if (!isMe) tickStatus = "";

      let dateTimeString = "";
      if (data.time) {
        const msgDate = data.time.toDate();
        dateTimeString = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      // দুইজনেই সমানভাবে ডিলিট অপশন দেখতে পাবেন, কোনো নোটিফিকেশন ছাড়া সরাসরি ডিলিট হবে
      div.innerHTML = `
        ${replyHTML}
        <div>${data.text}</div>
        <div class="action-links">
          <span onclick="triggerReply('${data.text}')">Reply</span> | 
          <span onclick="triggerReactionBox('${msgId}')">React</span> | 
          <span style="color:#ef5350; cursor:pointer;" onclick="deleteTargetMsg('${msgId}')">Delete</span>
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
      sender: currentUserName,
      reply: replyText || "",
      seen: false,
      time: serverTimestamp()
    });
    input.value = "";
    replyText = "";
    document.getElementById('typing').innerText = "";
    await updateDoc(doc(db, "users", currentUserName), { typing: false });
  } catch (error) {
    console.error(error);
  }
};

let typingTimer;
window.emitTyping = function() {
  if(!currentUserName) return;
  updateDoc(doc(db, "users", currentUserName), { typing: true });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    if(currentUserName) updateDoc(doc(db, "users", currentUserName), { typing: false });
  }, 1500);
};

window.triggerReply = function(text) { 
  replyText = text; 
  document.getElementById('typing').innerText = "Replying to: " + text; 
};

window.triggerReactionBox = function(msgId) { 
  currentSelectedMsgId = msgId; 
  document.getElementById('emojiMenu').style.display = 'flex'; 
};

window.appendEmoji = async function(emoji) { 
  if (currentSelectedMsgId) { 
    await updateDoc(doc(db, 'rooms', chatRoomId, 'messages', currentSelectedMsgId), { reaction: emoji }); 
  } 
  document.getElementById('emojiMenu').style.display = 'none'; 
};

window.toggleEmojiMenu = function() { 
  const menu = document.getElementById('emojiMenu'); 
  menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex'; 
};

/* ==========================================================================
   ৫. সম্পূর্ণ নিরাপদ ডিলিট ও অল ক্লিয়ার (কোনো গোপন ব্যাকআপ থাকবে না)
   ========================================================================== */

// ১টি মেসেজ সরাসরি চিরতরে ডিলিট করার ফাংশন
window.deleteTargetMsg = async function(msgId) {
  if (!chatRoomId) return;
  if (confirm("আপনি কি এই মেসেজটি ডিলিট করতে চান?")) {
    try {
      await deleteDoc(doc(db, 'rooms', chatRoomId, 'messages', msgId));
    } catch (error) {
      console.error(error);
    }
  }
};

// সম্পূর্ণ চ্যাটরুমের মেসেজ সরাসরি খালি (Clear Chat) করার ফাংশن
window.clearAllMessages = async function() {
  if (!chatRoomId) return;
  if (confirm("আপনি কি নিশ্চিত যে সম্পূর্ণ চ্যাটরুম খালি করতে চান?")) {
    try {
      const snap = await getDocs(collection(db, 'rooms', chatRoomId, 'messages'));
      for (const m of snap.docs) {
        await deleteDoc(doc(db, 'rooms', chatRoomId, 'messages', m.id));
      }
    } catch (error) {
      console.error(error);
    }
  }
};

// সেশন সিকিউরিটি ইনিশিয়ালাইজ করা
document.addEventListener("DOMContentLoaded", () => {
  checkSessionSecurity();
});
