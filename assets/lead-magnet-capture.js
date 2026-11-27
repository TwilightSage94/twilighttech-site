(function () {
  'use strict';

  var ENDPOINT = '/api/jbot-leads';
  var CONFIG_ENDPOINT = '/api/jbot-config';
  var TEST_SITEKEY = '1x00000000000000000000AA';

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name) || '';
  }

  function loadTurnstileScript() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-lead-magnet-turnstile]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.turnstile); }, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      var script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.leadMagnetTurnstile = 'true';
      script.onload = function () { resolve(window.turnstile); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function getSitekey() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return Promise.resolve(TEST_SITEKEY);
    }
    return fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('Security check unavailable.');
        return response.json();
      })
      .then(function (result) {
        if (!result || !result.ok || !result.sitekey) throw new Error('Security check unavailable.');
        return result.sitekey;
      });
  }

  window.TwilightLeadMagnet = {
    wireForm: function (options) {
      var form = document.getElementById(options.formId || 'rm-form');
      var button = document.getElementById(options.buttonId || 'rm-submit');
      var status = document.getElementById(options.statusId || 'rm-status');
      var deliver = document.getElementById(options.deliverId || 'rm-deliver');
      if (!form || !button || !status || !deliver) return;

      var turnstileToken = '';
      var turnstileWidget = null;
      var turnstileReady = false;
      var turnstileUnavailable = false;

      var tsContainer = document.createElement('div');
      tsContainer.className = 'rm-turnstile';
      tsContainer.style.marginTop = '10px';
      form.parentNode.insertBefore(tsContainer, status);

      Promise.all([getSitekey(), loadTurnstileScript()]).then(function (parts) {
        var sitekey = parts[0];
        var turnstile = parts[1];
        turnstileWidget = turnstile.render(tsContainer, {
          sitekey: sitekey,
          theme: 'dark',
          appearance: 'interaction-only',
          action: 'jbot_lead',
          callback: function (token) {
            turnstileToken = token;
            turnstileReady = true;
          },
          'expired-callback': function () {
            turnstileToken = '';
            turnstileReady = false;
          },
          'error-callback': function () {
            turnstileToken = '';
            turnstileUnavailable = true;
          }
        });
      }).catch(function () {
        turnstileUnavailable = true;
      });

      function reveal(receiptOk, noticeText) {
        form.style.display = 'none';
        tsContainer.style.display = 'none';
        deliver.classList.add('show');
        if (noticeText) {
          status.className = 'rm-status';
          status.textContent = noticeText;
        } else {
          status.className = 'rm-status';
          status.textContent = '';
        }
        if (typeof window.plausible === 'function' && options.eventName) {
          var props = Object.assign(
            {
              source: getParam('utm_source') || '(direct)',
              lead_recorded: receiptOk ? 'yes' : 'no'
            },
            typeof options.extraProps === 'function' ? options.extraProps() : {}
          );
          window.plausible(options.eventName, { props: props });
        }
      }

      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        status.className = 'rm-status';
        status.textContent = '';

        var fd = new FormData(form);
        var email = (fd.get('email') || '').toString().trim();
        var hp = (fd.get('hp') || '').toString();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          status.className = 'rm-status error';
          status.textContent = 'Drop a valid email above first.';
          return;
        }

        if (hp) {
          reveal(false, '');
          return;
        }

        if (!turnstileToken && !turnstileUnavailable) {
          status.className = 'rm-status error';
          status.textContent = 'Complete the security check below, then try again.';
          return;
        }

        if (turnstileUnavailable) {
          reveal(false, 'Download unlocked below. Automated email signup is temporarily unavailable — reach james@twilighttech.io anytime.');
          return;
        }

        button.disabled = true;
        button.textContent = 'Sending…';

        var detail = typeof options.getDetail === 'function' ? options.getDetail() : '';
        var utmSummary = [
          getParam('utm_source') ? 'utm_source=' + getParam('utm_source') : '',
          getParam('utm_medium') ? 'utm_medium=' + getParam('utm_medium') : '',
          getParam('utm_campaign') ? 'utm_campaign=' + getParam('utm_campaign') : '',
          detail
        ].filter(Boolean).join(' | ');

        var payload = {
          lane: 'guides',
          name: '',
          email: email,
          need: (options.guideLabel || 'Guide download') + (utmSummary ? ' (' + utmSummary + ')' : ''),
          urgency: 'Guide download',
          summary: (options.guideLabel || 'Guide download') + ' requested from ' + window.location.pathname + (utmSummary ? ' — ' + utmSummary : ''),
          next_step: 'Deliver guide download link and optional future Enter-track guide drop notice.',
          safety_note: 'Public guide download request; no sensitive client files requested.',
          page: window.location.pathname,
          hp: hp,
          turnstile_token: turnstileToken
        };

        fetch(ENDPOINT, {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload)
        })
          .then(function (r) {
            return r.json().catch(function () { return { ok: false }; }).then(function (body) {
              return { statusOk: r.ok, body: body };
            });
          })
          .then(function (res) {
            var recorded = Boolean(res.statusOk && res.body && res.body.ok && (res.body.lead_saved || res.body.email_sent));
            if (recorded) {
              reveal(true, '');
            } else {
              reveal(false, 'Download unlocked below. We could not confirm email signup receipt right now.');
            }
          })
          .catch(function () {
            reveal(false, 'Download unlocked below. We could not confirm email signup receipt right now.');
          })
          .finally(function () {
            if (window.turnstile && turnstileWidget !== null) {
              turnstileToken = '';
              turnstileReady = false;
              try { window.turnstile.reset(turnstileWidget); } catch (e) { /* ignore */ }
            }
          });
      });
    }
  };
})();
