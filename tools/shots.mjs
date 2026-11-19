// Takes pictures of the built site without opening a window.
//
//   npm run build && npm run shots            every page, desktop and phone
//   npm run shots -- /caltransfer/            one page
//   npm run shots -- / film                   a short film of one page in use
//   npm run shots -- / og                     the share picture, public/og.png
//
// Serves dist/ from this process on a spare port, drives a headless
// Chromium (Helium here; set BROWSER to use another) down each page a
// screen at a time, and writes PNGs to .shots/. Anything a page logs as an
// error, any request that fails and any sideways scroll is printed, and
// the run fails on it.

import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const out = fileURLToPath(new URL('../.shots/', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

const everyPage = ['/', '/pickaxeplanet/', '/caltransfer/', '/pickaxeplanet/privacy/', '/caltransfer/privacy/', '/404.html'];
const only = process.argv[2];
const mode = process.argv[3] ?? 'stills';
const pages = only ? [only] : everyPage;
const sizes = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const slug = (p) => (p === '/' ? 'home' : p.replace(/^\/|\/$|\.html$/g, '').replace(/\//g, '-'));

const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER ?? '/usr/bin/helium',
  headless: true,
  args: ['--hide-scrollbars'],
  // Its own profile, kept between runs (see the note below), and never
  // the one you browse with.
  userDataDir: fileURLToPath(new URL('../node_modules/.cache/shots-profile', import.meta.url)),
});

// Several times on 2026-11-19 the first page opened after the browser
// started was reloaded or had its load aborted a few seconds in, which
// killed the run. It only happened on the first launch after some idle
// minutes; eighteen launches in a row, on a blank page and on the home
// page, never did it. The guess, not proven: the browser finishing its own
// start-up in a brand new profile. So the profile is kept between runs,
// the browser gets a page to settle on first, each page says so if it goes
// anywhere by itself, and a page that fails is tried once more.
const settle = await browser.newPage();
await settle.goto(base + '/robots.txt').catch(() => {});
await wait(2500);
await settle.close();

const errors = [];
// What goes wrong on a page is kept with that attempt at the page, so a
// first attempt the browser spoiled does not fail a second one that worked.
const watch = (page, label, found) => {
  page.on('console', (m) => m.type() === 'error' && found.push(`${label}: ${m.text()}`));
  page.on('pageerror', (e) => found.push(`${label}: ${e.message}`));
  page.on('requestfailed', (r) => found.push(`${label}: failed ${r.url()}`));
  page.on('response', (r) => r.status() >= 400 && found.push(`${label}: ${r.status()} ${r.url()}`));
};
const open = async (path, viewport, label, found = errors) => {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  watch(page, label, found);
  await page.goto(base + path, { waitUntil: 'networkidle0' });
  // A page has no reason to go anywhere once it has loaded. If one does,
  // say where, so the cause is on record.
  page.on('framenavigated', (f) => f === page.mainFrame() && console.error(`${label}: went to ${f.url()} by itself`));
  await page.evaluate(() => document.fonts.ready);
  return page;
};

if (mode === 'stills') {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  for (const path of pages) {
    for (const [name, viewport] of Object.entries(sizes)) {
      const label = `${slug(path)} ${name}`;
      await stills(path, name, viewport, label).catch(async (e) => {
        console.error(`${label}: ${e.message.split('\n')[0]} (trying once more)`);
        await wait(3000);
        await stills(path, name, viewport, label);
      });
    }
  }
}

async function stills(path, name, viewport, label) {
  const found = [];
  const page = await open(path, viewport, label, found);
  const vh = viewport.height;
  const end = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  // A screen at a time, and one stop part way so a fold is caught open.
  const stops = [0];
  if (end > vh * 0.45) stops.push(Math.round(vh * 0.45));
  for (let y = Math.round(vh * 0.92); y < end; y += Math.round(vh * 0.92)) stops.push(y);
  if (end > 0) stops.push(end);

  let i = 0;
  for (const y of stops) {
    await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), y);
    if (name === 'desktop') await page.mouse.move(viewport.width * (0.25 + 0.5 * (i % 2)), vh * 0.35);
    await wait(1300);
    await page.screenshot({ path: join(out, `${slug(path)}-${name}-${String(i).padStart(2, '0')}.png`) });
    i += 1;
  }
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (wide > 0) found.push(`${label}: the page is ${wide}px wider than the screen`);
  await page.close();
  errors.push(...found);
}

// A short film: the pointer circling over the top of the page, then a
// steady scroll to the end.
if (mode === 'film') {
  await mkdir(out, { recursive: true });
  const { width, height } = sizes.desktop;
  const page = await open(pages[0], sizes.desktop, 'film');
  const rec = await page.screencast({ path: join(out, `${slug(pages[0])}-tour.webm`) });
  for (let t = 0; t <= 60; t += 1) {
    const a = (t / 60) * Math.PI * 2;
    await page.mouse.move(width / 2 + Math.cos(a) * width * 0.38, height / 2 + Math.sin(a) * height * 0.36);
    await wait(45);
  }
  const end = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let y = 0; y <= end; y += 14) {
    await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), y);
    await page.mouse.move(width / 2 + Math.sin(y / 300) * width * 0.3, height * 0.45);
    await wait(16);
  }
  await wait(800);
  await rec.stop();
  await page.close();
}

// The picture a link to the site shows when it is shared: the top of the
// home page at the size the networks ask for, without the menu.
if (mode === 'og') {
  const page = await open('/', { width: 1200, height: 630, deviceScaleFactor: 1 }, 'og');
  await page.addStyleTag({ content: '.nav { display: none }' });
  await page.mouse.move(380, 150);
  await wait(1500);
  await page.screenshot({ path: fileURLToPath(new URL('../public/og.png', import.meta.url)) });
  await page.close();
}

await browser.close();
server.close();

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(mode === 'og' ? 'wrote public/og.png' : `pictures in ${out}`);
