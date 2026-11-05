import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    doc,
    getDoc,
    updateDoc,
    collection,
    onSnapshot,
    serverTimestamp,
    addDoc,
    getDocs,
    query,
    where,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================
// 1. GLOBAL VARIABLES
// ==========================================

let allTokens = [];

const $ = (id) => document.getElementById(id);

const tokenBody = $("tokenTableBody");


// Safely display text in HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[char];
    });
}


// Convert 24-hour time to 12-hour format
function formatTime(time) {
    if (!time) return "Not specified";

    const parts = String(time).split(":");

    if (parts.length < 2) return time;

    let hours = Number(parts[0]);
    const minutes = parts[1];

    if (Number.isNaN(hours)) return time;

    const period = hours >= 12 ? "PM" : "AM";

    hours = hours % 12 || 12;

    return `${hours}:${minutes} ${period}`;
}


// Convert stored status into readable status
function getStatus(status) {
    const value = String(status || "pending")
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

    if (value === "completed") return "Completed";

    if (value === "cancelled" || value === "canceled") {
        return "Cancelled";
    }

    if (value === "in_progress" || value === "processing") {
        return "In Progress";
    }

    return "Waiting";
}


// Return CSS-friendly status class
function getStatusClass(status) {
    const value = getStatus(status);

    if (value === "Completed") return "completed";

    if (value === "Cancelled") return "cancelled";

    if (value === "In Progress") return "in-progress";

    return "pending";
}


// Match the service names saved in Firebase
function matchesService(tokenService, selectedService) {
    if (!selectedService) return true;

    const service = String(tokenService || "").toLowerCase();
    const selected = selectedService.toLowerCase();

    if (selected === "scholarship") {
        return service.includes("scholarship");
    }

    if (selected === "document verification") {
        return service.includes("document") ||
               service.includes("verification");
    }

    if (selected === "fee verification") {
        return service.includes("fee");
    }

    if (selected === "admission") {
        return service.includes("admission");
    }

    if (selected === "certificate") {
        return service.includes("certificate");
    }

    if (selected === "other") {
        return ![
            "scholarship",
            "document",
            "verification",
            "fee",
            "admission",
            "certificate"
        ].some(word => service.includes(word));
    }

    return service === selected;
}


// ==========================================
// 2. FILTER TOKENS
// ==========================================

function getFilteredTokens() {
    const selectedDate = $("filterDate").value;
    const selectedService = $("filterService").value;
    const selectedStatus = $("filterStatus").value;

    return allTokens
        .filter(token => {
            if (selectedDate && token.date !== selectedDate) {
                return false;
            }

            if (!matchesService(token.service, selectedService)) {
                return false;
            }

            if (selectedStatus) {
                const actualStatus = getStatus(token.status);

                if (actualStatus !== selectedStatus) {
                    return false;
                }
            }

            return true;
        })
        .sort((a, b) => {
            const dateComparison = String(a.date || "")
                .localeCompare(String(b.date || ""));

            if (dateComparison !== 0) {
                return dateComparison;
            }

            return String(a.slot || "")
                .localeCompare(String(b.slot || ""));
        });
}


// ==========================================
// 3. DASHBOARD STATISTICS
// ==========================================

function updateStatistics() {
    const uniqueStudents = new Set(
        allTokens.map(token =>
            token.uid ||
            token.enrollmentNo ||
            token.studentName
        ).filter(Boolean)
    );

    $("totalStudents").textContent = uniqueStudents.size;

    $("totalTokens").textContent = allTokens.length;

    $("waitingTokens").textContent = allTokens.filter(token => {
        const status = getStatus(token.status);

        return status === "Waiting" || status === "In Progress";
    }).length;

    $("completedTokens").textContent = allTokens.filter(token =>
        getStatus(token.status) === "Completed"
    ).length;
}


// ==========================================
// 4. DISPLAY TOKENS IN TABLE
// ==========================================

