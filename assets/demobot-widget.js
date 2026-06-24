/* ============================================================================
 * J-Bot Demo — live console widget for twilighttech.io/ai
 * Talks to the sandboxed DemoBot endpoint (POST /demobot/chat, /demobot/lead).
 *
 * Namespaced `jbd-` throughout so it never collides with site.js globals
 * (#global-particles, #particles, .reveal, .mob-tog, .cat-tab).
 *
 * Security notes:
 *   - All message text is rendered through jbdSafe() — HTML-escaped, then a
 *     tiny safe markdown subset (bold + https links only). No raw HTML from
 *     the model ever touches innerHTML.
 *   - Session id is a client UUID in localStorage; the server hashes IPs.
 * ==========================================================================*/
(function () {
  "use strict";

  var root = document.querySelector(".jbd");
  if (!root) return;

  var API_BASE = (root.getAttribute("data-api-base") || "/demobot").replace(/\/$/, "");
  var TURNSTILE_SITEKEY = root.getAttribute("data-turnstile-sitekey") || "";

  var logEl = root.querySelector("#jbd-log");
  var formEl = root.querySelector("#jbd-form");
  var inputEl = root.querySelector("#jbd-text");
  var sendEl = root.querySelector("#jbd-send");
  var suggestEl = root.querySelector("#jbd-suggest");
  var leadEl = root.querySelector("#jbd-lead");
  var leadFormEl = root.querySelector("#jbd-lead-form");
  var turnstileEl = root.querySelector("#jbd-turnstile");
  var muteEl = root.querySelector("#jbd-mute");

  var sessionId = getOrMakeSession();
  var turnstileToken = "";
  var leadShown = false;
  var busy = false;
  var soundOn = true;
  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Session ───────────────────────────────────────────────────────────────
  function getOrMakeSession() {
    var key = "jbd_session";
    var v = "";
    try { v = localStorage.getItem(key) || ""; } catch (e) {}
    if (!v) {
      v = (window.crypto && window.crypto.randomUUID)
        ? window.crypto.randomUUID()
        : "jbd-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      try { localStorage.setItem(key, v); } catch (e) {}
    }
    return v;
  }

  function utmSource() {
    try {
      var p = new URLSearchParams(window.location.search);
      return p.get("utm_source") || "ai_page";
    } catch (e) { return "ai_page"; }
  }

  // ── Safe rendering (no raw model HTML) ─────────────────────────────────────
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function jbdSafe(text) {
    var safe = escapeHtml(text);
    // Markdown links [label](https://…) — https only.
    safe = safe.replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, function (_m, label, url) {
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + "</a>";
    });
    // Bold **x**
    safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // Newlines → <br>
    safe = safe.replace(/\n/g, "<br>");
    return safe;
  }

  // ── Sound: soft blip on tool call ──────────────────────────────────────────
  var audioCtx = null;
  function ping() {
    if (!soundOn || reduceMotion) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(880, audioCtx.currentTime);
      o.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.08);
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.06, audioCtx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
  }

  // ── Message rendering ──────────────────────────────────────────────────────
  function addMsg(role, html, opts) {
    opts = opts || {};
    var row = document.createElement("div");
    row.className = "jbd-msg jbd-" + role + (opts.refused ? " jbd-refused" : "");
    var who = document.createElement("div");
    who.className = "jbd-who";
    who.textContent = role === "user" ? "YOU" : "J-BOT DEMO";
    var bub = document.createElement("div");
    bub.className = "jbd-bub";
    bub.innerHTML = html;
    row.appendChild(who); row.appendChild(bub);
    logEl.appendChild(row);
    scrollLog();
    return row;
  }

  function addToolChips(tools) {
    if (!tools || !tools.length) return;
    var wrap = document.createElement("div");
    wrap.className = "jbd-tools";
    tools.forEach(function (t, i) {
      var chip = document.createElement("span");
      chip.className = "jbd-chip";
      chip.textContent = "▸ " + t;
      wrap.appendChild(chip);
      if (!reduceMotion) {
        chip.style.animationDelay = (i * 110) + "ms";
        setTimeout(ping, i * 110);
      } else { ping(); }
    });
    logEl.appendChild(wrap);
    scrollLog();
  }

  var typingRow = null;
  function showTyping() {
    typingRow = document.createElement("div");
    typingRow.className = "jbd-msg jbd-bot jbd-typing-row";
    typingRow.innerHTML =
      '<div class="jbd-who">J-BOT DEMO</div>' +
      '<div class="jbd-bub"><span class="jbd-typing"><i></i><i></i><i></i></span></div>';
    logEl.appendChild(typingRow);
    scrollLog();
  }
  function hideTyping() {
    if (typingRow && typingRow.parentNode) typingRow.parentNode.removeChild(typingRow);
    typingRow = null;
  }

  function scrollLog() { logEl.scrollTop = logEl.scrollHeight; }

  // ── Networking ─────────────────────────────────────────────────────────────
  function send(message) {
    if (busy || !message.trim()) return;
    busy = true;
    setBusy(true);
    if (suggestEl) suggestEl.classList.add("jbd-hidden");
    addMsg("user", jbdSafe(message));
    showTyping();

    var payload = {
      session_id: sessionId,
      message: message,
      utm_source: utmSource()
    };
    if (turnstileToken) payload.turnstile_token = turnstileToken;

    fetch(API_BASE + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (res) {
        hideTyping();
        var b = res.body || {};
        if (res.status >= 400) {
          var detail = b.detail || b.error || "Something went sideways.";
          var extra = b.book_url
            ? ' <a href="' + b.book_url + '" target="_blank" rel="noopener">Book a call →</a>'
            : "";
          addMsg("bot", jbdSafe(detail) + extra, { refused: true });
        } else {
          if (b.tools_used && b.tools_used.length) addToolChips(b.tools_used);
          addMsg("bot", jbdSafe(b.text || ""), { refused: !!b.refused });
          if (b.suggest_lead_form && !leadShown) revealLead();
        }
      })
      .catch(function () {
        hideTyping();
        addMsg("bot",
          "I couldn't reach the server just now. Try again, or " +
          '<a href="https://calendar.app.google/SnNJnQnkfpavbuvU9" target="_blank" rel="noopener">book a demo →</a>.',
          { refused: true });
      })
      .then(function () { busy = false; setBusy(false); inputEl.focus(); });
  }

  function setBusy(on) {
    inputEl.disabled = on;
    sendEl.disabled = on;
    sendEl.textContent = on ? "…" : "SEND";
  }

  // ── Lead form ──────────────────────────────────────────────────────────────
  function revealLead() {
    if (!leadEl || leadShown) return;
    leadShown = true;
    leadEl.hidden = false;
    if (!reduceMotion) leadEl.classList.add("jbd-pop");
    scrollLog();
  }

  if (leadFormEl) {
    leadFormEl.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = {
        session_id: sessionId,
        name: leadFormEl.querySelector('[name="name"]').value,
        email: leadFormEl.querySelector('[name="email"]').value,
        business: leadFormEl.querySelector('[name="business"]').value,
        use_case: leadFormEl.querySelector('[name="use_case"]').value,
        utm_source: utmSource()
      };
      var btn = leadFormEl.querySelector("button");
      btn.disabled = true; btn.textContent = "Sending…";
      fetch(API_BASE + "/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
        .then(function (r) { return r.json(); })
        .then(function () {
          leadEl.innerHTML =
            '<div class="jbd-lead-done">Got it — James will reach out personally. ' +
            "In the meantime, keep poking at the demo.</div>";
        })
        .catch(function () {
          btn.disabled = false; btn.textContent = "Send";
          alert("Couldn't send right now — email james@twilighttech.io directly.");
        });
    });
  }

  // ── Suggestion chips ───────────────────────────────────────────────────────
  if (suggestEl) {
    suggestEl.addEventListener("click", function (e) {
      var c = e.target.closest(".jbd-starter");
      if (c) send(c.getAttribute("data-q") || c.textContent);
    });
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  formEl.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = inputEl.value;
    inputEl.value = "";
    send(v);
  });

  if (muteEl) {
    muteEl.addEventListener("click", function () {
      soundOn = !soundOn;
      muteEl.setAttribute("aria-pressed", String(!soundOn));
      muteEl.textContent = soundOn ? "🔊" : "🔇";
    });
  }

  // ── Turnstile ──────────────────────────────────────────────────────────────
  // When a sitekey is configured, render the invisible challenge and stash the
  // token for the first /chat call. Without a sitekey (local dev), the server
  // is fail-open, so we proceed without a token.
  window.jbdTurnstileCallback = function (token) { turnstileToken = token; };
  if (TURNSTILE_SITEKEY && turnstileEl) {
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true; s.defer = true;
    document.head.appendChild(s);
    turnstileEl.className = "cf-turnstile";
    turnstileEl.setAttribute("data-sitekey", TURNSTILE_SITEKEY);
    turnstileEl.setAttribute("data-callback", "jbdTurnstileCallback");
    turnstileEl.setAttribute("data-theme", "dark");
    turnstileEl.setAttribute("data-size", "flexible");
  }

  // ── Greeting ───────────────────────────────────────────────────────────────
  addMsg("bot", jbdSafe(
    "Hey — I'm **J-Bot**, live on this page. I'm sandboxed here (fake data, can't touch " +
    "real accounts), but I'm the same agent James builds into businesses — running on " +
    "their real calendar, inbox, and tickets. Try one of these, or ask me anything:"
  ));
})();
