import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDirxjqR7SgdhkRuIEq2ieAP_pvmeO__Lk",
  authDomain: "smartqueue-bf1b4.firebaseapp.com",
  projectId: "smartqueue-bf1b4",
  storageBucket: "smartqueue-bf1b4.firebasestorage.app",
  messagingSenderId: "309012296761",
  appId: "1:309012296761:web:3ca935a2be4f89f8c7c9e8",
  measurementId: "G-K4HV619LJ4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);