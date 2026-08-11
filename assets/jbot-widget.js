(function () {
  'use strict';

  var OPEN_KEY = 'tt_jbot_open_v1';
  var ASSET_VERSION = '20260811-frontdesk-v3';
  var CONTENT = window.TwilightFrontDeskContent;

  if (!CONTENT) return;

  function trackWidgetEvent(name, props) {
    if (typeof window.plausible !== 'function') return;
    window.plausible(name, props ? { props: props } : undefined);
  }

  var LANES = CONTENT.lanes.filter(function (lane) { return lane.icon; });

  function pageContext() {
    var path = window.location.pathname.toLowerCase();
    var match = CONTENT.pageContexts.find(function (context) {
      return context.prefixes.some(function (prefix) { return path.indexOf(prefix) === 0; });
    });
    return match || CONTENT.defaultContext;
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
      return '<button type="button" class="quick ' + lane.className + contextClass + '" data-jbot-lane="' + lane.slug + '" aria-label="' + lane.label + ': ' + lane.detail + '">' +
        '<span class="ico">' + lane.icon + '</span>' +
        '<span class="quick-copy"><strong>' + lane.label + '</strong><small>' + lane.detail + '</small></span>' +
        (contextClass ? '<span class="quick-context">On this page</span>' : '') +
      '</button>';
    }).join('');
  }

  function widgetMarkup(context) {
    var shell = CONTENT.shell;
    return '<section class="jbot-widget" id="jbot-widget" data-jbot-default-lane="' + context.lane + '" data-jbot-stage="idle" aria-label="Twilight Tech front desk">' +
      '<div class="jbot-panel" id="jbot-panel" role="dialog" aria-modal="false" aria-labelledby="jbot-title" aria-describedby="jbot-consent" aria-hidden="true">' +
        '<header class="jbot-head">' +
          '<span class="jbot-avatar">' + faceMarkup() + '</span>' +
          '<span class="jbot-head-copy"><span class="jbot-name" id="jbot-title">J-Bot</span><span class="jbot-sub">' + shell.subtitle + '</span></span>' +
          '<span class="jbot-live"><span class="jbot-status" aria-hidden="true"></span><span id="jbot-state-text" aria-live="polite">Ready</span></span>' +
          '<button type="button" class="jbot-close" id="jbot-close" aria-label="Close J-Bot" title="Close chat">&times;</button>' +
        '</header>' +
        '<div class="jbot-context"><span>' + context.label + '</span><strong id="jbot-step">' + context.step + '</strong></div>' +
        '<div class="jbot-chat" id="jbot-chat" aria-live="polite">' +
          '<div class="jbot-overline">' + shell.overline + '</div>' +
          '<div class="bubble bot"><span class="msg-jbot" aria-hidden="true"><span class="tiny-ant"></span><span class="tiny-eye left"></span><span class="tiny-eye right"></span></span>' + context.message + '</div>' +
          '<div class="jbot-front-card"><strong>' + shell.introTitle + '</strong><span>' + shell.introCopy + '</span></div>' +
          '<div class="jbot-safe">' + shell.safety + '</div>' +
          '<div class="jbot-quick-grid">' + quickMarkup(context.lane) + '</div>' +
        '</div>' +
        '<div class="jbot-input-row">' +
          '<label class="jbot-hp" for="jbot-company">Leave this field blank</label>' +
          '<input class="jbot-hp" id="jbot-company" name="company_website" type="text" tabindex="-1" autocomplete="off">' +
          '<input id="jbot-input" type="text" maxlength="700" autocomplete="off" autocapitalize="sentences" enterkeyhint="send" spellcheck="true" placeholder="' + shell.inputPlaceholder + '" aria-label="Message J-Bot">' +
          '<button type="button" class="send" id="jbot-send" aria-label="Send message" title="Send message">&uarr;</button>' +
        '</div>' +
        '<div class="jbot-consent" id="jbot-consent">' + shell.consent + '</div>' +
      '</div>' +
      '<button type="button" class="jbot-launcher" id="jbot-launcher" aria-controls="jbot-panel" aria-expanded="false">' +
        '<span class="jbot-launch-label"><strong>' + shell.launcherTitle + '</strong>' + shell.launcherCopy + '</span>' +
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
    script.onerror = function () {
      var root = document.getElementById('jbot-widget');
      var chat = document.getElementById('jbot-chat');
      var input = document.getElementById('jbot-input');
      var send = document.getElementById('jbot-send');
      if (root) root.dataset.jbotStage = 'unavailable';
      if (chat) {
        var card = document.createElement('div');
        card.className = 'jbot-front-card';
        var title = document.createElement('strong');
        var copy = document.createElement('span');
        var link = document.createElement('a');
        title.textContent = 'Front desk unavailable';
        copy.textContent = 'The chat did not load, but you can still reach Twilight Tech directly.';
        link.href = 'mailto:' + CONTENT.supportEmail;
        link.textContent = 'Email Twilight Tech';
        card.appendChild(title);
        card.appendChild(copy);
        card.appendChild(link);
        chat.appendChild(card);
      }
      if (input) input.disabled = true;
      if (send) send.disabled = true;
      document.dispatchEvent(new CustomEvent('twilight:jbot-state', {
        detail: { stage: 'unavailable', status: 'Unavailable', step: 'Direct contact' }
      }));
      trackWidgetEvent('J-Bot Runtime Failed', { page: window.location.pathname });
    };
    document.body.appendChild(script);
  }

  function syncCompactState(root, panel) {
    var open = root.classList.contains('is-open');
    var compact = window.matchMedia('(max-width: 560px)').matches;
    panel.setAttribute('aria-modal', open && compact ? 'true' : 'false');
    document.documentElement.classList.toggle('jbot-mobile-open', open && compact);
  }

  function setOpen(root, panel, launcher, open, focusInput) {
    var wasOpen = root.classList.contains('is-open');
    var coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    root.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
    syncCompactState(root, panel);
    try { sessionStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch (error) { /* storage can be unavailable */ }
    if (open && !wasOpen) {
      trackWidgetEvent('J-Bot Opened', { page: window.location.pathname });
    }
    if (!open && wasOpen) {
      trackWidgetEvent('J-Bot Closed', { page: window.location.pathname, stage: root.dataset.jbotStage || 'idle' });
    }
    if (open && focusInput && !coarsePointer) {
      window.setTimeout(function () {
        var input = document.getElementById('jbot-input');
        if (input && !input.disabled) input.focus();
      }, 260);
    } else if (open && focusInput) {
      var closeButton = panel.querySelector('.jbot-close');
      if (closeButton) closeButton.focus();
    } else if (!open && focusInput) {
      launcher.focus();
    }
  }

  function trapCompactFocus(event, root, panel) {
    if (event.key !== 'Tab' || !root.classList.contains('is-open') || !window.matchMedia('(max-width: 560px)').matches) return;
    var controls = Array.prototype.slice.call(panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])'))
      .filter(function (control) { return control.offsetParent !== null; });
    if (!controls.length) return;
    var first = controls[0];
    var last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
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
      trapCompactFocus(event, root, panel);
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
    window.addEventListener('resize', function () {
      syncCompactState(root, panel);
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
