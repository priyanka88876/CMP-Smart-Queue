import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const cred = await signInWithEmailAndPassword(
      auth,
      document.getElementById("email").value.trim(),
      document.getElementById("password").value
    );
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    const role = (snap.data()?.role || "").toLowerCase().trim();
    location.href = role === "admin" ? "admin.html" : "student.html";
  } catch (err) {
    console.error("Login error:", err);
    alert("Login failed: " + err.code);
  }
});