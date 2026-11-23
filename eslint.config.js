import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['public/assets/app.js', 'node_modules/**', 'vendor/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  { files: ['web/**/*.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.browser } },
  {
    files: ['tests/**/*.js', 'scripts/**/*.mjs', '*.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.node },
  },
];
