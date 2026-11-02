(function () {
  'use strict';

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  window.FrontDeskContent = deepFreeze({
    version: '2026-11-02.2',
    mode: 'synthetic-preview',
    storagePrefix: 'cedarline_demo_frontdesk',
    supportEmail: 'service@cedarline.demo.invalid',
    assets: {
      runtime: '/assets/frontdesk-runtime.js',
      style: './frontdesk-widget.css?v=20261102-cedarline-v1'
    },
    endpoints: {
      publicAnswers: './frontdesk-public-answers.json'
    },
    syntheticPreview: {
      identityTitle: 'Choose a fictional visitor',
      identityCopy: 'No real contact details are needed. Pick one made-up identity to see the full intake flow.',
      confirmationTitle: 'Ready for the synthetic preview',
      submitLabel: 'Complete synthetic preview',
      receiptTitle: 'Synthetic preview complete',
      receiptCopy: 'Nothing was sent, saved, emailed, or added to a lead system.',
      identities: [
        { id: 'demo-homeowner', label: 'Use Demo Homeowner', name: 'Demo Homeowner', email: 'homeowner@cedarline.demo.invalid' },
        { id: 'demo-property-manager', label: 'Use Demo Property Manager', name: 'Demo Property Manager', email: 'manager@cedarline.demo.invalid' }
      ]
    },
    shell: {
      productName: 'Cedar',
      widgetLabel: 'Cedarline Home Services front desk',
      contactLabel: 'Email the service desk',
      noteLabel: 'Try the synthetic service note',
      submittingCopy: 'Creating a browser-only preview receipt. Nothing is leaving this page.',
      deliveryCopy: 'A service coordinator can review it and reply by email.',
      deliveredStep: 'Service note received',
      previewCopy: 'Demo complete. This fictional preview did not send or save anything.',
      subtitle: 'Service guide',
      overline: 'Fictional demonstration',
      introTitle: 'How can we point you in the right direction?',
      introCopy: 'Choose a service or ask a question. Contact details are optional unless you decide to send a note.',
      safety: 'Do not include alarm codes, door codes, payment details, passwords, or urgent safety information.',
      inputPlaceholder: 'Ask about services, areas, hours, or estimates...',
      consent: 'Synthetic preview only. It never requests real contact details and never sends or saves a service note.',
      launcherTitle: 'Questions first',
      launcherCopy: 'Ask Cedar, then decide whether to leave a note.',
      approvedTopics: 'services, service areas, scheduling hours, estimates, or urgent-situation limits'
    },
    lanes: [
      { slug: 'heating-cooling', icon: 'HC', label: 'Heating & cooling', leadLabel: 'Heating and Cooling', detail: 'Comfort-system visits', className: 'private' },
      { slug: 'plumbing', icon: 'PL', label: 'Plumbing', leadLabel: 'Plumbing', detail: 'Fixtures, leaks, and drains', className: 'intake' },
      { slug: 'electrical', icon: 'EL', label: 'Electrical', leadLabel: 'Electrical', detail: 'Switches, outlets, and fixtures', className: 'system' },
      { slug: 'home-maintenance', icon: 'HM', label: 'Home maintenance', leadLabel: 'Home Maintenance', detail: 'Seasonal upkeep', className: 'guides' },
      { slug: 'general', label: 'General', leadLabel: 'General Service Question' }
    ],
    pageContexts: [
      { prefixes: ['/site-chat/demo'], lane: 'general', label: 'Cedarline demo', step: 'Ask first or choose a service', message: 'I answer from Cedarline\'s small approved fact set. If I do not know, I will say so.' }
    ],
    defaultContext: {
      lane: 'general', label: 'Cedarline demo', step: 'Ask first or choose a service',
      message: 'I answer from Cedarline\'s small approved fact set. If I do not know, I will say so.'
    },
    prompts: {
      laneSelected: {
        'heating-cooling': 'Heating and cooling selected. Here is the approved service overview.',
        plumbing: 'Plumbing selected. Here is the approved service overview.',
        electrical: 'Electrical selected. Here is the approved service overview.',
        'home-maintenance': 'Home maintenance selected. Here is the approved service overview.',
        general: 'General service selected. Ask a question or leave an optional note.'
      },
      captureName: {
        'heating-cooling': 'To start an optional heating and cooling note, what should the coordinator call you?',
        plumbing: 'To start an optional plumbing note, what should the coordinator call you?',
        electrical: 'To start an optional electrical note, what should the coordinator call you?',
        'home-maintenance': 'To start an optional maintenance note, what should the coordinator call you?',
        general: 'To start an optional service note, what should the coordinator call you?'
      },
      need: {
        'heating-cooling': 'At a high level, what is happening with the heating or cooling system?',
        plumbing: 'At a high level, what plumbing issue or project are you asking about?',
        electrical: 'At a high level, what electrical fixture, switch, or outlet needs attention?',
        'home-maintenance': 'What seasonal or routine home task are you asking about?',
        general: 'What would you like the service coordinator to know?'
      }
    },
    resources: {
      'heating-cooling': {
        title: 'Heating & cooling visits',
        copy: 'The fictional service list covers maintenance visits and common residential comfort-system concerns. Availability is confirmed by a coordinator.',
        links: [{ label: 'See demo services', href: '#services' }]
      },
      plumbing: {
        title: 'Plumbing visits',
        copy: 'The fictional service list covers fixtures, visible leaks, and common drain concerns. It does not promise emergency response.',
        links: [{ label: 'See demo services', href: '#services' }]
      },
      electrical: {
        title: 'Electrical visits',
        copy: 'The fictional service list covers switches, outlets, lighting fixtures, and ceiling fans. A coordinator confirms fit and availability.',
        links: [{ label: 'See demo services', href: '#services' }]
      },
      'home-maintenance': {
        title: 'Home maintenance',
        copy: 'The fictional service list covers seasonal checklists, filter changes, and other agreed routine upkeep.',
        links: [{ label: 'See demo services', href: '#services' }]
      }
    },
    urgencyOptions: [
      { label: 'Just asking', value: 'Exploring' },
      { label: 'Planning a visit', value: 'Planning', className: 'primary' },
      { label: 'Soon, if available', value: 'Soon', className: 'alt' }
    ],
    stages: {
      idle: { status: 'Ready', step: 'Ask first or choose a service' },
      resource: { status: 'Ready', step: 'Ask another question or choose a next step' },
      name: { status: 'Optional note', step: 'Add a name' },
      email: { status: 'Optional note', step: 'Add a reply email' },
      need: { status: 'Service note', step: 'Describe the need' },
      urgency: { status: 'Service note', step: 'Choose timing' },
      confirm: { status: 'Review', step: 'Verify before sending' },
      submitting: { status: 'Sending', step: 'Filing the service note' },
      done: { status: 'Complete', step: 'Choose another service' },
      security: { status: 'Security', step: 'Complete verification' },
      error: { status: 'Paused', step: 'Use a safe fallback' }
    }
  });
})();

