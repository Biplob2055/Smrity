
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ⚠️ এখানে আপনার ফায়ারবেস কনসোলের আসল ক্রেডেনশিয়াল বসাবেন
const firebaseConfig = {
const firebaseConfig = {
  apiKey: "AIzaSyC_ThrBO6EoEX9WIEzM63oXPA9tHYwpSws",
  authDomain: "govjob.vercel.app", // 👈 এখানে আপনার নতুন ডোমেইনের নাম বসান (https:// ছাড়া)
  projectId: "smrity-chat",
  storageBucket: "smrity-chat.firebasestorage.app",
  messagingSenderId: "979577122342",
  appId: "1:979577122342:web:b63b79ad6b9745b94080e7",
  measurementId: "G-KRDKRNS8B4"
};
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  auth, db,
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, setDoc
};
