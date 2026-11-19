// Moves the light and unfolds the panels. The stylesheet does the drawing;
// this file only writes a handful of numbers for it to use:
//
//   --lx, --ly  where the light is, each -1 to 1 (on <html>)
//   --hp        how far the first panel has scrolled away, 0 to 1 (on <html>)
//   --p         how unfolded a panel is, 0 to 1 (on each [data-fold])
//   --q         how far a panel's contents have settled, 0 to 1 (same)
//   --t         how far down the list of layers the screen is (on [data-depth])
//   data-over   which colour of paper is under the menu (on <html>)
//
// With reduced motion nothing is written and the page stays flat.

const root = document.documentElement;
const still = matchMedia('(prefers-reduced-motion: reduce)');
const folds = [...document.querySelectorAll('[data-fold]')];
const papers = [...document.querySelectorAll('[data-paper]')];
const hero = document.querySelector('[data-hero]');
const counters = [...document.querySelectorAll('[data-count]')];
const shafts = [...document.querySelectorAll('[data-depth]')];

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const ease = (t) => 1 - (1 - t) ** 3;
const smooth = (t) => t * t * (3 - 2 * t);

let light = { x: 0.35, y: -0.45 };
let aim = { ...light };
let pointer = false;
let frame = 0;
let tops = [];

function layout() {
  // offsetTop ignores transforms, so a half-folded panel still reports
  // where it really sits in the page.
  tops = folds.map((el) => el.offsetTop);
}

function scrolled() {
  const y = scrollY;
  const vh = innerHeight;

  if (hero) root.style.setProperty('--hp', clamp(y / hero.offsetHeight).toFixed(4));

  folds.forEach((el, i) => {
    const top = tops[i] - y;
    // A short last panel can never travel a full screen, so it opens over
    // the distance it does have.
    const p = smooth(clamp((vh - top) / Math.min(vh * 0.95, el.offsetHeight * 0.85)));
    const q = ease(clamp((vh * 0.82 - top) / (vh * 0.62)));
    el.style.setProperty('--p', p.toFixed(4));
    el.style.setProperty('--q', q.toFixed(4));
    el.classList.toggle('is-flat', p >= 1);
    if (q > 0.35) count(el);
  });

  // The depth counter: how far down the list of layers the middle of the
  // screen is, as metres, and which layer that is.
  for (const el of shafts) {
    const list = el.querySelector('.shaft__layers');
    const r = list.getBoundingClientRect();
    const t = clamp((vh * 0.5 - r.top) / r.height);
    const items = list.children;
    const here = Math.min(items.length - 1, Math.floor(t * items.length));
    el.style.setProperty('--t', t.toFixed(4));
    el.querySelector('[data-depth-read]').textContent = Math.round(t * 1000);
    for (let i = 0; i < items.length; i += 1) items[i].classList.toggle('is-here', i === here);
  }

  let over = 'paper';
  for (const el of papers) {
    const r = el.getBoundingClientRect();
    if (r.top <= 48 && r.bottom > 48) over = el.dataset.paper;
  }
  if (root.dataset.over !== over) root.dataset.over = over;

  // With no mouse, the light travels as the page does.
  if (!pointer) {
    aim.x = Math.sin(y / 620) * 0.7;
    aim.y = -0.45 + Math.sin(y / 940) * 0.6;
    kick();
  }
}

function count(panel) {
  for (const el of counters) {
    if (el.dataset.done || !panel.contains(el)) continue;
    el.dataset.done = '1';
    const to = Number(el.dataset.count);
    const tail = el.dataset.tail ?? '';
    const start = performance.now();
    const step = (now) => {
      const t = clamp((now - start) / 1100);
      el.textContent = Math.round(to * ease(t)) + tail;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

function kick() {
  if (!frame) frame = requestAnimationFrame(tick);
}

function tick() {
  frame = 0;
  light.x += (aim.x - light.x) * 0.09;
  light.y += (aim.y - light.y) * 0.09;
  root.style.setProperty('--lx', light.x.toFixed(4));
  root.style.setProperty('--ly', light.y.toFixed(4));
  if (Math.abs(aim.x - light.x) + Math.abs(aim.y - light.y) > 0.002) kick();
}

function start() {
  for (const el of shafts) el.querySelector('.shaft').classList.add('is-live');
  layout();
  scrolled();
  addEventListener('scroll', scrolled, { passive: true });
  addEventListener('resize', () => {
    layout();
    scrolled();
  });
  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      pointer = true;
      aim.x = (e.clientX / innerWidth) * 2 - 1;
      aim.y = (e.clientY / innerHeight) * 2 - 1;
      kick();
    },
    { passive: true },
  );
  // Fonts and pictures arriving can move the panels.
  addEventListener('load', () => {
    layout();
    scrolled();
  });
}

if (!still.matches) start();
