import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    doc,
    getDoc,
    addDoc,
    collection,
    query,
    where,
    getDocs,
    onSnapshot,
    serverTimestamp,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const MAX_PER_SLOT = 5;

let currentUser = null;
let profile = null;
let selectedSchedule = null;

const dateInput = document.getElementById("date");
const slotSelect = document.getElementById("slot");
const serviceSelect = document.getElementById("service");
const scheduledServices = document.getElementById("scheduledServices");

function localDateString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

const todayStr = localDateString();
dateInput.min = todayStr;

function makeSlots() {
    const slots = [];

    for (let m = 570; m < 990; m += 30) {
        if (m === 780) continue;

        const h = Math.floor(m / 60);
        const mm = m % 60;

        slots.push(
            `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
        );
    }

    return slots;
}

function label(slot) {
    if (!slot) return "";

    let [h, m] = slot.split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM";

    h = h % 12 || 12;

    return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

function isPastSlot(date, slot) {
    if (date !== todayStr) return false;

    const [h, m] = slot.split(":").map(Number);
    const now = new Date();

    return h * 60 + m <= now.getHours() * 60 + now.getMinutes();
}

function resetSlots(message = "Select Time Slot") {
    slotSelect.innerHTML = "";

    const option = document.createElement("option");
    option.value = "";
    option.disabled = true;
    option.selected = true;
    option.textContent = message;

    slotSelect.appendChild(option);
}

function getSelectedService() {
    const value = serviceSelect.value;

    if (!value) return null;

    const parts = value.split("|");

    if (parts[0] === "legacy") {
        return {
            type: "legacy",
            service: parts[1],
            counter: parts[2]
        };
    }

    if (parts[0] === "schedule") {
        return {
            type: "schedule",
            scheduleId: parts[1]
        };
    }

    return null;
}

// Load scheduled services for selected date.
// Old six services remain available.
dateInput.addEventListener("change", async () => {
    const date = dateInput.value;

    selectedSchedule = null;
    scheduledServices.innerHTML = "";
    serviceSelect.value = "";
    resetSlots();

    if (!date || !profile) return;

    const day = new Date(date + "T00:00:00").getDay();

    if (day === 0 || day === 6) {
        alert("Verification is available Monday to Friday only.");
        dateInput.value = "";
        return;
    }

    try {
        const snap = await getDocs(collection(db, "schedules"));

        snap.forEach(d => {
            const schedule = d.data();

            if (
                schedule.date === date &&
                schedule.class === profile.class
            ) {
                const option = document.createElement("option");

                option.value = `schedule|${d.id}`;
                option.textContent = schedule.service;

                scheduledServices.appendChild(option);
            }
        });

    } catch (error) {
        console.error("Schedule loading error:", error);
        alert("Could not load schedules: " + error.message);
    }
});

// Load slots for selected service.
serviceSelect.addEventListener("change", async () => {
    selectedSchedule = null;
    resetSlots();

    const selected = getSelectedService();

    if (!selected || !dateInput.value) return;

    try {
        if (selected.type === "schedule") {
            const scheduleSnap = await getDoc(
                doc(db, "schedules", selected.scheduleId)
            );

            if (!scheduleSnap.exists()) {
                alert("Schedule not found.");
                return;
            }

            selectedSchedule = {
                id: scheduleSnap.id,
                ...scheduleSnap.data()
            };

            const counts = selectedSchedule.slotCounts || {};
            const capacity = Number(selectedSchedule.slotCapacity);

            makeSlots().forEach(slot => {
                const used = Number(counts[slot] || 0);
                const full = used >= capacity;
                const past = isPastSlot(dateInput.value, slot);

                const option = document.createElement("option");
                option.value = slot;

                option.textContent = full
                    ? `${label(slot)} (Full)`
                    : `${label(slot)} (${capacity - used} seats left)`;

                option.disabled = full || past;

                slotSelect.appendChild(option);
            });

        } else {
            const snap = await getDocs(
                query(
                    collection(db, "tokens"),
                    where("date", "==", dateInput.value)
                )
            );

            const counts = {};

            snap.forEach(d => {
                const token = d.data();

                if (
                    token.service === selected.service &&
                    token.status !== "cancelled"
                ) {
                    counts[token.slot] = (counts[token.slot] || 0) + 1;
                }
            });

            makeSlots().forEach(slot => {
                const used = counts[slot] || 0;
                const full = used >= MAX_PER_SLOT;
                const past = isPastSlot(dateInput.value, slot);

                const option = document.createElement("option");
                option.value = slot;

                option.textContent = full
                    ? `${label(slot)} (Full)`
                    : `${label(slot)} (${MAX_PER_SLOT - used} seats left)`;

                option.disabled = full || past;

                slotSelect.appendChild(option);
            });
        }

    } catch (error) {
        console.error("Slot loading error:", error);
        alert("Could not load time slots: " + error.message);
    }
});

// Generate token.
document.getElementById("tokenForm").addEventListener("submit", async e => {
    e.preventDefault();

    if (!currentUser || !profile) {
        alert("Please login again.");
        return;
    }

    const date = dateInput.value;
    const slot = slotSelect.value;
    const selected = getSelectedService();

    if (!date || !slot || !selected) {
        alert("Please select service, date and time slot.");
        return;
    }

    try {
        const mySnap = await getDocs(
            query(
                collection(db, "tokens"),
                where("uid", "==", currentUser.uid)
            )
        );

        const duplicate = mySnap.docs.some(d => {
            const t = d.data();

            if (t.status !== "pending") return false;

            return selected.type === "schedule"
                ? t.scheduleId === selected.scheduleId
                : t.service === selected.service;
        });

        if (duplicate) {
            alert("You already have a pending token for this service.");
            return;
        }

        if (selected.type === "legacy") {
            await bookLegacyToken(selected, date, slot);
        } else {
            await bookScheduledToken(selected, date, slot);
        }

    } catch (error) {
        console.error("Token booking error:", error);
        alert("Could not generate token: " + error.message);
    }
});

// Previous services: 5 students per slot.
async function bookLegacyToken(selected, date, slot) {
    const snap = await getDocs(
        query(
            collection(db, "tokens"),
            where("date", "==", date)
        )
    );

    const all = snap.docs.map(d => d.data());

    const count = all.filter(t =>
        t.service === selected.service &&
        t.slot === slot &&
        t.status !== "cancelled"
    ).length;

    if (count >= MAX_PER_SLOT) {
        alert("This slot is full. Please select another slot.");
        return;
    }

    const tokenNo = "T" + String(all.length + 1).padStart(3, "0");

    await addDoc(collection(db, "tokens"), {
        uid: currentUser.uid,
        studentName: profile.name,
        enrollmentNo: profile.enrollmentNo,
        class: profile.class,
        semester: profile.semester,
        course: profile.course,
        service: selected.service,
        counter: selected.counter,
        date,
        slot,
        tokenNo,
        status: "pending",
        createdAt: serverTimestamp()
    });

    alert("Token generated: " + tokenNo);
    document.getElementById("tokenForm").reset();
    selectedSchedule = null;
    resetSlots();
}

// Admin scheduled services: daily target and slot capacity.
async function bookScheduledToken(selected, date, slot) {
    const snap = await getDocs(collection(db, "schedules"));

    const schedules = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s =>
            s.class === profile.class &&
            s.service === selectedSchedule.service &&
            s.date >= date
        )
        .sort((a, b) => a.date.localeCompare(b.date));

    let booked = null;

    for (const schedule of schedules) {
        const scheduleRef = doc(db, "schedules", schedule.id);
        const tokenRef = doc(collection(db, "tokens"));

        try {
            booked = await runTransaction(db, async transaction => {
                const scheduleSnap = await transaction.get(scheduleRef);

                if (!scheduleSnap.exists()) {
                    throw new Error("Schedule not found.");
                }

                const data = scheduleSnap.data();
                const dailyTarget = Number(data.dailyTarget);
                const capacity = Number(data.slotCapacity);
                const bookedCount = Number(data.bookedCount || 0);
                const slotCounts = data.slotCounts || {};

                if (bookedCount >= dailyTarget) {
                    throw new Error("DAILY_FULL");
                }

                const slots = makeSlots();

                const startIndex = schedule.date === date
                    ? slots.indexOf(slot)
                    : 0;

                const availableSlot = slots
                    .slice(Math.max(0, startIndex))
                    .find(s =>
                        Number(slotCounts[s] || 0) < capacity &&
                        !isPastSlot(schedule.date, s)
                    );

                if (!availableSlot) {
                    throw new Error("SLOTS_FULL");
                }

                const nextCounts = {
                    ...slotCounts,
                    [availableSlot]:
                        Number(slotCounts[availableSlot] || 0) + 1
                };

                const nextNumber =
                    Number(data.lastTokenNumber || 0) + 1;

                const tokenNo =
                    "T" + String(nextNumber).padStart(3, "0");

                transaction.update(scheduleRef, {
                    bookedCount: bookedCount + 1,
                    slotCounts: nextCounts,
                    lastTokenNumber: nextNumber
                });

                transaction.set(tokenRef, {
                    uid: currentUser.uid,
                    studentName: profile.name,
                    enrollmentNo: profile.enrollmentNo,
                    class: profile.class,
                    semester: profile.semester,
                    course: profile.course,
                    service: data.service,
                    scheduleId: schedule.id,
                    date: data.date,
                    slot: availableSlot,
                    tokenNo,
                    status: "pending",
                    createdAt: serverTimestamp()
                });

                return {
                    tokenNo,
                    date: data.date,
                    slot: availableSlot
                };
            });

            break;

        } catch (error) {
            if (
                error.message !== "DAILY_FULL" &&
                error.message !== "SLOTS_FULL"
            ) {
                throw error;
            }
        }
    }

    if (!booked) {
        alert("No available slot or future schedule found. Please contact the admin.");
        return;
    }

    alert(
        "Token generated: " + booked.tokenNo +
        "\nDate: " + booked.date +
        "\nTime: " + label(booked.slot)
    );

    document.getElementById("tokenForm").reset();
    selectedSchedule = null;
    resetSlots();
}

// My tokens and live queue.
function listenMyTokens() {
    const allQ = query(
        collection(db, "tokens"),
        where("status", "==", "pending")
    );

    const myQ = query(
        collection(db, "tokens"),
        where("uid", "==", currentUser.uid)
    );

    let allPending = [];
    let myTokens = [];

    function render() {
        const box = document.getElementById("myTokens");

        if (!myTokens.length) {
            box.innerHTML = "<p>No tokens yet.</p>";
            return;
        }

        const list = [...myTokens].sort(
            (a, b) =>
                (b.createdAt?.seconds || 0) -
                (a.createdAt?.seconds || 0)
        );

        box.innerHTML = list.map(t => {
            let live = "";

            if (t.status === "pending") {
                const queue = allPending
                    .filter(x => {
                        if (t.scheduleId) {
                            return x.scheduleId === t.scheduleId;
                        }

                        return x.date === t.date &&
                            x.counter === t.counter;
                    })
                    .sort((a, b) =>
                        a.slot.localeCompare(b.slot) ||
                        (a.createdAt?.seconds || 0) -
                        (b.createdAt?.seconds || 0)
                    );

                const pos = queue.findIndex(x => x.id === t.id);
                const ahead = pos < 0 ? 0 : pos;

                live = `
                    <div class="live-box">
                        Students ahead of you: <b>${ahead}</b><br>
                        Your time: <b>${label(t.slot)}</b>
                    </div>
                `;
            }

            const counterText = t.counter
                ? ` (${t.counter})`
                : "";

            return `
                <div class="token-card">
                    <b>${t.tokenNo}</b> | ${t.service}${counterText}<br>
                    ${t.date} | ${label(t.slot)}<br>
                    Status: <b>${t.status}</b>
                    ${live}
                    ${t.status === "pending"
                        ? `<button data-id="${t.id}" class="cancelBtn">Cancel</button>`
                        : ""}
                </div>
            `;
        }).join("");

        box.querySelectorAll(".cancelBtn").forEach(button => {
            button.addEventListener("click", async () => {
                if (!confirm("Do you want to cancel this token?")) return;

                try {
                    const tokenRef = doc(
                        db,
                        "tokens",
                        button.dataset.id
                    );

                    await runTransaction(db, async transaction => {
                        const tokenSnap = await transaction.get(tokenRef);

                        if (!tokenSnap.exists()) return;

                        const token = tokenSnap.data();

                        if (token.status !== "pending") return;

                        if (token.scheduleId) {
                            const scheduleRef = doc(
                                db,
                                "schedules",
                                token.scheduleId
                            );

                            const scheduleSnap =
                                await transaction.get(scheduleRef);

                            if (scheduleSnap.exists()) {
                                const schedule = scheduleSnap.data();
                                const slotCounts = {
                                    ...(schedule.slotCounts || {})
                                };

                                slotCounts[token.slot] = Math.max(
                                    0,
                                    Number(slotCounts[token.slot] || 0) - 1
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

                        transaction.update(tokenRef, {
                            status: "cancelled"
                        });
                    });

                    alert("Token cancelled successfully.");

                } catch (error) {
                    console.error("Cancellation error:", error);
                    alert("Could not cancel token: " + error.message);
                }
            });
        });
    }

    onSnapshot(allQ, snap => {
        allPending = snap.docs.map(d => ({
            id: d.id,
            ...d.data()
        }));

        render();
    });

    onSnapshot(myQ, snap => {
        myTokens = snap.docs.map(d => ({
            id: d.id,
            ...d.data()
        }));

        render();
    });
}

// Login check.
onAuthStateChanged(auth, async user => {
    if (!user) {
        location.href = "login.html";
        return;
    }

    try {
        currentUser = user;

        const profileSnap = await getDoc(
            doc(db, "users", user.uid)
        );

        if (!profileSnap.exists()) {
            alert("Student profile not found.");
            await signOut(auth);
            location.href = "login.html";
            return;
        }

        profile = profileSnap.data();

        document.getElementById("studentName").textContent =
            profile.name || "";

        document.getElementById("studentInfo").textContent =
            `${profile.class || ""} | Sem ${profile.semester || ""} | ${profile.course || ""} | Enroll: ${profile.enrollmentNo || ""}`;

        listenMyTokens();

    } catch (error) {
        console.error("Student profile error:", error);
        alert("Could not load student profile: " + error.message);
    }
});

// Logout.
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
        location.href = "login.html";
    });
}