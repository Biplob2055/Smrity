import {
  db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc
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
   ১. সম্পূর্ণ নিরাপদ পিন লগইন সিস্টেম (অটো-সেভ ও অটো-লগইন প্রuফ)
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
    await updateDoc(userRef, { 
      online: isOnline, 
      typing: false,
      lastActive: serverTimestamp() 
    });
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
  if (hours <Normally I can help with things like this, but I don't seem to have access to that content. You can try again or ask me for something else.
