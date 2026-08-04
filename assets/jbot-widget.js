(function () {
  var OPEN_KEY = 'tt_jbot_open_v1';

  function trackWidgetEvent(name, props) {
    if (typeof window.plausible !== 'function') return;
    window.plausible(name, props ? { props: props } : undefined);
  }

  var LANES = [
    { slug: 'private-ai', icon: 'AI', label: 'Private AI / sensitive docs', className: 'private' },
    { slug: 'site-chat', icon: 'IN', label: 'Build me a site chat', className: 'intake' },
    { slug: 'system-care', icon: 'SYS', label: 'Fix my tech chaos', className: 'system' },
    { slug: 'guides', icon: 'PDF', label: 'Guides & freebies links', className: 'guides' },
    { slug: 'breakroom', icon: 'BR', label: 'BreakRoom / community', className: 'breakroom' },
    { slug: 'aptsu', icon: 'UP', label: 'A Place To Show Up', className: 'aptsu' }
  ];

  function pageContext() {
    var path = window.location.pathname.toLowerCase();
    if (path.indexOf('/ai') === 0) {
      return { lane: 'private-ai', label: 'Private AI desk', message: 'You are in the Private AI wing. I can help with sensitive-document systems, a fit check, or another Twilight Tech lane.' };
    }
    if (path.indexOf('/services') === 0 || path.indexOf('/managed-it') === 0) {
      return { lane: 'system-care', label: 'Services desk', message: 'You are looking at Twilight Tech services. I can route tech cleanup, site chat builds, Private AI, or a direct note to James.' };
    }
    if (path.indexOf('/guides') === 0 || path.indexOf('/cheat-sheet') === 0 || path.indexOf('/homelab-starter') === 0 || path.indexOf('/roadmap') === 0 || path.indexOf('/strategy') === 0 || path.indexOf('/labs') === 0) {
      return { lane: 'guides', label: 'Guides desk', message: 'You are in the learning lane. I can find the right guide or freebie, point you toward the BreakRoom, or take a note for James.' };
    }
    return { lane: '', label: 'Twilight Tech desk', message: 'I can route Private AI, site chat builds, System Care, Guides, the BreakRoom, or A Place To Show Up.' };
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
      return '<button type="button" class="quick ' + lane.className + contextClass + '" data-jbot-lane="' + lane.slug + '"><span class="ico">' + lane.icon + '</span><span>' + lane.label + '</span></button>';
    }).join('');
  }

  function widgetMarkup(context) {
    return '<section class="jbot-widget" id="jbot-widget" data-jbot-default-lane="' + context.lane + '" aria-label="Twilight Tech front desk">' +
      '<div class="jbot-panel" id="jbot-panel" role="dialog" aria-modal="false" aria-labelledby="jbot-title" aria-hidden="true">' +
        '<header class="jbot-head">' +
          '<span class="jbot-avatar">' + faceMarkup() + '</span>' +
          '<span class="jbot-head-copy"><span class="jbot-name" id="jbot-title">J-Bot Front Desk</span><span class="jbot-sub">' + context.label + ' · routes · notes · links</span></span>' +
          '<span class="jbot-status" aria-hidden="true"></span>' +
          '<button type="button" class="jbot-close" id="jbot-close" aria-label="Close J-Bot">×</button>' +
        '</header>' +
        '<div class="jbot-chat" id="jbot-chat" aria-live="polite">' +
          '<div class="bubble bot"><span class="msg-jbot" aria-hidden="true"><span class="tiny-ant"></span><span class="tiny-eye left"></span><span class="tiny-eye right"></span></span>Evening. I am J-Bot at the Twilight Tech front desk. ' + context.message + '</div>' +
          '<div class="jbot-front-card"><strong>What can I help with?</strong><span>Pick a lane below. I will keep the routing clean and the questions short.</span></div>' +
          '<div class="jbot-safe">Please do not paste private client files, child or custody details, health information, passwords, or urgent crisis details here.</div>' +
          '<div class="jbot-quick-grid">' + quickMarkup(context.lane) + '</div>' +
          '<div class="jbot-mini-status"><span>desk note</span> standby · no chaos added</div>' +
        '</div>' +
        '<div class="jbot-input-row">' +
          '<label class="jbot-hp" for="jbot-company">Leave this field blank</label>' +
          '<input class="jbot-hp" id="jbot-company" name="company_website" type="text" tabindex="-1" autocomplete="off">' +
          '<input id="jbot-input" type="text" maxlength="700" autocomplete="off" placeholder="Pick a lane or tell J-Bot what you need..." aria-label="Message J-Bot">' +
          '<button type="button" class="send" id="jbot-send">SEND</button>' +
        '</div>' +
        '<div class="jbot-consent">By sending, you agree Twilight Tech may reply by email. Do not include sensitive information.</div>' +
      '</div>' +
      '<button type="button" class="jbot-launcher" id="jbot-launcher" aria-controls="jbot-panel" aria-expanded="false">' +
        '<span class="jbot-launch-label"><strong>Need direction?</strong>J-Bot is at the desk.</span>' +
        '<span class="jbot-launch-orb">' + faceMarkup() + '</span>' +
      '</button>' +
    '</section>';
  }

  function addStyle() {
    if (document.querySelector('link[data-jbot-style]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/jbot-widget.css?v=20260804-google';
    link.dataset.jbotStyle = 'true';
    document.head.appendChild(link);
  }

  function loadFrontDesk() {
    if (window.TwilightJBot && window.TwilightJBot.initFrontDesk) {
      window.TwilightJBot.initFrontDesk();
      return;
    }
    var script = document.createElement('script');
    script.src = '/assets/jbot-frontdesk.js?v=20260804-google';
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
      }, 220);
    } else if (!open && focusInput) {
      launcher.focus();
    }
  }

  function start() {
    if (document.getElementById('jbot-widget')) return;
    addStyle();
    document.body.insertAdjacentHTML('beforeend', widgetMarkup(pageContext()));

    var root = document.getElementById('jbot-widget');
    var panel = document.getElementById('jbot-panel');
    var launcher = document.getElementById('jbot-launcher');
    var close = document.getElementById('jbot-close');
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

    setOpen(root, panel, launcher, shouldOpen, false);
    loadFrontDesk();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
