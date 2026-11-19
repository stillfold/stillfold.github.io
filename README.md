# stillfold.dev

The public site of stillfold: a home page, a page for each app, and each
app's privacy policy. It is plain static files, built with
[Astro](https://astro.build).

```
npm ci            install what the build needs
npm run dev       the site at http://localhost:4321, rebuilt as you type
npm run build     the finished site in dist/
npm run check     check dist/ (addresses other services hold, links, page basics)
npm run shots     pictures of every page in .shots/, desktop and phone, no window opened
```

## Where things are

```
src/pages/index.astro                 the home page
src/pages/<app>/index.astro           an app's page
src/pages/<app>/privacy/index.md      its privacy policy (same text as PRIVACY.md in the app's repository)
src/data/site.js                      app ids, names and the Google Play link
src/layouts/Base.astro                the head of every page: title, description, share picture, menu
src/components/                       the folded paper, the Play button, the QR code, the screenshot row
src/styles/global.css                 every style, with the idea explained at the top
src/scripts/sheet.js                  moves the light and unfolds the panels
public/                               files served as they are: CNAME, app-ads.txt, robots.txt, share pictures
tools/                                check.mjs and shots.mjs
```

## The design

One sheet of paper, folded. Each section is a panel of the same sheet in a
different colour. Nothing is drawn in a box: text and pictures sit straight
on the paper. The paper has flat faces and creases, lit from a point that
follows the pointer (or the scroll position on a phone), and each panel
unfolds as it scrolls into view. With reduced motion, or without
JavaScript, the page is the same sheet lying flat.

Only an app's own screenshots and icon are used as pictures.

Calendar Transfer's light and dark picture is two captures of one screen,
`src/assets/caltransfer/preview.png` and `preview-dark.png`, taken one
after the other on the store screenshot emulator (staged as
`docs/store/README.md` in the app's repository describes, then
`adb shell cmd uimode night yes` between the two). If one is retaken the
other must be too, or the halves stop lining up.

## Rules

- `public/CNAME`, `public/app-ads.txt` and the two privacy policy addresses
  (`/caltransfer/privacy/`, `/pickaxeplanet/privacy/`) are held by GitHub,
  AdMob and the Play Console. Do not move, rename or remove them.
  `npm run check` fails if one is gone.
- A privacy policy has two copies, here and `PRIVACY.md` in the app's
  repository. Change both in the same sitting.
- Every link to Google Play goes through `play()` in `src/data/site.js`, so
  it carries the referrer the Play Console counts installs by.
- Pushing to `main` publishes.

## Adding an app

1. An entry in `src/data/site.js`.
2. `src/pages/<app>/index.astro` and `src/pages/<app>/privacy/index.md`
   (copy an existing pair), screenshots in `src/assets/<app>/`, a share
   picture in `public/<app>/img/`.
3. A panel on the home page and a link in the menu (`Base.astro`) and the
   last panel (`Foot.astro`).
4. The new privacy address in `tools/check.mjs`.
