document.addEventListener("DOMContentLoaded", function () {
    console.log("CMP Smart Queue homepage loaded.");

    // Get homepage elements
    const tokenButton = document.querySelector(".primary-btn");
    const loginButton = document.querySelector(".secondary-btn");
    const aboutLink = document.querySelector('a[href="#about"]');
    const collegeImage = document.querySelector(".hero-image > img");

    // Get three-dot menu elements
    const menuBtn = document.getElementById("menuBtn");
    const optionsMenu = document.getElementById("optionsMenu");
    const menuOverlay = document.getElementById("menuOverlay");
    const menuClose = document.getElementById("menuClose");

    // Open registration page
    if (tokenButton) {
        tokenButton.addEventListener("click", function (event) {
            event.preventDefault();
            window.location.href = "register.html";
        });
    }

    // Open login page
    if (loginButton) {
        loginButton.addEventListener("click", function (event) {
            event.preventDefault();
            window.location.href = "login.html";
        });
    }

    // Smooth scroll to About section
    if (aboutLink) {
        aboutLink.addEventListener("click", function (event) {
            const aboutSection = document.getElementById("about");

            if (aboutSection) {
                event.preventDefault();

                aboutSection.scrollIntoView({
                    behavior: "smooth"
                });
            }
        });
    }

    // College image hover effect
    if (collegeImage) {
        collegeImage.addEventListener("mouseenter", function () {
            collegeImage.style.transition = "transform 0.3s ease";
            collegeImage.style.transform = "scale(1.02)";
        });

        collegeImage.addEventListener("mouseleave", function () {
            collegeImage.style.transform = "scale(1)";
        });
    }

    // Open three-dot side menu
    function openMenu() {
        if (!optionsMenu || !menuOverlay || !menuBtn) return;

        optionsMenu.classList.add("open");
        menuOverlay.classList.add("show");

        menuBtn.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
    }

    // Close three-dot side menu
    function closeMenu() {
        if (!optionsMenu || !menuOverlay || !menuBtn) return;

        optionsMenu.classList.remove("open");
        menuOverlay.classList.remove("show");

        menuBtn.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
    }

    // Three-dot button click
    if (menuBtn) {
        menuBtn.addEventListener("click", function () {
            if (optionsMenu && optionsMenu.classList.contains("open")) {
                closeMenu();
            } else {
                openMenu();
            }
        });
    }

    // Close menu using the close button
    if (menuClose) {
        menuClose.addEventListener("click", closeMenu);
    }

    // Close menu by clicking outside
    if (menuOverlay) {
        menuOverlay.addEventListener("click", closeMenu);
    }

    // Close menu after clicking a navigation link
    if (optionsMenu) {
        optionsMenu.querySelectorAll(".menu-items a").forEach(function (link) {
            link.addEventListener("click", closeMenu);
        });
    }

    // Close menu using the Escape key
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeMenu();
        }
    });
});