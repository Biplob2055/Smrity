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
   ১. সম্পূর্ণ নিরাপদ পিন লগইন সিস্টেম
   ========================================================================== */
window.loginWithKey = function() {
  try {
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

    sessionStorage.setItem('secure_session_token', btoa(currentUserPIN));
    sessionStorage.setItem('secure_session_user', currentUserName);

    pinInput.value = "";
    window.location.href = 'chat.html';
  } catch (err) {
    console.error("লগইন এরর:", err);
  }
};

window.handleSecretLogin = function(enteredPIN) {
  try {
    if (enteredPIN === PIN_USER_ONE) {
      currentUserName = "Mohammad Sanwar";
      currentUserPIN = PIN_USER_ONE;
    } else if (enteredPIN === PIN_USER_TWO) {
      currentUserName = "Mayaboti";
      currentUserPIN = PIN_USER_TWO;
    } else {
      return alert("ভুল পিন! প্রবেশাধিকার নিষিদ্ধ।");
    }
    sessionStorage.setItem('secure_session_token', btoa(currentUserPIN));
    sessionStorage.setItem('secure_session_user', currentUserName);
    window.location.href = 'chat.html';
  } catch (err) {
    console.error("সিক্রেট লগইন এরর:", err);
  }
};

// পেজ লোড হওয়ার সময় অটো-লগইন ও সেশন লোড করার লজিক
function checkSessionSecurity() {
  try {
    const token = sessionStorage.getItem('secure_session_token');
    const user = sessionStorage.getItem('secure_session_user');

    if (window.location.pathname.includes('chat.html')) {
      if (!token || !user) {
        clearSessionAndRedirect();
        return;
      }
      
      currentUserPIN = atob(token);
      currentUserName = user;
      
      // 🎯 ১. প্রথমে সাথে সাথে UI পরিবর্তন করে নাম বসানো (যাতে Loading... চলে যায়)
      const partnerName = (currentUserName === "Mohammad Sanwar") ? "Mayaboti" : "Mohammad Sanwar";
      // সম্ভাব্য সব আইডিতে ট্রাই করবে যাতে ভুল না হয়
      const titleEl = document.getElementById('chatWithTitle') || document.getElementById('userName') || document.getElementById('partnerName');
      if (titleEl) {
        titleEl.innerText = partnerName;
      }

      // 🎯 ২. ডাটাবেজের কানেকশন আলাদা ব্যাকগ্রাউন্ডে চালানো যাতে ক্র্যাশ না করে
      setTimeout(() => {
        try {
          updateLiveStatus(true);
        } catch (e) { console.error("অনলাইন স্ট্যাটাস আপডেট ব্যর্থ:", e); }
        
        try {
          listenPartnerStatus();
        } catch (e) { console.error("পার্টনার স্ট্যাটাস লোড ব্যর্থ:", e); }
        
        try {
          loadPrivateChatMessages();
        } catch (e) { console.error("মেসেজ লোড ব্যর্থ:", e); }
      }, 100);

    } else {
      const pinInput = document.getElementById('accessPassword');
      if (pinInput) {
        pinInput.setAttribute('autocomplete', 'off');
        pinInput.setAttribute('type', 'password');
        pinInput.value = "";
      }
    }
  } catch (error) {
    console.error("সেশন চেক এরর:", error);
  }
}

function clearSessionAndRedirect() {
  try {
    updateLiveStatus(false);
  } catch (e) {}
  sessionStorage.clear();
  if (window.location.pathname.includes('chat.html')) {
    window.location.href = 'index.html';
  }
}

window.logout = function() {
  clearSessionAndRedirect();
};

/* ==========================================================================
   ২. মিলিটারি-গ্রেড অটো-লগআউট
   ========================================================================== */
