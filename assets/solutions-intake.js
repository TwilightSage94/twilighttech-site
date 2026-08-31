(function () {
  'use strict';
  var TEST_SITEKEY = '1x00000000000000000000AA';
  var turnstileToken = '';
  var turnstileWidget = null;
  function byId(id) { return document.getElementById(id); }
  function setStatus(el, message, kind) { el.textContent = message || ''; el.className = 'sol-status' + (kind ? ' ' + kind : ''); }
  function track(name, props) { if (typeof window.plausible === 'function') window.plausible(name, props ? { props: props } : undefined); }
  function loadTurnstileScript() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-solutions-turnstile]');
      if (existing) { existing.addEventListener('load', function () { resolve(window.turnstile); }, { once: true }); existing.addEventListener('error', reject, { once: true }); return; }
      var script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true; script.defer = true; script.dataset.solutionsTurnstile = 'true';
      script.onload = function () { resolve(window.turnstile); }; script.onerror = reject; document.head.appendChild(script);
    });
  }
  function getSitekey() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return Promise.resolve(TEST_SITEKEY);
    return fetch('/api/jbot-config', { headers: { Accept: 'application/json' }, cache: 'no-store' }).then(function (response) { if (!response.ok) throw new Error('Security check unavailable.'); return response.json(); }).then(function (result) { if (!result || !result.ok || !result.sitekey) throw new Error('Security check unavailable.'); return result.sitekey; });
  }
  function prepareTurnstile() {
    var container = byId('solutions-turnstile'); var submit = byId('solutions-submit'); var status = byId('solutions-submit-status');
    Promise.all([getSitekey(), loadTurnstileScript()]).then(function (parts) {
      turnstileWidget = parts[1].render(container, { sitekey: parts[0], theme: 'dark', appearance: 'interaction-only', action: 'jbot_lead', callback: function (token) { turnstileToken = token; submit.disabled = false; setStatus(status, 'Ready.', ''); }, 'expired-callback': function () { turnstileToken = ''; submit.disabled = true; setStatus(status, 'Please complete the security check again.', 'error'); }, 'error-callback': function () { turnstileToken = ''; submit.disabled = true; setStatus(status, 'Security check did not load. Refresh and try again.', 'error'); } });
    }).catch(function () { submit.disabled = true; setStatus(status, 'Security check unavailable. Email james@twilighttech.io.', 'error'); });
  }
  function waitForLeadDesk() {
    return new Promise(function (resolve, reject) { var attempts = 0; var timer = window.setInterval(function () { attempts += 1; if (window.TwilightJBot && typeof window.TwilightJBot.submitLead === 'function') { window.clearInterval(timer); resolve(window.TwilightJBot); } else if (attempts >= 40) { window.clearInterval(timer); reject(new Error('The lead desk is still loading. Please try again.')); } }, 100); });
  }
  function init() {
    var form = byId('solutions-form'); if (!form) return;
    var answer = byId('solutions-answer'); var details = byId('solutions-details'); var continueButton = byId('solutions-continue'); var firstStatus = byId('solutions-status'); var submitStatus = byId('solutions-submit-status'); var submitButton = byId('solutions-submit'); var securityStarted = false;
    function revealDetails() { if (answer.value.trim().length < 12) { setStatus(firstStatus, 'Give James one complete sentence to work with.', 'error'); answer.focus(); return; } setStatus(firstStatus, '', ''); details.classList.add('show'); details.setAttribute('aria-hidden', 'false'); continueButton.hidden = true; if (!securityStarted) { securityStarted = true; prepareTurnstile(); } byId('solutions-name').focus(); track('Solutions Form Continued'); }
    continueButton.addEventListener('click', revealDetails);
    answer.addEventListener('keydown', function (event) { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') revealDetails(); });
    form.addEventListener('submit', function (event) {
      event.preventDefault(); var problem = answer.value.trim(); var name = byId('solutions-name').value.trim(); var email = byId('solutions-email').value.trim(); var stage = byId('solutions-stage').value;
      if (problem.length < 12 || !email) { setStatus(submitStatus, 'Add the problem and a working email.', 'error'); return; }
      if (!turnstileToken) { setStatus(submitStatus, 'Complete the security check first.', 'error'); return; }
      submitButton.disabled = true; setStatus(submitStatus, 'Sending...', '');
      waitForLeadDesk().then(function (desk) { return desk.submitLead({ lane: 'solutions', name: name, email: email, need: problem, urgency: stage, summary: (name ? name + ' — ' : '') + stage + ': ' + problem, next_step: 'James to review the operating problem and reply with a fit or mapping next step.', safety_note: 'Open-ended Solutions campaign response; no sensitive files requested.', hp: byId('solutions-website').value, turnstile_token: turnstileToken }); }).then(function (result) {
        form.innerHTML = '<div class="sol-success" role="status"><strong>Problem received.</strong><p>James will read it personally and reply with the clearest next step.</p></div>';
        track('Solutions Problem Submitted', { stage: stage, lead_saved: result.lead_saved ? 'yes' : 'no', email_sent: result.email_sent ? 'yes' : 'no' });
      }).catch(function (error) { submitButton.disabled = false; setStatus(submitStatus, error.message || 'That did not send. Try again or email james@twilighttech.io.', 'error'); if (window.turnstile && turnstileWidget !== null) { turnstileToken = ''; window.turnstile.reset(turnstileWidget); } });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