function renderTokens() {
    const tokens = getFilteredTokens();

    if (!tokens.length) {
        tokenBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-message">
                    No student tokens found.
                </td>
            </tr>
        `;

        return;
    }

    tokenBody.innerHTML = tokens.map(token => {
        const status = getStatus(token.status);
        const statusClass = getStatusClass(token.status);

        const date = token.date || "Not specified";
        const time = formatTime(token.slot);

        let actionButtons = "";

        if (status === "Waiting") {
            actionButtons = `
                <button
                    type="button"
                    class="admin-action-btn"
                    data-action="start"
                    data-id="${escapeHTML(token.id)}">
                    Start
                </button>

                <button
                    type="button"
                    class="admin-action-btn"
                    data-action="complete"
                    data-id="${escapeHTML(token.id)}">
                    Complete
                </button>

                <button
                    type="button"
                    class="admin-action-btn"
                    data-action="edit"
                    data-id="${escapeHTML(token.id)}">
                    Edit
                </button>

                <button
                    type="button"
                    class="admin-action-btn"
                    data-action="cancel"
                    data-id="${escapeHTML(token.id)}">
                    Cancel
                </button>
            `;
        } else if (status === "In Progress") {
            actionButtons = `
                <button
                    type="button"
                    class="admin-action-btn"
                    data-action="complete"
                    data-id="${escapeHTML(token.id)}">
                    Complete
                </button>

                <button
                    type="button"
                    class="admin-action-btn"
                    data-action="edit"
                    data-id="${escapeHTML(token.id)}">
                    Edit
                </button>

                <button
                    type="button"
                    class="admin-action-btn"
                    data-action="cancel"
                    data-id="${escapeHTML(token.id)}">
                    Cancel
                </button>
            `;
        } else {
            actionButtons = "-";
        }

        return `
            <tr>
                <td>
                    <strong>${escapeHTML(token.tokenNo || "-")}</strong>
                </td>

                <td>
                    ${escapeHTML(token.studentName || "Unknown")}
                    <br>
                    <small>
                        ${escapeHTML(token.enrollmentNo || "")}
                    </small>
                </td>

                <td>
                    ${escapeHTML(token.service || "-")}
                    <br>
                    <small>${escapeHTML(token.counter || "")}</small>
                </td>

                <td>
                    ${escapeHTML(date)}
                    <br>
                    <small>${escapeHTML(time)}</small>
                </td>

                <td>
                    <span class="badge ${statusClass}">
                        ${escapeHTML(status)}
                    </span>
                </td>

                <td class="no-print">
                    ${actionButtons}
                </td>
            </tr>
        `;
    }).join("");
}


// ==========================================
// 5. UPDATE TOKEN STATUS
// ==========================================

async function changeTokenStatus(id, newStatus) {
    const token = allTokens.find(item => item.id === id);

    if (!token) {
        alert("Token not found.");
        return;
    }

    const messages = {
        in_progress: `Start processing token ${token.tokenNo}?`,
        completed: `Mark token ${token.tokenNo} as completed after verification?`,
        cancelled: `Cancel token ${token.tokenNo}?`
    };

    if (!confirm(messages[newStatus])) return;

    try {
        const tokenRef = doc(db, "tokens", id);

        await runTransaction(db, async (transaction) => {
            const tokenSnap = await transaction.get(tokenRef);

            if (!tokenSnap.exists()) {
                throw new Error("Token not found.");
            }

            const currentToken = tokenSnap.data();

            if (currentToken.status === "cancelled") return;

            if (newStatus === "cancelled" && currentToken.scheduleId) {
                const scheduleRef = doc(db, "schedules", currentToken.scheduleId);
                const scheduleSnap = await transaction.get(scheduleRef);

                if (scheduleSnap.exists()) {
                    const schedule = scheduleSnap.data();
                    const slotCounts = { ...(schedule.slotCounts || {}) };

                    slotCounts[currentToken.slot] = Math.max(
                        0,
                        Number(slotCounts[currentToken.slot] || 0) - 1
                    );

                    transaction.update(scheduleRef, {
                        bookedCount: Math.max(
                            0,
                            Number(schedule.bookedCount || 0) - 1
                        ),
                        slotCounts
                    });
                }
            }

            const changes = { status: newStatus };

            if (newStatus === "completed") {
                changes.completedAt = serverTimestamp();
            }

            transaction.update(tokenRef, changes);
        });

        alert("Token status updated successfully.");

    } catch (error) {
        console.error("Status update error:", error);
        alert("Could not update token status.\n" + error.message);
    }
}


// ==========================================
// 6. EDIT APPOINTMENT DATE AND TIME
// ==========================================

async function editToken(id) {
    const token = allTokens.find(item => item.id === id);

    if (!token) {
        alert("Token not found.");
        return;
    }

    const newDate = prompt(
        "Enter new appointment date (YYYY-MM-DD):",
        token.date || ""
    );

    if (newDate === null) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
        alert("Invalid date format. Use YYYY-MM-DD.");
        return;
    }

    const newSlot = prompt(
        "Enter new time in 24-hour format (HH:MM):",
        token.slot || "10:00"
    );

    if (newSlot === null) return;

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(newSlot)) {
        alert("Invalid time. Example: 14:30");
        return;
    }

    try {
        await updateDoc(doc(db, "tokens", id), {
            date: newDate,
            slot: newSlot
        });

        alert("Appointment updated successfully.");

    } catch (error) {
        console.error("Edit error:", error);

        alert(
            "Could not edit appointment.\n" +
            error.message
        );
    }
}


// ==========================================
// 7. TABLE BUTTON ACTIONS
// ==========================================

tokenBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;

    if (!id) return;

    if (action === "start") {
        await changeTokenStatus(id, "in_progress");
    }

    if (action === "complete") {
        await changeTokenStatus(id, "completed");
    }

    if (action === "cancel") {
        await changeTokenStatus(id, "cancelled");
    }

    if (action === "edit") {
        await editToken(id);
    }
});


// ==========================================
// 8. FILTER EVENTS
// ==========================================

$("filterDate").addEventListener("change", renderTokens);

$("filterService").addEventListener("change", renderTokens);

$("filterStatus").addEventListener("change", renderTokens);


// Reset filters
$("resetFilters").addEventListener("click", () => {
    $("filterDate").value = "";
    $("filterService").value = "";
    $("filterStatus").value = "";

    renderTokens();
});


// ==========================================
// 9. ADD CSV AND PRINT BUTTONS
// ==========================================

const heading = document.querySelector(".section-heading");

if (heading) {
    const reportButtons = document.createElement("div");

    reportButtons.className = "no-print";

    reportButtons.innerHTML = `
        <button type="button" id="csvBtn">
            Download CSV
        </button>

        <button type="button" id="printBtn">
            Print / Save PDF
        </button>
    `;

    heading.appendChild(reportButtons);
}


// Download filtered tokens as CSV
$("csvBtn")?.addEventListener("click", () => {
    const tokens = getFilteredTokens();

    if (!tokens.length) {
        alert("No tokens available to export.");
        return;
    }

    const headings = [
        "Token No",
        "Student Name",
        "Enrollment No",
        "Class",
        "Semester",
        "Course",
        "Service",
        "Counter",
        "Date",
        "Time",
        "Status"
    ];

    const rows = tokens.map(token => [
        token.tokenNo,
        token.studentName,
        token.enrollmentNo,
        token.class,
        token.semester,
        token.course,
        token.service,
        token.counter,
        token.date,
        formatTime(token.slot),
        getStatus(token.status)
    ]);

    const csv = [headings, ...rows]
        .map(row =>
            row.map(value =>
                `"${String(value ?? "").replace(/"/g, '""')}"`
            ).join(",")
        )
        .join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "CMP-Smart-Queue-Report.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
});


