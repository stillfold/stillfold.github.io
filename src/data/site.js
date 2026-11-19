// The facts every page shares. A new app is one more entry here, a page
// under src/pages/<path>/, and a panel on the home page.

export const site = {
  name: 'stillfold',
  url: 'https://stillfold.dev/',
  email: 'stillfold@pm.me',
};

export const apps = {
  pickaxe: {
    id: 'com.stillfold.pickaxeplanet',
    name: 'Pickaxe Planet',
    fullName: 'Pickaxe Planet: Idle Miner',
    path: '/pickaxeplanet/',
  },
  calendar: {
    id: 'com.stillfold.caltransfer',
    name: 'Calendar Transfer',
    fullName: 'Calendar Transfer',
    path: '/caltransfer/',
  },
};

// A link to the app's Google Play listing. The referrer is how the Play
// Console tells installs that came from this site from the rest
// (Acquisition reports); `where` says which link on which page.
export const play = (id, where) =>
  `https://play.google.com/store/apps/details?id=${id}&referrer=` +
  encodeURIComponent(`utm_source=stillfold_site&utm_medium=web&utm_content=${where}`);

export const organization = {
  '@type': 'Organization',
  name: site.name,
  url: site.url,
};
