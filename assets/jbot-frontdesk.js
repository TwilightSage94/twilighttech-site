(function () {
  var JBOT_PROXY_ENDPOINT = '/api/jbot-leads';
  var RATE_KEY = 'tt_jbot_last_submit_at';
  var RATE_WINDOW_MS = 45000;
  var CHAT_KEY = 'tt_jbot_chat_v1';
  var STATE_KEY = 'tt_jbot_state_v1';
  var TURNSTILE_TEST_SITEKEY = '1x00000000000000000000AA';

  var ALLOWED_LANES = {
    'private-ai': 'Private AI',
    'site-chat': 'Website Chat / Intake',
    'system-care': 'System Care',
    'guides': 'Guides / Freebies',
    'breakroom': 'BreakRoom',
    'aptsu': 'A Place To Show Up',
    'general': 'General'
  };

  var LIMITS = {
    name: 90,
    email: 160,
    lane: 40,
    need: 700,
    urgency: 80,
    summary: 900,
    next_step: 180,
    safety_note: 220,
    hp: 120,
    turnstile_token: 2048
  };

  var SENSITIVE_PATTERNS = [
    /\bpassword\b/i,
    /\bpasscode\b/i,
    /\bapi[_\s-]?key\b/i,
    /\bsecret\b/i,
    /\btoken\b/i,
    /\bssn\b/i,
    /\bsocial security\b/i,
    /\bcredit card\b/i,
    /\bprivate key\b/i,
    /\bcustody\b/i,
    /\bmedical record\b/i,
    /\bclient file\b/i
  ];

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name) || '';
  }

  function truncate(value, max) {
    var text = (value || '').toString().trim();
    if (!max || text.length <= max) return text;
    return text.slice(0, max - 1).trim() + '…';
  }

  function neutralize(value, max) {
    return truncate(value, max)
      .replace(/[<>]/g, '')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function slugLane(value) {
    var raw = neutralize(value, LIMITS.lane).toLowerCase();
    var slug = raw
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (ALLOWED_LANES[slug]) return slug;

    Object.keys(ALLOWED_LANES).some(function (key) {
      if (ALLOWED_LANES[key].toLowerCase() === raw) {
        slug = key;
        return true;
      }
      return false;
    });

    return ALLOWED_LANES[slug] ? slug : 'general';
  }

  function isEmail(value) {
    var email = neutralize(value, LIMITS.email);
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  function hasSensitiveContent(text) {
    var value = (text || '').toString();
    return SENSITIVE_PATTERNS.some(function (pattern) {
      return pattern.test(value);
    });
  }

  function currentPage() {
    if (window.location.origin && window.location.origin !== 'null') {
      return window.location.origin + window.location.pathname;
    }
    return window.location.href.split('?')[0].split('#')[0];
  }

  function trackEvent(name, props) {
    if (typeof window.plausible !== 'function') return;
    window.plausible(name, props ? { props: props } : undefined);
  }

  function normalizeLead(lead) {
    var source = lead || {};
    var laneSlug = slugLane(source.lane);
    var summary = neutralize(source.summary, LIMITS.summary);
    var need = neutralize(source.need, LIMITS.need);

    return {
      name: neutralize(source.name, LIMITS.name),
      email: neutralize(source.email, LIMITS.email).toLowerCase(),
      lane: ALLOWED_LANES[laneSlug],
      lane_slug: laneSlug,
      need: need,
      urgency: neutralize(source.urgency, LIMITS.urgency),
      summary: summary,
      next_step: neutralize(source.next_step, LIMITS.next_step),
      safety_note: neutralize(source.safety_note, LIMITS.safety_note),
      hp: neutralize(source.hp, LIMITS.hp),
      turnstile_token: neutralize(source.turnstile_token, LIMITS.turnstile_token),
      sensitive_flag: hasSensitiveContent([need, summary, source.next_step].join(' '))
    };
  }

  function validateLead(lead) {
    var normalized = normalizeLead(lead);
    var errors = [];
    var warnings = [];

    if (normalized.hp) {
      errors.push('Bot check failed.');
    }
    if (!normalized.email) {
      errors.push('Email is required.');
    } else if (!isEmail(normalized.email)) {
      errors.push('Email does not look valid.');
    }
    if (!ALLOWED_LANES[normalized.lane_slug]) {
      errors.push('Invalid route selected.');
    }
    if (!normalized.turnstile_token) {
      errors.push('Security verification is required.');
    }
    if (normalized.sensitive_flag) {
      warnings.push('Sensitive terms detected. Do not submit passwords, private client files, custody details, medical records, API keys, or secrets.');
    }

    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
      lead: normalized
    };
  }

  function compactSummary(lead) {
    var bits = [
      lead.name ? 'Name: ' + lead.name : '',
      lead.lane ? 'Lane: ' + lead.lane : '',
      lead.need ? 'Need: ' + lead.need : '',
      lead.urgency ? 'Urgency: ' + lead.urgency : '',
      lead.next_step ? 'Next: ' + lead.next_step : ''
    ].filter(Boolean);
    return truncate(bits.join(' | '), 450);
  }

  function buildLeadPayload(rawLead) {
    var lead = normalizeLead(rawLead);
    return {
      email: lead.email,
      source_page: 'jbot-frontdesk:' + lead.lane_slug,
      utm_campaign: neutralize(getParam('utm_campaign') || 'jbot-frontdesk', 120),
      utm_medium: neutralize(getParam('utm_medium') || 'site-chat', 80),
      utm_source: neutralize(getParam('utm_source') || window.location.pathname, 160),
      utm_content: neutralize(getParam('utm_content') || compactSummary(lead), 450),
      referrer: neutralize(document.referrer || '', 300),
      hp: lead.hp
    };
  }

  function buildEmailPayload(rawLead) {
    var lead = normalizeLead(rawLead);
    var safetyNote = lead.safety_note || (lead.sensitive_flag
      ? 'Sensitive terms detected. Review before replying.'
      : 'No sensitive files requested in chat.');

    return {
      _subject: 'New J-Bot Lead - ' + lead.lane,
      source: 'J-Bot Front Desk',
      name: lead.name,
      email: lead.email,
      lane: lead.lane,
      need: lead.need,
      urgency: lead.urgency,
      page: currentPage(),
      summary: lead.summary || compactSummary(lead),
      next_step: lead.next_step,
      safety_note: safetyNote,
      sensitive_flag: lead.sensitive_flag ? 'yes' : 'no'
    };
  }

  function buildProxyPayload(rawLead) {
    var lead = normalizeLead(rawLead);
    return {
      name: lead.name,
      email: lead.email,
      lane: lead.lane_slug,
      need: lead.need,
      urgency: lead.urgency,
      summary: lead.summary || compactSummary(lead),
      next_step: lead.next_step,
      safety_note: lead.safety_note,
      hp: lead.hp,
      turnstile_token: lead.turnstile_token,
      page: currentPage()
    };
  }

  function rateLimited() {
    try {
      var last = parseInt(localStorage.getItem(RATE_KEY) || '0', 10);
      return Date.now() - last < RATE_WINDOW_MS;
    } catch (err) {
      return false;
    }
  }

  function markSubmitted() {
    try {
      localStorage.setItem(RATE_KEY, String(Date.now()));
    } catch (err) {
      /* localStorage can be blocked; server-side rate limits still matter. */
    }
  }

  function postJson(url, payload) {
    return fetch(url, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  function submitLead(rawLead) {
    var validation = validateLead(rawLead);

    if (!validation.ok) {
      return Promise.reject(new Error(validation.errors.join(' ')));
    }

    if (rateLimited()) {
      return Promise.reject(new Error('Please wait a moment before submitting another note.'));
    }

    return postJson(JBOT_PROXY_ENDPOINT, buildProxyPayload(validation.lead)).then(function (response) {
      if (!response.ok) {
        throw new Error('J-Bot proxy returned HTTP ' + response.status);
      }
      return response.json();
    }).then(function (result) {
      if (!result || !result.ok) {
        throw new Error(result && result.error ? result.error : 'J-Bot delivery failed.');
      }

      markSubmitted();

      return {
        lead_saved: !!result.lead_saved,
        email_sent: !!result.email_sent,
        warnings: result.warnings || validation.warnings
      };
    });
  }

  window.TwilightJBot = window.TwilightJBot || {};
  window.TwilightJBot.allowedLanes = ALLOWED_LANES;
  window.TwilightJBot.normalizeLead = normalizeLead;
  window.TwilightJBot.validateLead = validateLead;
  window.TwilightJBot.buildProxyPayload = buildProxyPayload;
  window.TwilightJBot.buildLeadPayload = buildLeadPayload;
  window.TwilightJBot.buildEmailPayload = buildEmailPayload;
  window.TwilightJBot.submitLead = submitLead;

  var LANE_PROMPTS = {
    'private-ai': 'Private AI it is. What should I call you?',
    'site-chat': 'A site chat build. Nice. What should I call you?',
    'system-care': 'Tech chaos has entered the front desk. What should I call you?',
    'guides': 'Guides and freebies. I can route you there now.',
    'breakroom': 'BreakRoom route selected. Community doors are this way.',
    'aptsu': 'A Place To Show Up route selected. I have the right door.',
    'general': 'I can route that. What should I call you?'
  };

  var CAPTURE_NAME_PROMPTS = {
    'private-ai': 'Private AI it is. To start the desk note, what should I call you?',
    'site-chat': 'A site chat build. Nice. To start the desk note, what should I call you?',
    'system-care': 'Tech chaos has entered the front desk. What should I call you?',
    'guides': 'I can leave James a note about the Guides. What should I call you?',
    'breakroom': 'I can leave James a BreakRoom note. What should I call you?',
    'aptsu': 'I can leave James a note about A Place To Show Up. What should I call you?',
    'general': 'I can route that. What should I call you?'
  };

  var NEED_PROMPTS = {
    'private-ai': 'At a high level, what documents or workflow should Private AI help with?',
    'site-chat': 'What should the site chat help visitors do - find answers, qualify a need, book, or leave a clean note?',
    'system-care': 'What part of the tech setup is causing the most drag right now?',
    'guides': 'What kind of guide or learning help are you looking for?',
    'breakroom': 'What would you like James to know about the BreakRoom?',
    'aptsu': 'What would you like James to know about A Place To Show Up?',
    'general': 'What are you trying to get done?'
  };

  var RESOURCE_ROUTES = {
    'site-chat': {
      title: 'Website Front Desk Build',
      copy: 'See exactly what ships, what it costs, and why this front desk stays useful without becoming an AI free-for-all.',
      links: [
        { label: 'See the $999 build', href: 'https://twilighttech.io/site-chat/' }
      ]
    },
    'guides': {
      title: 'Guides & freebies',
      copy: 'Grab the useful thing first. You can still leave James a note afterward.',
      links: [
        { label: 'Browse all guides', href: 'https://twilighttech.io/guides/' },
        { label: 'Free A+ cheat sheet', href: 'https://twilighttech.io/cheat-sheet/' },
        { label: 'Free homelab starter', href: 'https://twilighttech.io/homelab-starter/' }
      ]
    },
    'breakroom': {
      title: 'The BreakRoom',
      copy: 'The community lane: grab a free resource or walk straight into the Discord.',
      links: [
        { label: 'Join the Discord', href: 'https://discord.gg/QKGsTZRWMx' },
        { label: 'Browse freebies', href: 'https://twilighttech.io/guides/' }
      ]
    },
    'aptsu': {
      title: 'A Place To Show Up',
      copy: 'This is its own lane and its own experience. J-Bot will hand you over cleanly.',
      links: [
        { label: 'Visit A Place To Show Up', href: 'https://aplacetoshowup.com/' }
      ]
    }
  };

  var uiState = {
    stage: 'idle',
    lane: '',
    name: '',
    email: '',
    need: '',
    urgency: '',
    submitting: false
  };
  var activeChat = null;
  var baseChatMarkup = '';
  var turnstileState = {
    token: '',
    widgetId: null,
    loadPromise: null,
    sitekeyPromise: null,
    actionButton: null
  };

  function isLocalHost() {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  function getTurnstileSitekey() {
    if (window.location.protocol === 'file:' || isLocalHost()) {
      return Promise.resolve(TURNSTILE_TEST_SITEKEY);
    }
    if (turnstileState.sitekeyPromise) return turnstileState.sitekeyPromise;
    turnstileState.sitekeyPromise = fetch('/api/jbot-config', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      if (!response.ok) throw new Error('Turnstile configuration unavailable.');
      return response.json();
    }).then(function (config) {
      if (!config || !config.sitekey) throw new Error('Turnstile sitekey missing.');
      return config.sitekey;
    });
    return turnstileState.sitekeyPromise;
  }

  function loadTurnstileApi() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (turnstileState.loadPromise) return turnstileState.loadPromise;
    turnstileState.loadPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = function () {
        if (window.turnstile) resolve(window.turnstile);
        else reject(new Error('Turnstile did not initialize.'));
      };
      script.onerror = function () { reject(new Error('Turnstile could not load.')); };
      document.head.appendChild(script);
    });
    return turnstileState.loadPromise;
  }

  function clearTurnstileWidget() {
    if (turnstileState.widgetId !== null && window.turnstile) {
      try { window.turnstile.remove(turnstileState.widgetId); } catch (error) { /* already removed */ }
    }
    turnstileState.token = '';
    turnstileState.widgetId = null;
    turnstileState.actionButton = null;
    if (activeChat) {
      activeChat.querySelectorAll('.jbot-turnstile-box').forEach(function (box) { box.remove(); });
    }
  }

  function prepareTurnstile(card, actionButton) {
    clearTurnstileWidget();
    turnstileState.actionButton = actionButton;
    actionButton.disabled = true;

    var box = document.createElement('div');
    box.className = 'jbot-turnstile-box';
    var status = document.createElement('div');
    status.className = 'jbot-turnstile-status';
    status.textContent = 'Cloudflare security check loading...';
    var container = document.createElement('div');
    container.className = 'jbot-turnstile';
    box.appendChild(status);
    box.appendChild(container);
    var actionRow = card.querySelector('.chat-actions');
    card.insertBefore(box, actionRow || null);

    if (window.location.protocol === 'file:') {
      turnstileState.token = 'local-preview-only';
      actionButton.disabled = false;
      status.textContent = 'Turnstile activates on the HTTP or live preview.';
      return;
    }

    Promise.all([getTurnstileSitekey(), loadTurnstileApi()]).then(function (parts) {
      if (!container.isConnected) return;
      var sitekey = parts[0];
      var turnstile = parts[1];
      turnstileState.widgetId = turnstile.render(container, {
        sitekey: sitekey,
        theme: 'dark',
        size: 'flexible',
        appearance: 'interaction-only',
        action: 'jbot_lead',
        callback: function (token) {
          turnstileState.token = token;
          actionButton.disabled = false;
          status.textContent = 'Verified by Cloudflare. Ready to send.';
          trackEvent('J-Bot Security Verified', { lane: uiState.lane || 'general' });
          persistConversation(activeChat);
        },
        'expired-callback': function () {
          turnstileState.token = '';
          actionButton.disabled = true;
          status.textContent = 'Security check expired. Verifying again...';
          turnstile.reset(turnstileState.widgetId);
        },
        'error-callback': function () {
          turnstileState.token = '';
          actionButton.disabled = true;
          status.textContent = 'Security check unavailable. Please try again.';
          trackEvent('J-Bot Security Failed', { lane: uiState.lane || 'general' });
        }
      });
    }).catch(function () {
      actionButton.disabled = true;
      status.textContent = 'Security check unavailable. Email Twilight Tech instead.';
      trackEvent('J-Bot Security Failed', { lane: uiState.lane || 'general' });
    });
  }

  function hasPersistentWidget() {
    return !!document.getElementById('jbot-widget');
  }

  function persistConversation(chat) {
    if (!chat || !hasPersistentWidget()) return;
    try {
      var safeClone = chat.cloneNode(true);
      safeClone.querySelectorAll('.jbot-turnstile-box').forEach(function (box) { box.remove(); });
      sessionStorage.setItem(CHAT_KEY, safeClone.innerHTML);
      sessionStorage.setItem(STATE_KEY, JSON.stringify(uiState));
    } catch (error) {
      /* The front desk still works when browser storage is unavailable. */
    }
  }

  function restoreConversation(chat) {
    if (!chat || !hasPersistentWidget()) return false;
    try {
      var savedChat = sessionStorage.getItem(CHAT_KEY);
      var savedState = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null');
      if (!savedChat || !savedState || typeof savedState !== 'object') return false;
      if (savedState.lane && !ALLOWED_LANES[savedState.lane]) savedState.lane = 'general';
      Object.keys(uiState).forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(savedState, key)) uiState[key] = savedState[key];
      });
      chat.innerHTML = savedChat;
      return true;
    } catch (error) {
      return false;
    }
  }

  function createMascot() {
    var mascot = document.createElement('span');
    mascot.className = 'msg-jbot';
    mascot.setAttribute('aria-hidden', 'true');
    mascot.innerHTML = '<span class="tiny-ant"></span><span class="tiny-eye left"></span><span class="tiny-eye right"></span>';
    return mascot;
  }

  function scrollChat(chat) {
    window.requestAnimationFrame(function () {
      chat.scrollTop = chat.scrollHeight;
      persistConversation(chat);
    });
  }

  function appendMessage(chat, kind, message) {
    var bubble = document.createElement('div');
    bubble.className = 'bubble ' + kind;
    if (kind === 'bot') bubble.appendChild(createMascot());
    bubble.appendChild(document.createTextNode(message));
    chat.appendChild(bubble);
    scrollChat(chat);
    return bubble;
  }

  function appendCard(chat, className, title, message) {
    var card = document.createElement('div');
    card.className = className;
    var heading = document.createElement('strong');
    heading.textContent = title;
    card.appendChild(heading);
    card.appendChild(document.createTextNode(message));
    chat.appendChild(card);
    scrollChat(chat);
    return card;
  }

  function addActions(card, actions) {
    var row = document.createElement('div');
    row.className = 'chat-actions';

    actions.forEach(function (action) {
      var control;
      if (action.href) {
        control = document.createElement('a');
        control.href = action.href;
        control.target = '_blank';
        control.rel = 'noopener';
      } else {
        control = document.createElement('button');
        control.type = 'button';
        control.dataset.jbotAction = action.action;
        if (action.value) control.dataset.jbotValue = action.value;
      }
      control.className = 'chat-action' + (action.className ? ' ' + action.className : '');
      control.textContent = action.label;
      row.appendChild(control);
    });

    card.appendChild(row);
    persistConversation(activeChat);
    return row;
  }

  function setInput(input, send, placeholder, disabled) {
    input.placeholder = placeholder;
    input.disabled = !!disabled;
    send.disabled = !!disabled;
    if (!disabled) input.focus();
    persistConversation(activeChat);
  }

  function resetState() {
    clearTurnstileWidget();
    uiState.stage = 'idle';
    uiState.lane = '';
    uiState.name = '';
    uiState.email = '';
    uiState.need = '';
    uiState.urgency = '';
    uiState.submitting = false;
  }

  function showResources(chat, lane) {
    var route = RESOURCE_ROUTES[lane];
    var card = appendCard(chat, 'link-card', route.title, route.copy);
    var actions = route.links.slice();
    actions.push({ label: 'Leave James a note', action: 'capture', value: lane, className: 'alt' });
    addActions(card, actions);
  }

  function beginCapture(chat, input, send, lane) {
    uiState.stage = 'name';
    uiState.lane = lane || uiState.lane || 'general';
    uiState.name = '';
    uiState.email = '';
    uiState.need = '';
    uiState.urgency = '';
    appendMessage(chat, 'bot', CAPTURE_NAME_PROMPTS[uiState.lane] || CAPTURE_NAME_PROMPTS.general);
    setInput(input, send, 'Your name...', false);
  }

  function selectLane(chat, input, send, lane) {
    if (!ALLOWED_LANES[lane]) lane = 'general';
    resetState();
    uiState.lane = lane;
    trackEvent('J-Bot Lane Selected', { lane: lane, page: window.location.pathname });
    appendMessage(chat, 'user', ALLOWED_LANES[lane]);

    if (RESOURCE_ROUTES[lane]) {
      appendMessage(chat, 'bot', LANE_PROMPTS[lane]);
      showResources(chat, lane);
      setInput(input, send, 'You can also tell J-Bot what you need...', false);
      return;
    }

    beginCapture(chat, input, send, lane);
  }

  function askUrgency(chat, input, send) {
    uiState.stage = 'urgency';
    var bubble = appendMessage(chat, 'bot', 'Last little routing flag: what is the timing?');
    addActions(bubble, [
      { label: 'Just exploring', action: 'urgency', value: 'Exploring' },
      { label: 'Planning soon', action: 'urgency', value: 'Soon', className: 'primary' },
      { label: 'Need help now', action: 'urgency', value: 'Now', className: 'alt' }
    ]);
    setInput(input, send, 'Or type your timing...', false);
  }

  function showConfirmation(chat, input, send) {
    uiState.stage = 'confirm';
    var laneName = ALLOWED_LANES[uiState.lane] || ALLOWED_LANES.general;
    var summary = 'Lane: ' + laneName + ' | Name: ' + uiState.name + ' | Email: ' + uiState.email + ' | Need: ' + uiState.need + ' | Timing: ' + uiState.urgency;
    var card = appendCard(chat, 'lead-card', 'Ready for the desk', summary);
    var actionRow = addActions(card, [
      { label: 'Send desk note', action: 'submit', className: 'primary' },
      { label: 'Start over', action: 'restart' }
    ]);
    var submitButton = actionRow.querySelector('[data-jbot-action="submit"]');
    prepareTurnstile(card, submitButton);
    setInput(input, send, 'Confirm above or start over...', true);
  }

  function leadFromState(hp) {
    var laneName = ALLOWED_LANES[uiState.lane] || ALLOWED_LANES.general;
    return {
      name: uiState.name,
      email: uiState.email,
      lane: uiState.lane || 'general',
      need: uiState.need,
      urgency: uiState.urgency,
      summary: uiState.name + ' is asking about ' + laneName + ': ' + uiState.need,
      next_step: 'Reply by email for a fit check.',
      safety_note: 'Visitor was warned not to paste sensitive files or details.',
      hp: hp || '',
      turnstile_token: turnstileState.token
    };
  }

  function finishLocalPreview(chat, input, send) {
    appendCard(chat, 'lead-card', 'Preview complete', 'The guided flow works. On twilighttech.io, this final click sends the note to Leads and your email. Nothing was sent from this local preview.');
    uiState.stage = 'done';
    uiState.submitting = false;
    setInput(input, send, 'Preview complete - choose another lane above...', true);
    persistConversation(chat);
  }

  function submitDeskNote(chat, input, send, hp) {
    if (uiState.submitting) return;
    if (!turnstileState.token) {
      appendMessage(chat, 'bot', 'The security check is still finishing. Give it a moment, then send the desk note.');
      return;
    }
    uiState.submitting = true;
    uiState.stage = 'submitting';
    trackEvent('J-Bot Note Attempted', { lane: uiState.lane || 'general', page: window.location.pathname });
    setInput(input, send, 'Filing the desk note...', true);
    appendMessage(chat, 'bot', 'One second. I am filing the note and ringing James\' email bell.');

    if (window.location.protocol === 'file:') {
      window.setTimeout(function () {
        finishLocalPreview(chat, input, send);
      }, 450);
      return;
    }

    submitLead(leadFromState(hp)).then(function (result) {
      var destinations = [];
      if (result.lead_saved) destinations.push('Leads');
      if (result.email_sent) destinations.push('email');
      var destinationText = destinations.length ? destinations.join(' + ') : 'the front desk';
      clearTurnstileWidget();
      appendCard(chat, 'lead-card', 'Desk note filed', 'Your note reached ' + destinationText + '. James has what he needs and normally replies within one business day.');
      if (result.warnings && result.warnings.length) {
        appendMessage(chat, 'bot', result.warnings.join(' '));
      }
      uiState.stage = 'done';
      uiState.submitting = false;
      trackEvent('J-Bot Note Filed', { lane: uiState.lane || 'general', lead_saved: result.lead_saved ? 'yes' : 'no', email_sent: result.email_sent ? 'yes' : 'no' });
      setInput(input, send, 'Desk note sent - choose another lane above...', true);
      persistConversation(chat);
    }).catch(function () {
      clearTurnstileWidget();
      var card = appendCard(chat, 'link-card', 'The desk line hiccupped', 'Your note did not leave the site. You can email Twilight Tech directly and keep moving.');
      var retryRow = addActions(card, [
        { label: 'Email Twilight Tech', href: 'mailto:support@twilighttech.io?subject=J-Bot%20front%20desk%20note' },
        { label: 'Try again', action: 'retry', className: 'primary' }
      ]);
      prepareTurnstile(card, retryRow.querySelector('[data-jbot-action="retry"]'));
      uiState.stage = 'confirm';
      uiState.submitting = false;
      trackEvent('J-Bot Note Failed', { lane: uiState.lane || 'general', page: window.location.pathname });
      setInput(input, send, 'Use the options above...', true);
      persistConversation(chat);
    });
  }

  function handleText(chat, input, send) {
    var value = input.value.trim();
    if (!value || uiState.submitting) return;
    input.value = '';

    if (uiState.stage === 'idle' || uiState.stage === 'done') {
      var selectedLane = uiState.lane || 'general';
      resetState();
      uiState.lane = selectedLane;
      uiState.need = value;
      appendMessage(chat, 'user', value);
      if (hasSensitiveContent(value)) {
        appendMessage(chat, 'bot', 'Keep the note high-level, please. No names, file contents, passwords, or other private details.');
      }
      beginCapture(chat, input, send, selectedLane);
      uiState.need = value;
      return;
    }

    if (uiState.stage === 'name') {
      uiState.name = neutralize(value, LIMITS.name);
      if (!uiState.name) {
        appendMessage(chat, 'bot', 'I missed the name. What should I call you?');
        return;
      }
      appendMessage(chat, 'user', uiState.name);
      uiState.stage = 'email';
      appendMessage(chat, 'bot', 'Good to meet you, ' + uiState.name + '. What email should James use to reply?');
      setInput(input, send, 'you@example.com', false);
      return;
    }

    if (uiState.stage === 'email') {
      if (!isEmail(value)) {
        appendMessage(chat, 'bot', 'That email looks a little sideways. Give it one more shot.');
        setInput(input, send, 'you@example.com', false);
        return;
      }
      uiState.email = neutralize(value, LIMITS.email).toLowerCase();
      appendMessage(chat, 'user', uiState.email);
      if (uiState.need) {
        askUrgency(chat, input, send);
      } else {
        uiState.stage = 'need';
        appendMessage(chat, 'bot', (NEED_PROMPTS[uiState.lane] || NEED_PROMPTS.general) + ' Keep it high-level - no client files, passwords, medical details, or private records.');
        setInput(input, send, 'A short, high-level description...', false);
      }
      return;
    }

    if (uiState.stage === 'need') {
      uiState.need = neutralize(value, LIMITS.need);
      if (!uiState.need) {
        appendMessage(chat, 'bot', 'Give me one short, high-level sentence so I can route this correctly.');
        return;
      }
      appendMessage(chat, 'user', uiState.need);
      if (hasSensitiveContent(uiState.need)) {
        appendMessage(chat, 'bot', 'I flagged that for careful handling. Please do not add names, record contents, passwords, or other private details. The high-level note is enough.');
      }
      askUrgency(chat, input, send);
      return;
    }

    if (uiState.stage === 'urgency') {
      uiState.urgency = neutralize(value, LIMITS.urgency);
      appendMessage(chat, 'user', uiState.urgency);
      showConfirmation(chat, input, send);
    }
  }

  function initFrontDesk() {
    var chat = document.getElementById('jbot-chat');
    var input = document.getElementById('jbot-input');
    var send = document.getElementById('jbot-send');
    var hp = document.getElementById('jbot-company');
    if (!chat || !input || !send) return;
    if (chat.dataset.jbotReady === '1') return;
    chat.dataset.jbotReady = '1';
    activeChat = chat;
    baseChatMarkup = chat.innerHTML;

    var restored = restoreConversation(chat);
    var widget = document.getElementById('jbot-widget');
    if (!restored && widget && ALLOWED_LANES[widget.dataset.jbotDefaultLane]) {
      uiState.lane = widget.dataset.jbotDefaultLane;
    }

    if (restored) {
      if (uiState.stage === 'submitting') {
        uiState.stage = 'confirm';
        uiState.submitting = false;
        var recovery = appendCard(chat, 'link-card', 'Desk note paused', 'The page changed while I was filing. Nothing is lost - use the button below to send it again.');
        var recoveryRow = addActions(recovery, [{ label: 'Send desk note', action: 'retry', className: 'primary' }]);
        prepareTurnstile(recovery, recoveryRow.querySelector('[data-jbot-action="retry"]'));
        setInput(input, send, 'Use the retry button above...', true);
      } else if (uiState.stage === 'name') {
        setInput(input, send, 'Your name...', false);
      } else if (uiState.stage === 'email') {
        setInput(input, send, 'you@example.com', false);
      } else if (uiState.stage === 'need') {
        setInput(input, send, 'A short, high-level description...', false);
      } else if (uiState.stage === 'urgency') {
        setInput(input, send, 'Or type your timing...', false);
      } else if (uiState.stage === 'confirm') {
        var restoredSubmitButtons = chat.querySelectorAll('[data-jbot-action="submit"], [data-jbot-action="retry"]');
        var restoredSubmitButton = restoredSubmitButtons[restoredSubmitButtons.length - 1];
        if (restoredSubmitButton) {
          prepareTurnstile(restoredSubmitButton.closest('.lead-card, .link-card'), restoredSubmitButton);
        }
        setInput(input, send, 'Confirm above or start over...', true);
      } else if (uiState.stage === 'done') {
        setInput(input, send, 'Desk note sent - choose another lane above...', true);
      }
      scrollChat(chat);
    } else {
      persistConversation(chat);
    }

    chat.addEventListener('click', function (event) {
      var laneButton = event.target.closest('[data-jbot-lane]');
      if (laneButton) {
        if (uiState.submitting) return;
        input.disabled = false;
        send.disabled = false;
        selectLane(chat, input, send, laneButton.dataset.jbotLane);
        return;
      }

      var resourceLink = event.target.closest('a.chat-action');
      if (resourceLink) {
        trackEvent('J-Bot Resource Clicked', { lane: uiState.lane || 'general', resource: resourceLink.textContent.trim() });
        return;
      }

      var button = event.target.closest('[data-jbot-action]');
      if (!button) return;
      var action = button.dataset.jbotAction;
      var value = button.dataset.jbotValue || '';

      if (action === 'capture') {
        if (uiState.submitting) return;
        beginCapture(chat, input, send, value || uiState.lane || 'general');
      } else if (action === 'urgency') {
        if (uiState.stage !== 'urgency') return;
        uiState.urgency = value;
        appendMessage(chat, 'user', value);
        showConfirmation(chat, input, send);
      } else if (action === 'submit' && uiState.stage === 'confirm') {
        submitDeskNote(chat, input, send, hp ? hp.value : '');
      } else if (action === 'retry' && uiState.stage === 'confirm') {
        submitDeskNote(chat, input, send, hp ? hp.value : '');
      } else if (action === 'restart') {
        chat.innerHTML = baseChatMarkup;
        resetState();
        if (widget && ALLOWED_LANES[widget.dataset.jbotDefaultLane]) {
          uiState.lane = widget.dataset.jbotDefaultLane;
        }
        setInput(input, send, 'Pick a lane or tell J-Bot what you need...', false);
        scrollChat(chat);
      }
    });

    send.addEventListener('click', function () {
      handleText(chat, input, send);
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleText(chat, input, send);
      }
    });
  }

  window.TwilightJBot.initFrontDesk = initFrontDesk;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFrontDesk);
  } else {
    initFrontDesk();
  }
})();