// Print or save as PDF
$("printBtn")?.addEventListener("click", () => {
    window.print();
});

// ==========================================
// VERIFICATION SCHEDULE AND LIMITS
// ==========================================

const scheduleForm = $("scheduleForm");

if (scheduleForm) {

    // Block past dates
    $("scheduleDate").min = new Date().toLocaleDateString("en-CA");

    scheduleForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const date = $("scheduleDate").value;
        const selectedClass = $("scheduleClass").value.trim();
        const service = $("scheduleService").value;
        const dailyTarget = Number($("dailyTarget").value);
        const slotCapacity = Number($("slotCapacity").value);

        if (!date || !selectedClass || !service) {
            alert("Please fill all schedule details.");
            return;
        }

        if (dailyTarget < 1 || slotCapacity < 1) {
            alert("Daily target and slot capacity must be at least 1.");
            return;
        }

        if (slotCapacity > dailyTarget) {
            alert("Slot capacity cannot be greater than daily target.");
            return;
        }

        try {

            // Check whether this schedule already exists
            const existingSchedule = await getDocs(
                query(
                    collection(db, "schedules"),
                    where("date", "==", date),
                    where("class", "==", selectedClass),
                    where("service", "==", service)
                )
            );

            if (!existingSchedule.empty) {
                alert("A schedule for this class, date and service already exists.");
                return;
            }

            // Save schedule in Firebase
            await addDoc(collection(db, "schedules"), {

                date: date,
                class: selectedClass,
                service: service,

                dailyTarget: dailyTarget,
                slotCapacity: slotCapacity,

                bookedCount: 0,

                createdAt: serverTimestamp()

            });

            alert("Verification schedule saved successfully!");

            scheduleForm.reset();

            $("scheduleDate").min =
                new Date().toLocaleDateString("en-CA");

        } catch (error) {

            console.error("Schedule save error:", error);

            alert("Could not save schedule: " + error.message);

        }

    });

}

// ==========================================
// 10. LIVE FIRESTORE DATA
// ==========================================

function listenTokens() {
    onSnapshot(
        collection(db, "tokens"),

        snapshot => {
            allTokens = snapshot.docs.map(document => ({
                id: document.id,
                ...document.data()
            }));

            updateStatistics();
            renderTokens();

            console.log(
                "Tokens loaded from Firebase:",
                allTokens.length
            );
        },

        error => {
            console.error("Firestore error:", error);

            tokenBody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-message">
                        Unable to load tokens.
                        Check Firebase permissions.
                    </td>
                </tr>
            `;

            alert(
                "Could not load student tokens.\n" +
                error.message
            );
        }
    );
}


// ==========================================
// 11. ADMIN AUTHENTICATION CHECK
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        location.replace("login.html");
        return;
    }

    try {
        const userSnapshot = await getDoc(doc(db, "users", user.uid));

        if (!userSnapshot.exists()) {
            alert("Admin profile not found.");
            await signOut(auth);
            location.replace("login.html");
            return;
        }

        const userData = userSnapshot.data();
        const role = String(userData.role || "").toLowerCase().trim();

        if (role !== "admin") {
            alert("Access denied. Admins only.");
            location.replace("student.html");
            return;
        }

        document.body.style.display = "block";

        $("adminName").textContent =
            "Logged in as " +
            (userData.name || user.email || "Administrator");

        listenTokens();

    } catch (error) {
        console.error("Admin verification error:", error);
        alert("Could not verify admin access.\n" + error.message);
    }
});

// Logout
$("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    location.replace("login.html");
});