import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyC_ThrBO6EoEX9WIEzM63oXPA9tHYwpSws",
  authDomain: "smrity-chat.firebaseapp.com",
  projectId: "smrity-chat",
  storageBucket: "smrity-chat.firebasestorage.app",
  messagingSenderId: "979577122342",
  appId: "1:979577122342:web:b63b79ad6b9745b94080e7",
  measurementId: "G-KRDKRNS8B4"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
  setDoc,
  ref,
  uploadBytes,
  getDownloadURL
};