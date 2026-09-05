import js from '@eslint/js';
import globals from 'globals';
import configPrettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  configPrettier,
  { ignores: ['node_modules/**'] },
  // Backend (Node, ES-Module)
  {
    files: ['server/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
  },
  // Frontend (Browser, ES-Module)
  {
    files: ['public/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser } },
  },
];
