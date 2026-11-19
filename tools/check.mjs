// Checks the built site before it can be published.
//
//   npm run build && npm run check
//
// Three kinds of thing are checked in dist/:
//
// 1. The addresses other services hold. Each app's privacy policy address
//    is typed into the Play Console and AdMob, AdMob reads /app-ads.txt,
//    and Cloudflare Pages reads /_headers to keep its own pages.dev copy
//    of the site out of search. If any of these moves or changes,
//    something outside this repository breaks quietly.
// 2. Every page: one title, one description, one main heading, a canonical
//    address on stillfold.dev, and structured data that parses.
// 3. Every link and picture inside the site points at a file that exists.

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const problems = [];
const bad = (msg) => problems.push(msg);
const read = async (p) => (existsSync(join(dist, p)) ? readFile(join(dist, p), 'utf8') : null);

// 1. What other services hold.
const held = {
  '_headers': (t) =>
    (/^https:\/\/:project\.pages\.dev\/\*\n  X-Robots-Tag: noindex$/m.test(t) &&
      /^https:\/\/:version\.:project\.pages\.dev\/\*\n  X-Robots-Tag: noindex$/m.test(t)) ||
    'must keep both pages.dev addresses out of search',
  'app-ads.txt': (t) =>
    t.includes('google.com, pub-6590893466122140, DIRECT, f08c47fec0942fa0') || 'the AdMob line is missing',
  'robots.txt': (t) => t.includes('Sitemap: https://stillfold.dev/sitemap-index.xml') || 'does not name the sitemap',
  'sitemap-index.xml': (t) => t.includes('<sitemap>') || 'is empty',
  'caltransfer/privacy/index.html': (t) =>
    (t.includes('<title>Privacy policy: Calendar Transfer</title>') && t.includes('<strong>Calendar Transfer</strong>, by stillfold')) ||
    'is not the Calendar Transfer policy',
  'pickaxeplanet/privacy/index.html': (t) =>
    (t.includes('<title>Privacy policy: Pickaxe Planet</title>') && t.includes('<strong>Pickaxe Planet: Idle Miner</strong>, by stillfold')) ||
    'is not the Pickaxe Planet policy',
  'index.html': () => true,
  'caltransfer/index.html': () => true,
  'pickaxeplanet/index.html': () => true,
  '404.html': () => true,
};
for (const [path, test] of Object.entries(held)) {
  const text = await read(path);
  if (text === null) bad(`${path}: missing`);
  else {
    const result = test(text);
    if (result !== true) bad(`${path}: ${result}`);
  }
}

// 2 and 3. Every page.
async function walk(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full)));
    else if (entry.name.endsWith('.html')) found.push(full);
  }
  return found;
}

const count = (html, re) => (html.match(re) ?? []).length;
const titles = new Map();

for (const file of await walk(dist)) {
  const page = relative(dist, file);
  const html = await readFile(file, 'utf8');
  const is404 = page === '404.html';

  if (count(html, /<title>[^<]+<\/title>/g) !== 1) bad(`${page}: needs exactly one title`);
  if (count(html, /<meta name="description" content="[^"]{50,}"/g) !== 1 && !is404)
    bad(`${page}: needs one description of at least 50 characters`);
  if (count(html, /<h1[\s>]/g) !== 1) bad(`${page}: needs exactly one h1`);

  // Cloudflare must be told to leave email addresses alone (Base.astro).
  // It only rewrites the body, never the head, so only the body is read.
  const email = /[\w.+-]+@[\w-]+\.[\w.]+/;
  const body = html.slice(html.indexOf('<body'));
  const off = body.indexOf('<!--email_off-->');
  const on = body.indexOf('<!--/email_off-->');
  if (off < 0 || on < off) bad(`${page}: the email_off comments around the body are missing`);
  else if (email.test(body.slice(0, off)) || email.test(body.slice(on)))
    bad(`${page}: an email address sits outside the email_off comments`);

  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  if (titles.has(title)) bad(`${page}: same title as ${titles.get(title)}`);
  titles.set(title, page);

  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  const expected = 'https://stillfold.dev/' + page.replace(/index\.html$/, '');
  if (is404) {
    if (!html.includes('noindex')) bad(`${page}: must be noindex`);
  } else if (canonical !== expected) bad(`${page}: canonical is ${canonical}, expected ${expected}`);

  for (const block of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    try {
      const data = JSON.parse(block[1]);
      if (!data['@type']) bad(`${page}: structured data without a type`);
    } catch {
      bad(`${page}: structured data does not parse`);
    }
  }

  const here = '/' + page.replace(/index\.html$/, '');
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const set of html.matchAll(/srcset="([^"]+)"/g))
    refs.push(...set[1].split(',').map((part) => part.trim().split(/\s+/)[0]));

  for (const ref of refs) {
    if (/^(https?:|mailto:|data:|#)/.test(ref)) continue;
    const path = new URL(ref, 'https://stillfold.dev' + here).pathname;
    const target = path.endsWith('/') ? path + 'index.html' : path;
    if (!existsSync(join(dist, decodeURIComponent(target)))) bad(`${page}: ${ref} leads nowhere`);
  }

  // Links out to Google Play must carry the referrer that lets the Play
  // Console count installs from this site.
  for (const link of html.matchAll(/href="(https:\/\/play\.google\.com\/store\/apps\/details[^"]*)"/g)) {
    const href = link[1].replaceAll('&amp;', '&');
    if (!/id=com\.stillfold\.[a-z]+/.test(href)) bad(`${page}: Play link without a stillfold app id`);
    if (!href.includes('utm_source%3Dstillfold_site')) bad(`${page}: Play link without the site referrer`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`checked ${titles.size} pages: nothing wrong`);