function handleUltraSecurityLogout() {
  if (window.location.pathname.includes('chat.html')) {
    try {
      updateLiveStatus(false);
    } catch(e){}
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
  if (!currentUserName || !db) return;
  try {
    const userRef = doc(db, "users", currentUserName);
    await setDoc(userRef, { 
      online: isOnline, 
      typing: false,
      lastActive: serverTimestamp() 
    }, { merge: true });
  } catch (e) {
    console.error("স্ট্যাটাস আপডেট এরর:", e);
  }
}

function timeAgo(timestamp) {
  if (!timestamp) return "offline";
  try {
    const now = new Date();
    const past = timestamp.toDate();
    const seconds = Math.floor((now - past) / 1000);
    
    if (seconds < 60) return "Active just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Last active: ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Last active: ${hours}h ago`;
    
    return `Last active: ${past.toLocaleDateString([], {day: 'numeric', month: 'short'})}`;
  } catch (e) {
    return "offline";
  }
}

function listenPartnerStatus() {
  if (!db || !currentUserName) return;
  const partnerName = (currentUserName === "Mohammad Sanwar") ? "Mayaboti" : "Mohammad Sanwar";
  try {
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
  } catch (e) {
    console.error("স্ট্যাটাস লিসেন এরর:", e);
  }
}

/* ==========================================================================
   ৪. চ্যাট মেসেজিং ও রিয়েলটাইম ডিসপ্লে
   ========================================================================== */
function loadPrivateChatMessages() {
  if (!chatRoomId || !db) return;
  try {
    const q = query(collection(db, 'rooms', chatRoomId, 'messages'), orderBy('time'));
    
    onSnapshot(q, (snap) => {
      const box = document.getElementById('actualMessages');
      if (!box) return;
      box.innerHTML = "";

      snap.forEach((d) => {
        const data = d.data();
        const msgId = d.id;

        if (data.sender !== currentUserName && !data.seen) {
          try {
            updateDoc(doc(db, 'rooms', chatRoomId, 'messages', msgId), { seen: true });
          } catch(e){}
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
          try {
            const msgDate = data.time.toDate();
            dateTimeString = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch(e){}
        }

        div.innerHTML = `
          ${replyHTML}
          <div>${data.text}</div>
          <div class="action-links">
            <span onclick="triggerReply('${data.text.replace(/'/g, "\\'")}')">Reply</span> | 
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
  } catch (error) {
    console.error("মেসেজ লোড এরর:", error);
  }
}

window.sendMessage = async function() {
  try {
    const input = document.getElementById('messageInput');
    if (!input) return;
    const messageText = input.value.trim();
    if (!messageText || !chatRoomId || !currentUserName || !db) return;

    await addDoc(collection(db, 'rooms', chatRoomId, 'messages'), {
      text: messageText,
      sender: currentUserName,
      reply: replyText || "",
      seen: false,
      time: serverTimestamp()
    });
    
    input.value = "";
    replyText = "";
    
    const typingIndicator = document.getElementById('typing');
    if (typingIndicator) typingIndicator.innerText = "";
    
    await updateDoc(doc(db, "users", currentUserName), { typing: false });
  } catch (error) {
    console.error("মেসেজ পাঠাতে সমস্যা হয়েছে:", error);
    alert("মেসেজ পাঠানো যায়নি। দয়া করে ইন্টারনেট কানেকশন বা কনসোল চেক করুন।");
  }
};

let typingTimer;
window.emitTyping = function() {
  if(!currentUserName || !db) return;
  try {
    updateDoc(doc(db, "users", currentUserName), { typing: true });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      if(currentUserName) updateDoc(doc(db, "users", currentUserName), { typing: false });
    }, 1500);
  } catch(e){}
};

window.triggerReply = function(text) { 
  replyText = text; 
  const typingIndicator = document.getElementById('typing');
  if (typingIndicator) typingIndicator.innerText = "Replying to: " + text; 
};

window.triggerReactionBox = function(msgId) { 
  currentSelectedMsgId = msgId; 
  const menu = document.getElementById('emojiMenu');
  if(menu) menu.style.display = 'flex'; 
};

window.appendEmoji = async function(emoji) { 
  if (currentSelectedMsgId && db) { 
    try {
      await updateDoc(doc(db, 'rooms', chatRoomId, 'messages', currentSelectedMsgId), { reaction: emoji }); 
    } catch(e){}
  } 
  const menu = document.getElementById('emojiMenu');
  if(menu) menu.style.display = 'none'; 
};

window.toggleEmojiMenu = function() { 
  const menu = document.getElementById('emojiMenu'); 
  if(menu) menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex'; 
};

/* ==========================================================================
   ৫. সম্পূর্ণ নিরাপদ ডিলিট ও অল ক্লিয়ার
   ========================================================================== */
window.deleteTargetMsg = async function(msgId) {
  if (!chatRoomId || !db) return;
  if (confirm("আপনি কি এই মেসেজটি ডিলিট করতে চান?")) {
    try {
      await deleteDoc(doc(db, 'rooms', chatRoomId, 'messages', msgId));
    } catch (error) {
      console.error(error);
    }
  }
};

window.clearAllMessages = async function() {
  if (!chatRoomId || !db) return;
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

// ফাইল লোড হওয়ামাত্র সিকিউরিটি সেশন চেক চালু হবে
checkSessionSecurity();
