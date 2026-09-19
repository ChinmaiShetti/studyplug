/* StudyPlug — structural checks.

   There is no bundler here, so load order *is* the dependency graph, and it is
   declared in two places that have to agree: the manifest's content_scripts,
   and the <script> tags in each extension page. Nothing catches a mismatch at
   build time, and the symptom in the browser is an undefined global thrown
   somewhere unrelated. This checks the wiring instead.

   Run with: npm run check:structure */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

let failures = 0;
const ok = (msg) => console.log('  ok    ' + msg);
const fail = (msg) => { console.log('  FAIL  ' + msg); failures++; };

const PAGES = ['src/popup/popup.html', 'src/library/library.html'];

/* Everything the manifest points at exists. */
const manifest = JSON.parse(read('manifest.json'));
for (const ref of [
  ...manifest.content_scripts[0].js,
  ...manifest.content_scripts[0].css,
  manifest.action.default_popup,
  manifest.background.service_worker,
  ...Object.values(manifest.icons)
]) {
  exists(ref) ? ok('manifest → ' + ref) : fail('manifest → MISSING ' + ref);
}

/* Every local src/href in every page resolves. */
for (const page of PAGES) {
  const dir = path.dirname(page);
  for (const [, href] of read(page).matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (href.startsWith('http') || href.startsWith('data:')) continue;
    const full = path.normalize(path.join(dir, href));
    exists(full) ? ok(page + ' → ' + href) : fail(page + ' → MISSING ' + href);
  }
}

/* A page that uses a shared module must also load it. This is the failure the
   test suite cannot see, because the tests import modules directly. */
for (const page of PAGES) {
  const html = read(page);
  const script = read(page.replace('.html', '.js'));
  const used = new Set(
    [...script.matchAll(/globalThis\.StudyPlug(\w+)/g)].map((m) => m[1])
  );
  for (const name of used) {
    const file = name.toLowerCase() + '.js';
    html.includes(file)
      ? ok(page + ' loads ' + file)
      : fail(page + ' uses StudyPlug' + name + ' but never loads ' + file);
  }
}

/* Every CP.something the content scripts read is assigned by one of them. */
const contentDir = path.join(root, 'src', 'content');
const content = fs.readdirSync(contentDir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => fs.readFileSync(path.join(contentDir, f), 'utf8'))
  .join('\n');

const referenced = new Set([...content.matchAll(/\bCP\.([a-zA-Z_]+)/g)].map((m) => m[1]));
const assigned = new Set([...content.matchAll(/\bCP\.([a-zA-Z_]+)\s*=/g)].map((m) => m[1]));
const undefinedRefs = [...referenced].filter((n) => !assigned.has(n));
undefinedRefs.length
  ? fail('CP.* referenced but never assigned: ' + undefinedRefs.join(', '))
  : ok('every CP.* reference is defined');

/* The panel reads through an API main.js hands it; a typo either side is
   silent because every call site uses optional chaining. */
const panel = read('src/content/panel.js');
const main = read('src/content/main.js');
const called = new Set([...panel.matchAll(/\bapi\??\.(\w+)/g)].map((m) => m[1]));
const initBlock = main.slice(main.indexOf('CP.panel.init({'));
const provided = new Set(
  [...initBlock.slice(0, initBlock.indexOf('});')).matchAll(/^\s{4}(\w+)/gm)].map((m) => m[1])
);
const missingApi = [...called].filter((n) => !provided.has(n));
missingApi.length
  ? fail('panel calls api.' + missingApi.join(', api.') + ' — not provided by main.js')
  : ok('panel API contract holds');

/* An MV3 service worker has no DOM. */
/\b(document|window)\./.test(read('src/background/service-worker.js'))
  ? fail('service worker touches the DOM')
  : ok('service worker is DOM-free');

console.log(failures ? `\n${failures} problem(s)` : '\nall structural checks pass');
process.exit(failures ? 1 : 0);
