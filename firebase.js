// ফায়ারবেস কোর এবং অ্যাপ মডিউল ইম্পোর্ট
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

// ফায়ারবেস অথেন্টিকেশন (লগইন, লগআউট ও সেশন)
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ফায়ারবেস ফায়ারস্টোর (রিয়্যাল-টাইম ডাটাবেস ও চ্যাট মেসেজ)
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  deleteDoc, 
  doc, 
  updateDoc, 
  setDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ফায়ারবেস স্টোরেজ (ভয়েস মেসেজ ও ফাইল আপলোড)
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ⚠️ এখানে আপনার ফায়ারবেস কনসোলের নিজস্ব "firebaseConfig" কোডটি বসাবেন
const firebaseConfig = {
  apiKey: "AIzaSyC_ThrBO6EoEX9WIEzM63oXPA9tHYwpSws",
  authDomain: "smrity-chat.firebaseapp.com",
  projectId: "smrity-chat",
  storageBucket: "smrity-chat.firebasestorage.app",
  messagingSenderId: "979577122342",
  appId: "1:979577122342:web:b63b79ad6b9745b94080e7",
  measurementId: "G-KRDKRNS8B4"
};

// ফায়ারবেস অ্যাপ ইনিশিয়ালাইজেশন
const app = initializeApp(firebaseConfig);

// সার্ভিসগুলো ভ্যারিয়েবলে সেট করা
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// app.js-এ ব্যবহারের জন্য সবকিছু একসাথে এক্সপোর্ট করা হলো
export {
  auth, db, storage,
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, setDoc,
  ref, uploadBytes, getDownloadURL
};
