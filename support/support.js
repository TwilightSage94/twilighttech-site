(function () {
  'use strict';

  var routes = {
    support: {
      title: 'Let’s get the issue to the right place.',
      copy: 'For troubleshooting, account access, a device problem, or an active service issue, start with the Twilight Tech Front Desk. Keep the note high-level and never include credentials or private files.',
      links: [
        { label: 'Open the Front Desk', action: 'frontdesk', primary: true },
        { label: 'Browse services', href: 'https://twilighttech.io/services/' }
      ],
      boundary: 'The public Help Center does not inspect your device or account and does not create a support ticket.'
    },
    guides: {
      title: 'The Guides library is the best starting point.',
      copy: 'Twilight Tech has practical study guides, free resources, a homelab starter, and the Build It, Break It roadmap.',
      links: [
        { label: 'Browse all guides', href: 'https://twilighttech.io/guides/', primary: true },
        { label: 'Free A+ cheat sheet', href: 'https://twilighttech.io/cheat-sheet/' },
        { label: 'Homelab starter', href: 'https://twilighttech.io/homelab-starter/' },
        { label: 'Build It, Break It roadmap', href: 'https://twilighttech.io/roadmap/' }
      ],
      boundary: 'These are learning resources. They do not guarantee certification, employment, or production access.'
    },
    work: {
      title: 'There are two ways to work with Twilight.',
      copy: 'If you want Twilight Technology to help with a system or support workflow, open the Front Desk and describe the operating problem. For employment, collaboration, or partnership questions, leave a short note saying which kind of opportunity you mean.',
      links: [
        { label: 'Start a work conversation', action: 'frontdesk', primary: true },
        { label: 'See engineering services', href: 'https://twilighttech.io/further/' },
        { label: 'Meet Twilight Technology', href: 'https://twilighttech.io/about/' }
      ],
      boundary: 'A Front Desk note starts a conversation; it is not a contract, job application, or commitment.'
    },
    rover: {
      title: 'Rover is Twilight’s governed support system.',
      copy: 'Rover pairs a natural support experience with reviewed knowledge, clear handoffs, and human authority. You can read the release story or inspect the engineering evidence behind the system.',
      links: [
        { label: 'Meet Rover', href: 'https://twilighttech.io/rover/', primary: true },
        { label: 'See the engineering', href: 'https://labs.twilighttech.io/' },
        { label: 'Explore AI systems', href: 'https://twilighttech.io/ai/' }
      ],
      boundary: 'Public pages describe and demonstrate Rover. They are not connected to a customer environment.'
    },
    services: {
      title: 'Choose the kind of operating help you need.',
      copy: 'Twilight Technology offers managed IT and system care, Private AI, website intake, and custom operational engineering. The Front Desk can help route a need that crosses more than one area.',
      links: [
        { label: 'Browse services', href: 'https://twilighttech.io/services/', primary: true },
        { label: 'Explore Private AI', href: 'https://twilighttech.io/ai/' },
        { label: 'See custom engineering', href: 'https://twilighttech.io/further/' },
        { label: 'Ask the Front Desk', action: 'frontdesk' }
      ],
      boundary: 'Exact scope, access, deliverables, and pricing depend on a reviewed engagement.'
    },
    community: {
      title: 'The community routes are built for different kinds of support.',
      copy: 'Use the learning library for practical resources, the BreakRoom for the Twilight Tech community, or A Place To Show Up for its separate community experience.',
      links: [
        { label: 'Browse learning resources', href: 'https://twilighttech.io/guides/', primary: true },
        { label: 'Join the BreakRoom Discord', href: 'https://discord.gg/QKGsTZRWMx' },
        { label: 'Visit A Place To Show Up', href: 'https://aplacetoshowup.com/' }
      ],
      boundary: 'Each community has its own purpose and rules. Rover only points you to the appropriate public entrance.'
    },
    general: {
      title: 'I’m not confident enough to guess that route.',
      copy: 'Choose the closest topic below or let the Front Desk route your question to a person. Keep the first note high-level.',
      links: [{ label: 'Open the Front Desk', action: 'frontdesk', primary: true }],
      boundary: 'Rover stops when the public information is not specific enough to give a reliable answer.'
    }
  };

  var form = document.getElementById('rover-search-form');
  var input = document.getElementById('rover-search');
  var answer = document.getElementById('rover-answer');
  var answerTitle = document.getElementById('answer-title');
  var answerCopy = document.getElementById('answer-copy');
  var answerLinks = document.getElementById('answer-links');
  var answerBoundary = document.getElementById('answer-boundary');

  function classify(question) {
    var text = question.toLowerCase();
    if (/guide|resource|study|learn|roadmap|cheat sheet|homelab|cert/.test(text)) return 'guides';
    if (/work with|hire|project|build for|collaborat|partner|job|career|opportunit/.test(text)) return 'work';
    if (/rover|artificial intelligence|\bai\b|automation|bot/.test(text)) return 'rover';
    if (/service|managed|private ai|website|system care|engineering/.test(text)) return 'services';
    if (/community|discord|breakroom|show up/.test(text)) return 'community';
    if (/support|help|broken|not working|login|sign in|password|account|device|network|connect|access/.test(text)) return 'support';
    return 'general';
  }

  function openFrontDesk() {
    var trigger = document.querySelector('[data-open-jbot]');
    if (trigger) trigger.click();
  }

  function renderRoute(routeName, question) {
    var route = routes[routeName] || routes.general;
    answerTitle.textContent = route.title;
    answerCopy.textContent = route.copy;
    answerBoundary.textContent = route.boundary;
    answerLinks.replaceChildren();

    route.links.forEach(function (link) {
      var control = document.createElement(link.action ? 'button' : 'a');
      control.textContent = link.label;
      if (link.primary) control.className = 'primary';
      if (link.action === 'frontdesk') {
        control.type = 'button';
        control.addEventListener('click', openFrontDesk);
      } else {
        control.href = link.href;
      }
      answerLinks.appendChild(control);
    });

    answer.hidden = false;
    answer.focus();
    if (typeof window.plausible === 'function') {
      window.plausible('Rover Help Route Shown', { props: { route: routeName, source: question ? 'search' : 'card' } });
    }
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var question = input.value.trim();
    if (!question) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    renderRoute(classify(question), question);
  });

  document.querySelectorAll('[data-question]').forEach(function (button) {
    button.addEventListener('click', function () {
      input.value = button.dataset.question;
      renderRoute(classify(input.value), input.value);
    });
  });

  document.querySelectorAll('[data-route]').forEach(function (button) {
    button.addEventListener('click', function () {
      renderRoute(button.dataset.route, '');
    });
  });
}());
