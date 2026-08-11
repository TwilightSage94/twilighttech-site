(function () {
  'use strict';

  var OPEN_KEY = 'tt_jbot_open_v1';
  var ASSET_VERSION = '20260810-deterministic';

  function trackWidgetEvent(name, props) {
    if (typeof window.plausible !== 'function') return;
    window.plausible(name, props ? { props: props } : undefined);
  }

  var LANES = [
    { slug: 'private-ai', icon: 'AI', label: 'Private AI', detail: 'Sensitive document systems', className: 'private' },
    { slug: 'site-chat', icon: 'IN', label: 'Website Front Desk', detail: 'Guided site intake', className: 'intake' },
    { slug: 'system-care', icon: 'SYS', label: 'System Care', detail: 'Support and cleanup', className: 'system' },
    { slug: 'guides', icon: 'PDF', label: 'Guides', detail: 'Learning and free resources', className: 'guides' },
    { slug: 'breakroom', icon: 'BR', label: 'BreakRoom', detail: 'Community', className: 'breakroom' },
    { slug: 'aptsu', icon: 'UP', label: 'A Place To Show Up', detail: 'Community platform', className: 'aptsu' }
  ];

  function pageContext() {
    var path = window.location.pathname.toLowerCase();

    if (path.indexOf('/site-chat') === 0) {
      return {
        lane: 'site-chat',
        label: 'Website Front Desk',
        step: 'Explore the guided build',
        message: 'You are looking at the Front Desk itself. I can show you what it does, what ships, or help you leave James a clean build note.'
      };
    }
    if (path.indexOf('/ai') === 0) {
      return {
        lane: 'private-ai',
        label: 'Private AI',
        step: 'Explore private systems',
        message: 'You are in the Private AI wing. I can show you the approved offers, open the working demo, or help you leave James a high-level fit note.'
      };
    }
    if (path.indexOf('/services') === 0 || path.indexOf('/managed-it') === 0) {
      return {
        lane: 'system-care',
        label: 'Services',
        step: 'Find the right service',
        message: 'You are looking at Twilight Tech services. I can route a support need, show the service catalog, or prepare a direct note for James.'
      };
    }
    if (path.indexOf('/guides') === 0 || path.indexOf('/cheat-sheet') === 0 || path.indexOf('/homelab-starter') === 0 || path.indexOf('/roadmap') === 0 || path.indexOf('/strategy') === 0 || path.indexOf('/labs') === 0) {
      return {
        lane: 'guides',
        label: 'Guides',
        step: 'Find a learning path',
        message: 'You are in the learning lane. I can open the right guide or free resource, point you toward the BreakRoom, or take a note for James.'
      };
    }
    if (path.indexOf('/about') === 0) {
      return {
        lane: '',
        label: 'About Twilight Tech',
        step: 'Choose where you are headed',
        message: 'You are reading the founder story. I can route you toward learning, business support, private AI, or a direct note to James.'
      };
    }
    return {
      lane: '',
      label: 'Twilight Tech',
      step: 'Choose where you are headed',
      message: 'I can route you toward learning, business support, Private AI, the BreakRoom, A Place To Show Up, or a direct note to James.'
    };
  }

  function faceMarkup() {
    return '<span class="jbot-face" aria-hidden="true"><span class="jbot-ant"></span><span class="jbot-eye left"></span><span class="jbot-eye right"></span></span>';
  }

  function quickMarkup(contextLane) {
    var ordered = LANES.slice().sort(function (a, b) {
      if (a.slug === contextLane) return -1;
      if (b.slug === contextLane) return 1;
      return 0;
    });

    return ordered.map(function (lane) {
      var contextClass = lane.slug === contextLane ? ' context' : '';
      return '<button type="button" class="quick ' + lane.className + contextClass + '" data-jbot-lane="' + lane.slug + '">' +
        '<span class="ico">' + lane.icon + '</span>' +
        '<span class="quick-copy"><strong>' + lane.label + '</strong><small>' + lane.detail + '</small></span>' +
        (contextClass ? '<span class="quick-context">On this page</span>' : '') +
      '</button>';
    }).join('');
  }

  function widgetMarkup(context) {
    return '<section class="jbot-widget" id="jbot-widget" data-jbot-default-lane="' + context.lane + '" data-jbot-stage="idle" aria-label="Twilight Tech front desk">' +
      '<div class="jbot-panel" id="jbot-panel" role="dialog" aria-modal="false" aria-labelledby="jbot-title" aria-hidden="true">' +
        '<header class="jbot-head">' +
          '<span class="jbot-avatar">' + faceMarkup() + '</span>' +
          '<span class="jbot-head-copy"><span class="jbot-name" id="jbot-title">J-Bot</span><span class="jbot-sub">Guided front desk &middot; no open-ended AI</span></span>' +
          '<span class="jbot-live"><span class="jbot-status" aria-hidden="true"></span><span id="jbot-state-text">Ready</span></span>' +
          '<button type="button" class="jbot-close" id="jbot-close" aria-label="Close J-Bot" title="Close chat">&times;</button>' +
        '</header>' +
        '<div class="jbot-context"><span>' + context.label + '</span><strong id="jbot-step">' + context.step + '</strong></div>' +
        '<div class="jbot-chat" id="jbot-chat" aria-live="polite">' +
          '<div class="jbot-overline">Approved site routes</div>' +
          '<div class="bubble bot"><span class="msg-jbot" aria-hidden="true"><span class="tiny-ant"></span><span class="tiny-eye left"></span><span class="tiny-eye right"></span></span>' + context.message + '</div>' +
          '<div class="jbot-front-card"><strong>What should we do next?</strong><span>Choose a route. Every answer, link, question, and handoff is approved in advance.</span></div>' +
          '<div class="jbot-safe">Please do not paste private client files, child or custody details, health information, passwords, or urgent crisis details here.</div>' +
          '<div class="jbot-quick-grid">' + quickMarkup(context.lane) + '</div>' +
          '<div class="jbot-mini-status"><span>Code-owned path</span> &middot; no model response generated</div>' +
        '</div>' +
        '<div class="jbot-input-row">' +
          '<label class="jbot-hp" for="jbot-company">Leave this field blank</label>' +
          '<input class="jbot-hp" id="jbot-company" name="company_website" type="text" tabindex="-1" autocomplete="off">' +
          '<input id="jbot-input" type="text" maxlength="700" autocomplete="off" placeholder="Pick a route or leave a high-level note..." aria-label="Message J-Bot">' +
          '<button type="button" class="send" id="jbot-send" aria-label="Send message" title="Send message">&uarr;</button>' +
        '</div>' +
        '<div class="jbot-consent">By sending, you agree Twilight Tech may reply by email. Do not include sensitive information.</div>' +
      '</div>' +
      '<button type="button" class="jbot-launcher" id="jbot-launcher" aria-controls="jbot-panel" aria-expanded="false">' +
        '<span class="jbot-launch-label"><strong>Need direction?</strong>Open the Twilight Tech front desk.</span>' +
        '<span class="jbot-launch-orb">' + faceMarkup() + '</span>' +
      '</button>' +
    '</section>';
  }

  function addStyle() {
    if (document.querySelector('link[data-jbot-style]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/jbot-widget.css?v=' + ASSET_VERSION;
    link.dataset.jbotStyle = 'true';
    document.head.appendChild(link);
  }

  function loadFrontDesk() {
    if (window.TwilightJBot && window.TwilightJBot.initFrontDesk) {
      window.TwilightJBot.initFrontDesk();
      return;
    }
    var script = document.createElement('script');
    script.src = '/assets/jbot-frontdesk.js?v=' + ASSET_VERSION;
    script.defer = true;
    document.body.appendChild(script);
  }

  function setOpen(root, panel, launcher, open, focusInput) {
    var wasOpen = root.classList.contains('is-open');
    root.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
    try { sessionStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch (error) { /* storage can be unavailable */ }
    if (open && !wasOpen) {
      trackWidgetEvent('J-Bot Opened', { page: window.location.pathname });
    }
    if (open && focusInput) {
      window.setTimeout(function () {
        var input = document.getElementById('jbot-input');
        if (input && !input.disabled) input.focus();
      }, 260);
    } else if (!open && focusInput) {
      launcher.focus();
    }
  }

  function start() {
    if (document.getElementById('jbot-widget')) return;
    var context = pageContext();
    addStyle();
    document.body.insertAdjacentHTML('beforeend', widgetMarkup(context));

    var root = document.getElementById('jbot-widget');
    var panel = document.getElementById('jbot-panel');
    var launcher = document.getElementById('jbot-launcher');
    var close = document.getElementById('jbot-close');
    var stateText = document.getElementById('jbot-state-text');
    var stepText = document.getElementById('jbot-step');
    var shouldOpen = false;
    try { shouldOpen = sessionStorage.getItem(OPEN_KEY) === '1'; } catch (error) { shouldOpen = false; }

    launcher.addEventListener('click', function () {
      setOpen(root, panel, launcher, !root.classList.contains('is-open'), true);
    });
    close.addEventListener('click', function () {
      setOpen(root, panel, launcher, false, true);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && root.classList.contains('is-open')) {
        setOpen(root, panel, launcher, false, true);
      }
    });
    document.addEventListener('twilight:jbot-state', function (event) {
      var detail = event.detail || {};
      root.dataset.jbotStage = detail.stage || 'idle';
      if (stateText) stateText.textContent = detail.status || 'Ready';
      if (stepText && detail.step) stepText.textContent = detail.step;
    });

    setOpen(root, panel, launcher, shouldOpen, false);
    loadFrontDesk();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
