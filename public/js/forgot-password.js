import { auth } from "./firebase.js";

import {
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const form = document.getElementById("forgotPasswordForm");
const emailInput = document.getElementById("email");
const resetButton = document.getElementById("resetButton");
const resetMessage = document.getElementById("resetMessage");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();

    if (!email) {
        resetMessage.textContent = "Please enter your email address.";
        return;
    }

    resetButton.disabled = true;
    resetButton.textContent = "Sending...";
    resetMessage.textContent = "";

    try {
        await sendPasswordResetEmail(auth, email);

        resetMessage.style.color = "#15803d";
        resetMessage.textContent =
            "If an account exists for this email, a password reset link has been requested. Please check your inbox and spam folder.";

        form.reset();

    } catch (error) {
        console.error("Password reset error:", error);

        resetMessage.style.color = "#dc2626";

        if (error.code === "auth/invalid-email") {
            resetMessage.textContent =
                "Please enter a valid email address.";
        } else if (
            error.code === "auth/too-many-requests"
        ) {
            resetMessage.textContent =
                "Too many attempts. Please try again later.";
        } else {
            resetMessage.textContent =
                "Unable to request the reset email. Please check your Firebase configuration and try again.";
        }

    } finally {
        resetButton.disabled = false;
        resetButton.textContent = "Send Reset Link";
    }
});