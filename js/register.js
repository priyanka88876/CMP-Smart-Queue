import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Class ke hisaab se semester count
const semesterMap = {
  "BA": 6, "BSc": 6, "BCom": 6, "BCA": 6, "BCA Data Science": 6, "LLB": 6,
  "MA": 4, "MSc": 4, "MCom": 4, "MCA": 4, "Data Science": 4
};

const classSelect = document.getElementById("class");
const semSelect = document.getElementById("semester");

classSelect.addEventListener("change", () => {
  const total = semesterMap[classSelect.value] || 6;
  semSelect.innerHTML = '<option value="" disabled selected>Select Semester</option>';
  for (let i = 1; i <= total; i++) {
    semSelect.innerHTML += `<option value="${i}">Semester ${i}</option>`;
  }
});

// Register
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const v = id => document.getElementById(id).value.trim();
  try {
    const cred = await createUserWithEmailAndPassword(
      auth, v("email"), document.getElementById("password").value
    );
    await setDoc(doc(db, "users", cred.user.uid), {
      name: v("name"),
      email: v("email"),
     enrollmentNo: v("enrollmentNo"),
      class: v("class"),
      semester: v("semester"),
      course: v("course"),
      role: "student",
      createdAt: serverTimestamp()
    });
    alert("Registration successful!");
    location.href = "login.html";
  } catch (err) {
    alert(err.message);
  }
});