/* Twilight Tech three-gate experiment.
   Plain browser JavaScript controls stage state and a responsive canvas starfield. */
(() => {
  "use strict";

  const body = document.body;
  if (!body.classList.contains("visual-gateway")) return;

  const stageData = {
    enter: {
      mode: "Enter",
      eyebrow: "Stage 01 // Access",
      title: "Enter Technology",
      copy: "Learn by operating realistic systems, then turn that work into confidence and proof.",
      routes: [
        { label: "Guides", href: "/guides/", primary: true },
        { label: "Homelab Starter", href: "/homelab-starter/" },
        { label: "Career Roadmap", href: "/roadmap/" }
      ]
    },
    sustain: {
      mode: "Sustain",
      eyebrow: "Stage 02 // Stability",
      title: "Sustain Technology",
      copy: "Keep people working, systems documented, and operations protected with practical support.",
      routes: [
        { label: "Managed IT", href: "/managed-it/", primary: true },
        { label: "Services", href: "/services/" },
        { label: "Front Desk", href: "/site-chat/" }
      ]
    },
    further: {
      mode: "Further",
      eyebrow: "Stage 03 // Possibility",
      title: "Further Technology",
      copy: "Build private AI, automation, and experimental systems on foundations designed to survive real use.",
      routes: [
        { label: "Private AI", href: "/ai/", primary: true },
        { label: "AI Operations", href: "/ai/operations/" },
        { label: "Twilight Labs", href: "/labs/" }
      ]
    }
  };

  const choices = [...document.querySelectorAll("[data-gateway-choice]")];
  const drawer = document.querySelector("[data-route-drawer]");
  const routeEyebrow = document.querySelector("[data-route-eyebrow]");
  const routeTitle = document.querySelector("[data-route-title]");
  const routeCopy = document.querySelector("[data-route-copy]");
  const routeLinks = document.querySelector("[data-route-links]");
  const closeButton = document.querySelector("[data-route-close]");
  const modeReadout = document.querySelector("[data-gateway-mode]");
  const hero = document.querySelector(".gateway-hero");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let previewStage = "idle";
  let lockedStage = null;
  let starfield;

  function updateChoiceState(stage) {
    choices.forEach(choice => {
      const active = choice.dataset.gatewayChoice === stage;
      choice.classList.toggle("is-active", active);
      choice.setAttribute("aria-expanded", String(active && lockedStage === stage));
    });
  }

  function setVisualStage(stage) {
    previewStage = stage;
    body.dataset.gatewayStage = stage;
    updateChoiceState(stage);
    modeReadout.textContent = stage === "idle" ? "Idle" : stageData[stage].mode;
    starfield?.setMode(stage, getStageTarget(stage));
  }

  function getStageTarget(stage) {
    const choice = choices.find(item => item.dataset.gatewayChoice === stage);
    if (!choice) return { x: 0.5, y: 0.5 };
    const rect = choice.getBoundingClientRect();
    return {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight
    };
  }

  function populateDrawer(stage) {
    const data = stageData[stage];
    routeEyebrow.textContent = data.eyebrow;
    routeTitle.textContent = data.title;
    routeCopy.textContent = data.copy;
    routeLinks.replaceChildren();

    data.routes.forEach(route => {
      const link = document.createElement("a");
      link.className = `route-link${route.primary ? " primary" : ""}`;
      link.href = route.href;
      link.textContent = route.label;
      link.addEventListener("click", event => {
        event.preventDefault();
        beginRoute(route.href);
      });
      routeLinks.appendChild(link);
    });
  }

  function lockStage(stage) {
    lockedStage = stage;
    body.classList.add("has-locked-stage");
    populateDrawer(stage);
    drawer.hidden = false;
    setVisualStage(stage);
    window.requestAnimationFrame(() => {
      const firstLink = routeLinks.querySelector("a");
      firstLink?.focus({ preventScroll: true });
    });
  }

  function unlockStage({ restoreFocus = false } = {}) {
    const previous = lockedStage;
    lockedStage = null;
    body.classList.remove("has-locked-stage");
    drawer.hidden = true;
    setVisualStage("idle");
    if (restoreFocus && previous) {
      choices.find(item => item.dataset.gatewayChoice === previous)?.focus();
    }
  }

  function beginRoute(href) {
    if (body.classList.contains("is-routing")) return;
    body.classList.add("is-routing");
    starfield.burst();
    window.setTimeout(() => {
      window.location.href = href;
    }, reducedMotion.matches ? 0 : 430);
  }

  choices.forEach((choice, index) => {
    const stage = choice.dataset.gatewayChoice;

    choice.addEventListener("pointerenter", () => {
      if (!lockedStage) setVisualStage(stage);
    });

    choice.addEventListener("pointerleave", () => {
      if (!lockedStage) setVisualStage("idle");
    });

    choice.addEventListener("focus", () => {
      if (!lockedStage) setVisualStage(stage);
    });

    choice.addEventListener("blur", () => {
      if (!lockedStage && !choice.matches(":hover")) setVisualStage("idle");
    });

    choice.addEventListener("click", () => {
      if (lockedStage === stage) {
        const primary = stageData[stage].routes.find(route => route.primary);
        if (primary) beginRoute(primary.href);
        return;
      }
      lockStage(stage);
    });

    choice.addEventListener("keydown", event => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const direction = ["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1;
      const next = choices[(index + direction + choices.length) % choices.length];
      next.focus();
    });
  });

  closeButton?.addEventListener("click", () => unlockStage({ restoreFocus: true }));

  window.addEventListener("keydown", event => {
    if (event.key === "Escape" && lockedStage) unlockStage({ restoreFocus: true });
  });

  hero?.addEventListener("pointermove", event => {
    if (reducedMotion.matches) return;
    const rect = hero.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    body.style.setProperty("--gateway-pointer-x", `${x.toFixed(2)}%`);
    body.style.setProperty("--gateway-pointer-y", `${y.toFixed(2)}%`);
    starfield.setPointer(event.clientX / window.innerWidth, event.clientY / window.innerHeight);
  });

  hero?.addEventListener("pointerleave", () => {
    body.style.setProperty("--gateway-pointer-x", "50%");
    body.style.setProperty("--gateway-pointer-y", "48%");
    starfield.setPointer(0.5, 0.5);
  });

  function createStarfield(canvas) {
    const context = canvas.getContext("2d", { alpha: true });
    const dprLimit = 2;
    let dpr = 1;
    let width = 0;
    let height = 0;
    let mode = "idle";
    let target = { x: 0.5, y: 0.5 };
    let pointer = { x: 0.5, y: 0.5 };
    let burstEnergy = 0;
    let lastTime = performance.now();

    const palette = {
      idle: [0, 240, 255],
      enter: [0, 240, 255],
      sustain: [57, 255, 20],
      further: [255, 0, 229]
    };

    const stars = Array.from({ length: 165 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.000055,
      vy: -(0.00003 + Math.random() * 0.00007),
      radius: 0.45 + Math.random() * 1.35,
      depth: 0.25 + Math.random() * 0.75,
      phase: Math.random() * Math.PI * 2,
      twinkle: 0.006 + Math.random() * 0.018,
      tint: Math.random()
    }));

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, dprLimit);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function wrap(star) {
      if (star.x < -0.04) star.x = 1.04;
      if (star.x > 1.04) star.x = -0.04;
      if (star.y < -0.04) star.y = 1.04;
      if (star.y > 1.04) star.y = -0.04;
    }

    function update(star, dt) {
      star.phase += star.twinkle * dt;
      const dx = target.x - star.x;
      const dy = target.y - star.y;

      if (mode === "enter") {
        star.vx += dx * 0.0000017 * dt;
        star.vy += dy * 0.00000065 * dt;
        star.vx += 0.00000035 * dt;
      } else if (mode === "sustain") {
        star.vx += dx * 0.00000045 * dt;
        star.vy += dy * 0.00000045 * dt;
        star.vx *= Math.pow(0.996, dt);
        star.vy *= Math.pow(0.996, dt);
      } else if (mode === "further") {
        const distance = Math.max(0.035, Math.hypot(dx, dy));
        star.vx += (-dy / distance) * 0.0000014 * dt;
        star.vy += (dx / distance) * 0.0000014 * dt;
        star.vx += dx * 0.00000022 * dt;
        star.vy += dy * 0.00000022 * dt;
      } else {
        star.vx += (pointer.x - 0.5) * 0.00000008 * star.depth * dt;
        star.vy -= 0.000000015 * star.depth * dt;
      }

      if (burstEnergy > 0) {
        const distance = Math.max(0.04, Math.hypot(dx, dy));
        star.vx += (dx / distance) * burstEnergy * 0.000006 * dt;
        star.vy += (dy / distance) * burstEnergy * 0.000006 * dt;
      }

      const speedLimit = mode === "further" ? 0.00135 : 0.00082;
      const speed = Math.hypot(star.vx, star.vy);
      if (speed > speedLimit) {
        star.vx = (star.vx / speed) * speedLimit;
        star.vy = (star.vy / speed) * speedLimit;
      }

      star.x += star.vx * dt;
      star.y += star.vy * dt;
      wrap(star);
    }

    function drawConnections(color) {
      if (mode !== "sustain") return;
      const maxDistance = Math.min(116, width * 0.09);
      context.lineWidth = 0.65;

      for (let i = 0; i < stars.length; i += 1) {
        const a = stars[i];
        if (a.depth < 0.55) continue;
        for (let j = i + 1; j < stars.length; j += 1) {
          const b = stars[j];
          if (b.depth < 0.55) continue;
          const ax = a.x * width;
          const ay = a.y * height;
          const bx = b.x * width;
          const by = b.y * height;
          const distance = Math.hypot(ax - bx, ay - by);
          if (distance > maxDistance) continue;
          const alpha = (1 - distance / maxDistance) * 0.12;
          context.strokeStyle = `rgba(${color.join(",")},${alpha})`;
          context.beginPath();
          context.moveTo(ax, ay);
          context.lineTo(bx, by);
          context.stroke();
        }
      }
    }

    function draw(time) {
      const dt = Math.min(2.2, (time - lastTime) / 16.667);
      lastTime = time;
      context.clearRect(0, 0, width, height);

      const color = palette[mode] || palette.idle;
      drawConnections(color);

      stars.forEach(star => {
        update(star, dt);
        const x = star.x * width;
        const y = star.y * height;
        const pulse = 0.58 + Math.sin(star.phase) * 0.36;
        const alpha = (0.18 + star.depth * 0.64) * pulse;
        const radius = star.radius * (0.65 + star.depth * 0.85);

        let starColor = color;
        if (mode === "idle" && star.tint > 0.84) {
          starColor = star.tint > 0.94 ? palette.further : palette.sustain;
        }

        context.shadowBlur = radius > 1.4 ? 8 : 4;
        context.shadowColor = `rgba(${starColor.join(",")},.8)`;
        context.fillStyle = `rgba(${starColor.join(",")},${alpha})`;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      });

      context.shadowBlur = 0;
      burstEnergy *= 0.925;
      window.requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize);
    resize();
    window.requestAnimationFrame(draw);

    return {
      setMode(nextMode, nextTarget) {
        mode = nextMode;
        target = nextTarget || target;
      },
      setPointer(x, y) {
        pointer = { x, y };
      },
      burst() {
        burstEnergy = 1;
      }
    };
  }

  const canvas = document.getElementById("gateway-stars");
  starfield = createStarfield(canvas);

  window.addEventListener("resize", () => {
    if (previewStage !== "idle") starfield.setMode(previewStage, getStageTarget(previewStage));
  });

  setVisualStage("idle");
})();
