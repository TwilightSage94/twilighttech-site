/* Twilight Tech visual playground
   Direct browser JavaScript keeps this static experiment build-step free. */
(() => {
  "use strict";

  const body = document.body;
  if (!body.classList.contains("visual-playground")) return;

  const stageData = {
    enter: {
      label: "ENTER",
      systemLabel: "Enter",
      eyebrow: "Stage 01 // Access",
      title: "Enter the system.",
      copy: "Learn by operating smaller, realistic systems. Build confidence through guided work, visible consequences, and proof you can explain.",
      href: "/guides/",
      link: "Explore the guides",
      status: "Learning route online"
    },
    sustain: {
      label: "SUSTAIN",
      systemLabel: "Sustain",
      eyebrow: "Stage 02 // Stability",
      title: "Keep the system alive.",
      copy: "Operate, document, secure, troubleshoot, and recover the technology people already depend on without turning every fix into a new problem.",
      href: "/managed-it/",
      link: "Explore managed technology",
      status: "Operations route stable"
    },
    further: {
      label: "FURTHER",
      systemLabel: "Further",
      eyebrow: "Stage 03 // Possibility",
      title: "Extend the system.",
      copy: "Build private AI, automation, labs, and new software on top of foundations that already know how to survive real use.",
      href: "/ai/",
      link: "Explore private AI",
      status: "R&D route unlocked"
    }
  };

  const tabs = [...document.querySelectorAll("[data-stage]")];
  const cards = [...document.querySelectorAll("[data-stage-card]")];
  const jumpButton = document.querySelector("[data-stage-jump]");
  const consolePanel = document.querySelector("[data-stage-console]");
  const stageLabel = document.querySelector("[data-stage-label]");
  const stageEyebrow = document.querySelector("[data-stage-eyebrow]");
  const stageTitle = document.querySelector("[data-stage-title]");
  const stageCopy = document.querySelector("[data-stage-copy]");
  const stageLink = document.querySelector("[data-stage-link]");
  const stageStatus = document.querySelector("[data-stage-status]");
  const systemStage = document.querySelector("[data-system-stage]");

  let activeStage = body.dataset.visualStage || "enter";
  let switchTimer = 0;

  function setStage(stage, { focusTab = false } = {}) {
    const next = stageData[stage];
    if (!next) return;

    activeStage = stage;
    body.dataset.visualStage = stage;

    tabs.forEach(tab => {
      const isActive = tab.dataset.stage === stage;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
      if (isActive && focusTab) tab.focus();
    });

    cards.forEach(card => {
      card.classList.toggle("is-active", card.dataset.stageCard === stage);
    });

    if (stageLabel) stageLabel.textContent = next.label;
    if (stageEyebrow) stageEyebrow.textContent = next.eyebrow;
    if (stageTitle) stageTitle.textContent = next.title;
    if (stageCopy) stageCopy.textContent = next.copy;
    if (stageLink) {
      stageLink.href = next.href;
      stageLink.firstChild.textContent = `${next.link} `;
    }
    if (stageStatus) stageStatus.textContent = next.status;
    if (systemStage) systemStage.textContent = next.systemLabel;

    if (consolePanel) {
      consolePanel.classList.add("is-switching");
      window.clearTimeout(switchTimer);
      switchTimer = window.setTimeout(() => {
        consolePanel.classList.remove("is-switching");
      }, 170);
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => setStage(tab.dataset.stage));
    tab.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const currentIndex = tabs.indexOf(tab);
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
      setStage(tabs[nextIndex].dataset.stage, { focusTab: true });
    });
  });

  cards.forEach(card => {
    const stage = card.dataset.stageCard;
    card.addEventListener("mouseenter", () => setStage(stage));
    card.addEventListener("focus", () => setStage(stage));
    card.addEventListener("click", event => {
      if (event.target.closest("a")) return;
      setStage(stage);
      consolePanel?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    card.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      setStage(stage);
      consolePanel?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  jumpButton?.addEventListener("click", () => {
    const order = ["enter", "sustain", "further"];
    const currentIndex = order.indexOf(activeStage);
    const nextStage = order[(currentIndex + 1) % order.length];
    setStage(nextStage);
  });

  const overlay = document.querySelector("[data-system-overlay]");
  const openButtons = [...document.querySelectorAll("[data-open-system]")];
  const closeButtons = [...document.querySelectorAll("[data-close-system]")];
  const closeControl = overlay?.querySelector(".system-close");
  let previouslyFocused = null;

  function openSystem() {
    if (!overlay) return;
    previouslyFocused = document.activeElement;
    overlay.hidden = false;
    body.classList.add("system-open");
    closeControl?.focus();
  }

  function closeSystem() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    body.classList.remove("system-open");
    previouslyFocused?.focus?.();
  }

  openButtons.forEach(button => button.addEventListener("click", openSystem));
  closeButtons.forEach(button => button.addEventListener("click", closeSystem));

  window.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSystem();
    if (event.shiftKey && event.key.toLowerCase() === "a") {
      event.preventDefault();
      if (overlay?.hidden) openSystem();
      else closeSystem();
    }
  });

  const hero = document.querySelector(".visual-hero");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  hero?.addEventListener("pointermove", event => {
    if (reduceMotion.matches) return;
    const rect = hero.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    body.style.setProperty("--pointer-x", `${x.toFixed(2)}%`);
    body.style.setProperty("--pointer-y", `${y.toFixed(2)}%`);
  });

  hero?.addEventListener("pointerleave", () => {
    body.style.setProperty("--pointer-x", "50%");
    body.style.setProperty("--pointer-y", "34%");
  });

  const mobileToggle = document.querySelector(".mob-tog");
  const navLinks = document.querySelector(".nav-links");
  mobileToggle?.addEventListener("click", () => {
    const expanded = navLinks?.classList.contains("open") || false;
    mobileToggle.setAttribute("aria-expanded", String(expanded));
  });

  setStage(activeStage);
})();
