/* Twilight Tech — shared site JS: starfield canvas, hero particles, scroll reveal, mobile nav.
   Starfield logic preserved verbatim from the original site. */
(function () {
  // ── GLOBAL CANVAS STARFIELD (runs on every page) ──
  const canvas = document.getElementById('global-particles');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);

    const COLORS = [
      'rgba(0,240,255,',   // cyan
      'rgba(255,255,255,', // white
      'rgba(0,240,255,',   // cyan (more common)
      'rgba(255,0,229,',   // magenta (rare)
      'rgba(57,255,20,',   // green (rare)
    ];
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 1.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      speed: 0.00008 + Math.random() * 0.00015,
      opacity: 0.15 + Math.random() * 0.65,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.008 + Math.random() * 0.015,
      drift: (Math.random() - 0.5) * 0.00006,
    }));
    const orbs = Array.from({ length: 6 }, () => ({
      x: Math.random(), y: Math.random(), r: 60 + Math.random() * 120,
      color: Math.random() > 0.5 ? '0,240,255' : '124,92,191',
      opacity: 0.018 + Math.random() * 0.025,
      dx: (Math.random() - 0.5) * 0.00012, dy: (Math.random() - 0.5) * 0.00008,
    }));

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width, H = canvas.height;
      orbs.forEach(o => {
        o.x += o.dx; o.y += o.dy;
        if (o.x < -0.2) o.x = 1.2; if (o.x > 1.2) o.x = -0.2;
        if (o.y < -0.2) o.y = 1.2; if (o.y > 1.2) o.y = -0.2;
        const grd = ctx.createRadialGradient(o.x * W, o.y * H, 0, o.x * W, o.y * H, o.r);
        grd.addColorStop(0, `rgba(${o.color},${o.opacity})`);
        grd.addColorStop(1, `rgba(${o.color},0)`);
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(o.x * W, o.y * H, o.r, 0, Math.PI * 2); ctx.fill();
      });
      stars.forEach(s => {
        s.pulse += s.pulseSpeed; s.x += s.drift; s.y -= s.speed;
        if (s.y < -0.02) { s.y = 1.02; s.x = Math.random(); }
        if (s.x < 0) s.x = 1; if (s.x > 1) s.x = 0;
        const alpha = s.opacity * (0.6 + 0.4 * Math.sin(s.pulse));
        ctx.shadowBlur = s.r > 1.2 ? 6 : 3; ctx.shadowColor = s.color + '0.8)';
        ctx.fillStyle = s.color + alpha + ')';
        ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.shadowBlur = 0;
      requestAnimationFrame(draw);
    }
    draw();
  }

  // ── HERO FLOATING PARTICLES ──
  const pc = document.getElementById('particles');
  if (pc) {
    for (let i = 0; i < 26; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDuration = (8 + Math.random() * 12) + 's';
      p.style.animationDelay = (Math.random() * 12) + 's';
      pc.appendChild(p);
    }
  }

  // ── SCROLL REVEAL ──
  const obs = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

  // ── MOBILE NAV ──
  const tog = document.querySelector('.mob-tog');
  const links = document.querySelector('.nav-links');
  if (tog && links) tog.addEventListener('click', () => links.classList.toggle('open'));

  // ── A LA CARTE CATEGORY FILTER ──
  const catTabs = document.querySelectorAll('.cat-tab');
  if (catTabs.length) {
    catTabs.forEach(t => t.addEventListener('click', () => {
      catTabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      const c = t.dataset.cat;
      document.querySelectorAll('.addon-card').forEach(card => {
        const cats = (card.dataset.cats || '').split(' ');
        card.classList.toggle('hidden', c !== 'all' && !cats.includes(c));
      });
    }));
  }
})();
