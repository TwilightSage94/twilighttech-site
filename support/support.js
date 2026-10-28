(function () {
  'use strict';

  var topics = {
    login: {
      prompt: 'I changed my password, but I still can’t sign in to my workstation.',
      title: 'Start with the approved sign-in path.',
      copy: 'Use the company workstation sign-in screen and confirm the new password works there before reopening other services. If Windows rejects the sign-in, stop repeated attempts and send the visible error to the Service Desk.',
      source: 'KB-JL-LOGIN-001',
      issue: 'Unable to sign in after a password change'
    },
    network: {
      prompt: 'My workstation is connected, but the company service will not open.',
      title: 'Separate the device connection from the service connection.',
      copy: 'Confirm whether another approved company service opens from the same workstation. Record the exact browser or connection error. Do not change network settings unless a technician directs you to.',
      source: 'KB-JL-NETWORK-001',
      issue: 'Company service unavailable from the workstation'
    },
    access: {
      prompt: 'I need access to an application or group for my work.',
      title: 'Use the approved access-request route.',
      copy: 'Name the application or group, the work it supports, and the approving manager or owner if known. Rover can prepare the request, but a person with authority must approve the access change.',
      source: 'KB-JL-ACCESS-001',
      issue: 'Application or group access requested'
    }
  };

  var selected = 'login';
  var starters = Array.prototype.slice.call(document.querySelectorAll('[data-topic]'));
  var question = document.getElementById('support-question');
  var questionError = document.getElementById('question-error');
  var checkButton = document.getElementById('check-guidance');
  var result = document.getElementById('guidance-result');
  var handoffButton = document.getElementById('prepare-handoff');
  var handoff = document.getElementById('handoff-preview');
  var guidanceTitle = document.getElementById('guidance-title');
  var guidanceCopy = document.getElementById('guidance-copy');
  var guidanceSource = document.getElementById('guidance-source');
  var briefIssue = document.getElementById('brief-issue');
  var briefSource = document.getElementById('brief-source');
  var stageLabel = document.getElementById('stage-label');
  var secretPattern = /\b(password|passcode|one[- ]time code|otp|token|api key|secret|recovery (code|key))\s*[:=]/i;

  function selectTopic(button) {
    selected = button.dataset.topic;
    starters.forEach(function (item) {
      item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
    });
    question.value = topics[selected].prompt;
    question.removeAttribute('aria-invalid');
    questionError.hidden = true;
    result.hidden = true;
    handoff.hidden = true;
    stageLabel.textContent = 'Ready';
    question.focus();
  }

  starters.forEach(function (button) {
    button.addEventListener('click', function () { selectTopic(button); });
  });

  checkButton.addEventListener('click', function () {
    var value = question.value.trim();
    if (!value) {
      question.setAttribute('aria-invalid', 'true');
      questionError.textContent = 'Describe what happened before checking the sample guidance.';
      questionError.hidden = false;
      stageLabel.textContent = 'Needs attention';
      question.focus();
      return;
    }
    if (secretPattern.test(value)) {
      question.setAttribute('aria-invalid', 'true');
      questionError.textContent = 'Remove the password, code, token, or recovery key. Keep only the visible error and impact.';
      questionError.hidden = false;
      stageLabel.textContent = 'Remove private data';
      question.focus();
      return;
    }
    question.removeAttribute('aria-invalid');
    questionError.hidden = true;
    var topic = topics[selected];
    guidanceTitle.textContent = topic.title;
    guidanceCopy.textContent = topic.copy;
    guidanceSource.textContent = topic.source;
    briefIssue.textContent = topic.issue;
    briefSource.textContent = topic.source;
    handoff.hidden = true;
    result.hidden = false;
    stageLabel.textContent = 'Guidance ready';
    result.focus();
    if (typeof window.plausible === 'function') window.plausible('Rover Support Preview Checked', { props: { topic: selected } });
  });

  handoffButton.addEventListener('click', function () {
    handoff.hidden = false;
    stageLabel.textContent = 'Handoff preview';
    handoff.focus();
    if (typeof window.plausible === 'function') window.plausible('Rover Handoff Preview Opened', { props: { topic: selected } });
  });

}());
