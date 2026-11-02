(function () {
  'use strict';

  var CONTENT = window.FrontDeskContent;
  if (!CONTENT) return;

  var shell = CONTENT.shell;
  var storagePrefix = CONTENT.storagePrefix || 'frontdesk';
  var OPEN_KEY = storagePrefix + '_open_v1';
  var ASSET_VERSION = '20261102-frontdesk-v6';

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
    return '<span class="frontdesk-face" aria-hidden="true"><span class="frontdesk-ant"></span><span class="frontdesk-eye left"></span><span class="frontdesk-eye right"></span></span>';
  }

  function quickMarkup(contextLane) {
    var ordered = LANES.slice().sort(function (a, b) {
      if (a.slug === contextLane) return -1;
      if (b.slug === contextLane) return 1;
      return 0;
    });

    return ordered.map(function (lane) {
      var contextClass = lane.slug === contextLane ? ' context' : '';
      return '<button type="button" class="quick ' + lane.className + contextClass + '" data-frontdesk-lane="' + lane.slug + '" aria-label="' + lane.label + ': ' + lane.detail + '">' +
        '<span class="ico">' + lane.icon + '</span>' +
        '<span class="quick-copy"><strong>' + lane.label + '</strong><small>' + lane.detail + '</small></span>' +
        (contextClass ? '<span class="quick-context">On this page</span>' : '') +
      '</button>';
    }).join('');
  }

  function widgetMarkup(context) {
    return '<section class="frontdesk-widget" id="frontdesk-widget" data-frontdesk-default-lane="' + context.lane + '" data-frontdesk-stage="idle" aria-label="' + shell.widgetLabel + '">' +
      '<div class="frontdesk-panel" id="frontdesk-panel" role="dialog" aria-modal="false" aria-labelledby="frontdesk-title" aria-describedby="frontdesk-consent" aria-hidden="true">' +
        '<header class="frontdesk-head">' +
          '<span class="frontdesk-avatar">' + faceMarkup() + '</span>' +
          '<span class="frontdesk-head-copy"><span class="frontdesk-name" id="frontdesk-title">' + shell.productName + '</span><span class="frontdesk-sub">' + shell.subtitle + '</span></span>' +
          '<span class="frontdesk-live"><span class="frontdesk-status" aria-hidden="true"></span><span id="frontdesk-state-text" aria-live="polite">Ready</span></span>' +
          '<button type="button" class="frontdesk-close" id="frontdesk-close" aria-label="Close ' + shell.productName + '" title="Close front desk">&times;</button>' +
        '</header>' +
        '<div class="frontdesk-context"><span>' + context.label + '</span><strong id="frontdesk-step">' + context.step + '</strong></div>' +
        '<div class="frontdesk-chat" id="frontdesk-chat" aria-live="polite">' +
          '<div class="frontdesk-overline">' + shell.overline + '</div>' +
          '<div class="bubble bot"><span class="msg-frontdesk" aria-hidden="true"><span class="tiny-ant"></span><span class="tiny-eye left"></span><span class="tiny-eye right"></span></span>' + context.message + '</div>' +
          '<div class="frontdesk-front-card"><strong>' + shell.introTitle + '</strong><span>' + shell.introCopy + '</span></div>' +
          '<div class="frontdesk-safe">' + shell.safety + '</div>' +
          '<div class="frontdesk-quick-grid">' + quickMarkup(context.lane) + '</div>' +
        '</div>' +
        '<div class="frontdesk-input-row">' +
          '<label class="frontdesk-hp" for="frontdesk-company">Leave this field blank</label>' +
          '<input class="frontdesk-hp" id="frontdesk-company" name="company_website" type="text" tabindex="-1" autocomplete="off">' +
          '<input id="frontdesk-input" type="text" maxlength="700" autocomplete="off" autocapitalize="sentences" enterkeyhint="send" spellcheck="true" placeholder="' + shell.inputPlaceholder + '" aria-label="Message ' + shell.productName + '">' +
          '<button type="button" class="send" id="frontdesk-send" aria-label="Send message" title="Send message">&uarr;</button>' +
        '</div>' +
        '<div class="frontdesk-consent" id="frontdesk-consent">' + shell.consent + '</div>' +
      '</div>' +
      '<button type="button" class="frontdesk-launcher" id="frontdesk-launcher" aria-label="Open ' + shell.widgetLabel + '" aria-controls="frontdesk-panel" aria-expanded="false">' +
        '<span class="frontdesk-launch-label"><strong>' + shell.launcherTitle + '</strong>' + shell.launcherCopy + '</span>' +
        '<span class="frontdesk-launch-orb">' + faceMarkup() + '</span>' +
      '</button>' +
    '</section>';
  }

  function addStyle() {
    if (document.querySelector('link[data-frontdesk-style]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = (CONTENT.assets && CONTENT.assets.style) || '/assets/frontdesk-widget.css?v=' + ASSET_VERSION;
    link.dataset.frontdeskStyle = 'true';
    document.head.appendChild(link);
  }

  function loadFrontDesk() {
    var api = window.FrontDesk;
    if (api && api.initFrontDesk) {
      api.initFrontDesk();
      return;
    }
    var script = document.createElement('script');
    script.src = (CONTENT.assets && CONTENT.assets.runtime) || '/assets/frontdesk-runtime.js?v=' + ASSET_VERSION;
    script.defer = true;
    script.onerror = function () {
      var root = document.getElementById('frontdesk-widget');
      var chat = document.getElementById('frontdesk-chat');
      var input = document.getElementById('frontdesk-input');
      var send = document.getElementById('frontdesk-send');
      if (root) root.dataset.frontdeskStage = 'unavailable';
      if (chat) {
        var card = document.createElement('div');
        card.className = 'frontdesk-front-card';
        var title = document.createElement('strong');
        var copy = document.createElement('span');
        var link = document.createElement('a');
        title.textContent = 'Front desk unavailable';
        copy.textContent = 'The front desk did not load, but you can still use direct contact.';
        link.href = 'mailto:' + CONTENT.supportEmail;
        link.textContent = shell.contactLabel;
        card.appendChild(title);
        card.appendChild(copy);
        card.appendChild(link);
        chat.appendChild(card);
      }
      if (input) input.disabled = true;
      if (send) send.disabled = true;
      document.dispatchEvent(new CustomEvent('frontdesk:state', {
        detail: { stage: 'unavailable', status: 'Unavailable', step: 'Direct contact' }
      }));
      trackWidgetEvent('Front Desk Runtime Failed', { page: window.location.pathname });
    };
    document.body.appendChild(script);
  }

  function syncCompactState(root, panel) {
    var open = root.classList.contains('is-open');
    var compact = window.matchMedia('(max-width: 560px)').matches;
    panel.setAttribute('aria-modal', open && compact ? 'true' : 'false');
    document.documentElement.classList.toggle('frontdesk-mobile-open', open && compact);
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
      trackWidgetEvent('Front Desk Opened', { page: window.location.pathname });
    }
    if (!open && wasOpen) {
      trackWidgetEvent('Front Desk Closed', { page: window.location.pathname, stage: root.dataset.frontdeskStage || 'idle' });
    }
    if (open && focusInput && !coarsePointer) {
      window.setTimeout(function () {
        var input = document.getElementById('frontdesk-input');
        if (input && !input.disabled) input.focus();
      }, 260);
    } else if (open && focusInput) {
      var closeButton = panel.querySelector('.frontdesk-close');
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
    if (document.getElementById('frontdesk-widget')) return;
    var context = pageContext();
    addStyle();
    document.body.insertAdjacentHTML('beforeend', widgetMarkup(context));

    var root = document.getElementById('frontdesk-widget');
    var panel = document.getElementById('frontdesk-panel');
    var launcher = document.getElementById('frontdesk-launcher');
    var close = document.getElementById('frontdesk-close');
    var stateText = document.getElementById('frontdesk-state-text');
    var stepText = document.getElementById('frontdesk-step');
    var shouldOpen = false;
    try { shouldOpen = sessionStorage.getItem(OPEN_KEY) === '1'; } catch (error) { shouldOpen = false; }

    launcher.addEventListener('click', function () {
      setOpen(root, panel, launcher, !root.classList.contains('is-open'), true);
    });
    document.querySelectorAll('[data-open-frontdesk]').forEach(function (button) {
      button.addEventListener('click', function () {
        setOpen(root, panel, launcher, true, true);
      });
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
    document.addEventListener('frontdesk:state', function (event) {
      var detail = event.detail || {};
      root.dataset.frontdeskStage = detail.stage || 'idle';
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

