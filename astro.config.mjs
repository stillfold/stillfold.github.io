import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The site is static: `npm run build` writes plain files to dist/.
// Every address ends in a slash, as the old Jekyll site's did, so the
// privacy policy addresses typed into the Play Console keep working.
export default defineConfig({
  site: 'https://stillfold.dev',
  trailingSlash: 'always',
  integrations: [sitemap()],
});
