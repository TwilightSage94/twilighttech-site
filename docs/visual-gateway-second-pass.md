# Twilight Tech Visual Playground — Three-Gate Pass

Branch: `experiment/visual-playground`

Path: `/visual-gateway/`

Reference: the current production hero screenshot, especially the stacked proportions of:

```text
ENTER TECHNOLOGY.
SUSTAIN TECHNOLOGY.
FURTHER TECHNOLOGY.
```

## What changed from the first playground pass

The first pass was deliberately explanatory. It showed the language layers, a console, a pathway map, and a System View.

This pass answers a different design question:

> What happens when the first viewport behaves like a front door instead of a brochure?

At rest, the page contains only:

- the Twilight Tech identity;
- the three giant gates;
- a quiet interaction hint;
- the responsive starfield.

Supporting copy, destinations, and route choices remain hidden until one stage is selected.

## Interaction

### Idle

- All three gates remain readable.
- The starfield drifts slowly with mixed stage colors.
- Pointer movement creates subtle parallax.
- No destination competes for attention.

### Enter

- Cyan becomes the page accent.
- Particles are attracted toward the Enter line.
- The other two gates dim.
- The route drawer offers Guides, Homelab Starter, and Career Roadmap.

### Sustain

- Green becomes the page accent.
- Particle movement stabilizes.
- Nearby stars draw network-like connections.
- The route drawer offers Managed IT, Services, and Front Desk.

### Further

- Magenta becomes the page accent.
- Stars orbit around the active line.
- The other two gates dim.
- The route drawer offers Private AI, AI Operations, and Twilight Labs.

### Routing

- Hover or keyboard focus previews a gate.
- First click locks the gate and reveals destinations.
- Clicking the selected gate again uses its primary route.
- Selecting a destination runs a short transition before navigation.
- Escape closes the selected gate.

## Language map

### HTML

`visual-gateway/index.html`

Creates the three semantic buttons, route drawer, navigation, fallback links, labels, and accessible interaction structure.

### CSS

`assets/visual-gateway.css`

Recreates the screenshot’s giant stacked proportions, stage colors, lighting, dimming, responsive layout, drawer, and routing transition.

### JavaScript

`assets/visual-gateway.js`

Owns stage preview/locking, keyboard controls, route population, transitions, pointer state, and the canvas particle behaviors.

### Canvas API

The canvas is driven by JavaScript rather than a separate language. It gives the starfield stage-specific movement:

- convergence for Enter;
- network stabilization for Sustain;
- orbit for Further.

## Production boundary

- `main` is unchanged.
- Production `index.html` is unchanged.
- Shared `assets/site.css` and `assets/site.js` are unchanged.
- J-Bot, lead capture, Pages Functions, and live routes are unchanged.
- This page is `noindex,nofollow`.
