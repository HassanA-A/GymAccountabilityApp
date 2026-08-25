// Post-build step: inject PWA + Apple meta tags into the web build's index.html.
// Expo's `output: "single"` mode ignores app/+html.tsx, so we patch the
// generated HTML directly. Runs after `expo export` (see package.json build:web).
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'dist/index.html';

const TAGS = `
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#0F172A" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Huddle" />
    <link rel="apple-touch-icon" href="/icon-panda.png" />
`;

let html = readFileSync(FILE, 'utf8');

// Let the standalone app extend under the notch / home indicator.
html = html.replace(
  'width=device-width, initial-scale=1, shrink-to-fit=no',
  'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover'
);

if (html.includes('rel="manifest"')) {
  console.log('PWA head tags already present — nothing to do.');
} else {
  html = html.replace('</head>', `${TAGS}  </head>`);
  writeFileSync(FILE, html);
  console.log('Injected PWA head tags into dist/index.html');
}
