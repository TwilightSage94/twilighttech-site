(function () {
  'use strict';

  var TEST_SITEKEY = '1x00000000000000000000AA';
  var turnstileToken = '';
  var turnstileWidget = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(element, message, kind) {
    element.textContent = message || '';
    element.className = 'idea-status' + (kind ? ' ' + kind : '');
  }

  function track(name, props) {
    if (typeof window.plausible === 'function') {
      window.plausible(name, props ? { props: props } : undefined);
    }
  }

  function loadTurnstileScript() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-personal-ai-turnstile]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.turnstile); }, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      var script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.personalAiTurnstile = 'true';
      script.onload = function () { resolve(window.turnstile); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function getSitekey() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return Promise.resolve(TEST_SITEKEY);
    }
    return fetch('/api/jbot-config', { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('Security check unavailable.');
        return response.json();
      })
      .then(function (result) {
        if (!result || !result.ok || !result.sitekey) throw new Error('Security check unavailable.');
        return result.sitekey;
      });
  }

  function prepareTurnstile() {
    var container = byId('idea-turnstile');
    var submit = byId('idea-submit');
    var status = byId('idea-submit-status');

    Promise.all([getSitekey(), loadTurnstileScript()]).then(function (parts) {
      var sitekey = parts[0];
      var turnstile = parts[1];
      turnstileWidget = turnstile.render(container, {
        sitekey: sitekey,
        theme: 'dark',
        appearance: 'interaction-only',
        action: 'jbot_lead',
        callback: function (token) {
          turnstileToken = token;
          submit.disabled = false;
          setStatus(status, 'Ready.', '');
        },
        'expired-callback': function () {
          turnstileToken = '';
          submit.disabled = true;
          setStatus(status, 'Please complete the security check again.', 'error');
        },
        'error-callback': function () {
          turnstileToken = '';
          submit.disabled = true;
          setStatus(status, 'Security check did not load. Refresh and try again.', 'error');
        }
      });
    }).catch(function () {
      submit.disabled = true;
      setStatus(status, 'Security check unavailable. Refresh or email james@twilighttech.io.', 'error');
    });
  }

  function waitForLeadDesk() {
    return new Promise(function (resolve, reject) {
      var attempts = 0;
      var timer = window.setInterval(function () {
        attempts += 1;
        if (window.TwilightJBot && typeof window.TwilightJBot.submitLead === 'function') {
          window.clearInterval(timer);
          resolve(window.TwilightJBot);
        } else if (attempts >= 40) {
          window.clearInterval(timer);
          reject(new Error('The lead desk is still loading. Please try again.'));
        }
      }, 100);
    });
  }

  function init() {
    var form = byId('personal-ai-form');
    var answer = byId('idea-answer');
    var details = byId('idea-details');
    var continueButton = byId('idea-continue');
    var firstStatus = byId('idea-status');
    var submitStatus = byId('idea-submit-status');
    var submitButton = byId('idea-submit');
    var audienceInput = byId('idea-audience');
    var securityStarted = false;

    function revealDetails() {
      if (answer.value.trim().length < 3) {
        setStatus(firstStatus, 'Give me a little something first.', 'error');
        answer.focus();
        return;
      }
      setStatus(firstStatus, '', '');
      details.classList.add('show');
      details.setAttribute('aria-hidden', 'false');
      continueButton.hidden = true;
      if (!securityStarted) {
        securityStarted = true;
        prepareTurnstile();
      }
      byId('idea-name').focus();
      track('Personal AI Form Continued');
    }

    continueButton.addEventListener('click', revealDetails);
    answer.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') revealDetails();
    });

    document.querySelectorAll('.idea-choice').forEach(function (button) {
      button.addEventListener('click', function () {
        document.querySelectorAll('.idea-choice').forEach(function (choice) {
          choice.classList.toggle('selected', choice === button);
        });
        audienceInput.value = button.dataset.audience || '';
      });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var idea = answer.value.trim();
      var name = byId('idea-name').value.trim();
      var email = byId('idea-email').value.trim();
      var audience = audienceInput.value;

      if (idea.length < 3 || !audience || !email) {
        setStatus(submitStatus, 'Choose who it is for and add your email.', 'error');
        return;
      }
      if (!turnstileToken) {
        setStatus(submitStatus, 'Complete the security check first.', 'error');
        return;
      }

      submitButton.disabled = true;
      setStatus(submitStatus, 'Sending...', '');

      waitForLeadDesk().then(function (desk) {
        return desk.submitLead({
          lane: 'personal-ai',
          name: name,
          email: email,
          need: idea,
          urgency: audience,
          summary: (name ? name + ' — ' : '') + audience + ': ' + idea,
          next_step: 'James to review personally and offer a consultation if the idea is a fit.',
          safety_note: 'Open-ended personal AI campaign response; no sensitive files requested.',
          hp: byId('company-website').value,
          turnstile_token: turnstileToken
        });
      }).then(function (result) {
        form.innerHTML = '<div class="idea-success" role="status"><strong>Answer received.</strong><p>James will review it personally and follow up by email.</p></div>';
        track('Personal AI Idea Submitted', {
          audience: audience,
          lead_saved: result.lead_saved ? 'yes' : 'no',
          email_sent: result.email_sent ? 'yes' : 'no'
        });
      }).catch(function (error) {
        submitButton.disabled = false;
        setStatus(submitStatus, error.message || 'That did not send. Try again or email james@twilighttech.io.', 'error');
        if (window.turnstile && turnstileWidget !== null) {
          turnstileToken = '';
          window.turnstile.reset(turnstileWidget);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
