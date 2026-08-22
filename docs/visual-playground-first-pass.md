# Twilight Tech Visual Playground — First Pass

Branch: `experiment/visual-playground`

Path: `/visual-playground/`

This branch adds a standalone reimagined homepage instead of modifying the production homepage. The page is intentionally dependency-light and can be removed by deleting four files.

## Layer map

### HTML — `visual-playground/index.html`

HTML creates the actual page structure:

- Navigation
- Hero copy
- Stage selector
- Buttons and links
- Language explanation cards
- Enter / Sustain / Further cards
- System View dialog
- Accessible labels and reading order

Without HTML, there is no page or interaction surface.

### CSS — `assets/visual-playground.css`

CSS creates the visible design:

- Dynamic Enter / Sustain / Further color themes
- Glass console
- Layout and responsive behavior
- Glow and scan effects
- Card emphasis
- System View presentation
- Motion and reduced-motion fallbacks

The stylesheet is scoped to `body.visual-playground`; it does not alter the rest of the site.

### SVG — `assets/visual-path.svg`

SVG creates the scalable stage map:

- Vector route
- Three stage nodes
- Labels and geometry
- Animated signal pulse
- Resolution-independent rendering

It stays sharp on phones, large monitors, and future displays without exporting multiple bitmap sizes.

### JavaScript — `assets/visual-playground.js`

JavaScript creates behavior:

- Stage selection
- Dynamic copy and CTA updates
- Keyboard navigation
- Hover/focus synchronization
- `Shift + A` System View
- Modal open/close behavior
- Pointer-responsive hero depth
- Reduced-motion awareness

Plain browser JavaScript was chosen for this pass because the repository currently has no TypeScript build pipeline. TypeScript becomes useful when the experiment grows into a state-heavy application with shared contracts and a compilation step.

## Run locally

From the repository root:

```powershell
python -m http.server 8080
```

Then open:

```text
http://localhost:8080/visual-playground/
```

## Production boundary

- `main` is unchanged.
- Existing shared `assets/site.css` and `assets/site.js` are unchanged.
- J-Bot, lead capture, Pages Functions, and production pages are untouched.
- The System View is presentation-only and does not claim live Twilight runtime state.
