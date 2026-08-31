(function () {
  'use strict';

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  window.TwilightFrontDeskContent = deepFreeze({
    version: '2026-08-11',
    supportEmail: 'james@twilighttech.io',
    shell: {
      subtitle: 'Twilight Tech front desk',
      overline: 'Start here',
      introTitle: 'What should we do next?',
      introCopy: "Choose what you need and I'll take you to the right place.",
      safety: 'Please do not paste private client files, child or custody details, health information, passwords, or urgent crisis details here.',
      inputPlaceholder: 'Pick a route or leave a high-level note...',
      consent: 'By sending, you agree Twilight Tech may reply by email. Do not include sensitive information.',
      launcherTitle: 'Need direction?',
      launcherCopy: 'Open the Twilight Tech front desk.'
    },
    lanes: [
      { slug: 'private-ai', icon: 'AI', label: 'Private AI', leadLabel: 'Private AI', detail: 'Sensitive document systems', className: 'private' },
      { slug: 'site-chat', icon: 'IN', label: 'Website Front Desk', leadLabel: 'Website Chat / Intake', detail: 'Guided site intake', className: 'intake' },
      { slug: 'system-care', icon: 'SYS', label: 'System Care', leadLabel: 'System Care', detail: 'Support and cleanup', className: 'system' },
      { slug: 'guides', icon: 'PDF', label: 'Guides', leadLabel: 'Guides / Freebies', detail: 'Learning and free resources', className: 'guides' },
      { slug: 'breakroom', icon: 'BR', label: 'BreakRoom', leadLabel: 'BreakRoom', detail: 'Community', className: 'breakroom' },
      { slug: 'aptsu', icon: 'UP', label: 'A Place To Show Up', leadLabel: 'A Place To Show Up', detail: 'Community platform', className: 'aptsu' },
      { slug: 'personal-ai', label: 'Personal AI Assistant', leadLabel: 'Personal AI Assistant' },
      { slug: 'solutions', label: 'Custom Operational Systems', leadLabel: 'Twilight Tech Solutions' },
      { slug: 'general', label: 'General', leadLabel: 'General' }
    ],
    pageContexts: [
      {
        prefixes: ['/ai/yours'], lane: 'solutions', label: 'Twilight Tech Solutions', step: 'Map the operating problem',
        message: 'You are looking at purpose-built operational systems. I can show you the proof in Labs or help you leave James one clear operating problem.'
      },
      {
        prefixes: ['/site-chat'], lane: 'site-chat', label: 'Website Front Desk', step: 'Explore the guided build',
        message: 'You are looking at the Front Desk itself. I can show you what it does, what ships, or help you leave James a clean build note.'
      },
      {
        prefixes: ['/ai'], lane: 'private-ai', label: 'Private AI', step: 'Explore private systems',
        message: 'You are in the Private AI wing. I can show you the services, open the working demo, or help you leave James a high-level fit note.'
      },
      {
        prefixes: ['/services', '/managed-it'], lane: 'system-care', label: 'Services', step: 'Find the right service',
        message: 'You are looking at Twilight Tech services. I can route a support need, show the service catalog, or prepare a direct note for James.'
      },
      {
        prefixes: ['/guides', '/cheat-sheet', '/homelab-starter', '/roadmap', '/strategy', '/labs'], lane: 'guides', label: 'Guides', step: 'Find a learning path',
        message: 'You are in the learning lane. I can open the right guide or free resource, point you toward the BreakRoom, or take a note for James.'
      },
      {
        prefixes: ['/about'], lane: '', label: 'About Twilight Tech', step: 'Choose where you are headed',
        message: 'You are reading the founder story. I can route you toward learning, business support, Private AI, or a direct note to James.'
      }
    ],
    defaultContext: {
      lane: '', label: 'Twilight Tech', step: 'Choose where you are headed',
      message: 'I can route you toward learning, business support, Private AI, the BreakRoom, A Place To Show Up, or a direct note to James.'
    },
    prompts: {
      laneSelected: {
        'private-ai': 'Private AI selected. Here is what Twilight Tech offers.',
        'site-chat': 'Website Front Desk selected. Here is what ships.',
        'system-care': 'System Care selected. Here are the support doors.',
        'guides': 'Guides selected. I can route you there now.',
        'breakroom': 'BreakRoom selected. Community doors are this way.',
        'aptsu': 'A Place To Show Up selected. I have the right door.',
        'general': 'I can route that and prepare a clean note for James.'
      },
      captureName: {
        'private-ai': 'Private AI it is. To start the desk note, what should I call you?',
        'site-chat': 'A site chat build. Nice. To start the desk note, what should I call you?',
        'system-care': 'Tech chaos has entered the front desk. What should I call you?',
        'guides': 'I can leave James a note about the Guides. What should I call you?',
        'breakroom': 'I can leave James a BreakRoom note. What should I call you?',
        'aptsu': 'I can leave James a note about A Place To Show Up. What should I call you?',
        'general': 'I can route that. What should I call you?'
      },
      need: {
        'private-ai': 'At a high level, what documents or workflow should Private AI help with?',
        'site-chat': 'What should the site chat help visitors do - find answers, qualify a need, book, or leave a clean note?',
        'system-care': 'What part of the tech setup is causing the most drag right now?',
        'guides': 'What kind of guide or learning help are you looking for?',
        'breakroom': 'What would you like James to know about the BreakRoom?',
        'aptsu': 'What would you like James to know about A Place To Show Up?',
        'general': 'What are you trying to get done?'
      }
    },
    resources: {
      'private-ai': {
        title: 'Private AI',
        copy: 'Private document systems built around approved sources, citations, controlled access, and clear data boundaries.',
        links: [
          { label: 'Explore Private AI', href: 'https://twilighttech.io/ai/' },
          { label: 'Try the document demo', href: 'https://twilighttech.io/ai/#demo' },
          { label: 'Discuss the Private AI path', href: 'https://calendar.app.google/qeAHSWoSLsiL3DqW9' }
        ]
      },
      'site-chat': {
        title: 'Website Front Desk Build',
        copy: 'See exactly what ships, what it costs, and how the front desk keeps every visitor on a clear next step.',
        links: [{ label: 'Explore the Website Front Desk', href: 'https://twilighttech.io/site-chat/' }]
      },
      'system-care': {
        title: 'System Care',
        copy: 'Practical support for the systems your team depends on, from one-time cleanup to ongoing managed IT and security.',
        links: [
          { label: 'See Managed IT', href: 'https://twilighttech.io/managed-it/' },
          { label: 'Browse technical services', href: 'https://twilighttech.io/services/' }
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
        links: [{ label: 'Visit A Place To Show Up', href: 'https://aplacetoshowup.com/' }]
      }
    },
    urgencyOptions: [
      { label: 'Just exploring', value: 'Exploring' },
      { label: 'Planning soon', value: 'Soon', className: 'primary' },
      { label: 'Need help now', value: 'Now', className: 'alt' }
    ],
    stages: {
      idle: { status: 'Ready', step: 'Choose a route' },
      resource: { status: 'Ready', step: 'Choose a next step' },
      name: { status: 'Desk note', step: 'Add your name' },
      email: { status: 'Desk note', step: 'Add a reply email' },
      need: { status: 'Fit check', step: 'Describe the need' },
      urgency: { status: 'Fit check', step: 'Choose the timing' },
      confirm: { status: 'Review', step: 'Verify and send' },
      submitting: { status: 'Sending', step: 'Filing the desk note' },
      done: { status: 'Complete', step: 'Choose another route' },
      security: { status: 'Security', step: 'Complete verification' },
      error: { status: 'Paused', step: 'Use a safe fallback' }
    }
  });
})();
