/* StudyPlug — lint rules.

   Three environments in one repo, each with a different set of globals:
   content scripts (DOM + chrome + the CP namespace), extension pages (DOM +
   chrome), the service worker (no DOM), and the Node test suite. */

const browser = {
  window: 'readonly',
  document: 'readonly',
  globalThis: 'writable',
  chrome: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  queueMicrotask: 'readonly',
  fetch: 'readonly',
  Blob: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  Node: 'readonly',
  NodeFilter: 'readonly',
  CSS: 'readonly',
  DOMParser: 'readonly',
  KeyboardEvent: 'readonly',
  Element: 'readonly',
  HTMLElement: 'readonly',
  HTMLAnchorElement: 'readonly',
  MutationObserver: 'readonly',
  getComputedStyle: 'readonly',
  history: 'readonly',
  location: 'readonly',
  navigator: 'readonly'
};

const common = {
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'script'
  },
  linterOptions: {
    reportUnusedDisableDirectives: true
  },
  rules: {
    'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_' }],
    'no-undef': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    eqeqeq: ['error', 'smart'],
    'no-implicit-globals': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    curly: ['error', 'multi-line'],
    'no-empty': ['error', { allowEmptyCatch: true }]
  }
};

export default [
  { ignores: ['node_modules/**', '.deepeval/**'] },

  {
    ...common,
    files: ['src/**/*.js'],
    languageOptions: { ...common.languageOptions, globals: browser }
  },

  {
    /* The service worker has no DOM. */
    ...common,
    files: ['src/background/*.js'],
    languageOptions: {
      ...common.languageOptions,
      globals: {
        globalThis: 'writable',
        chrome: 'readonly',
        importScripts: 'readonly',
        console: 'readonly'
      }
    }
  },

  {
    ...common,
    files: ['test/**/*.js', 'scripts/**/*.mjs', 'eslint.config.mjs'],
    /* These are command-line tools: printing to stdout is their output, not a
       leftover debug statement. */
    rules: { ...common.rules, 'no-console': 'off' },
    languageOptions: {
      ...common.languageOptions,
      sourceType: 'module',
      globals: {
        require: 'readonly',
        global: 'readonly',
        module: 'writable',
        __dirname: 'readonly',
        process: 'readonly',
        console: 'readonly',
        globalThis: 'readonly',
        process: 'readonly'
      }
    }
  }
];
