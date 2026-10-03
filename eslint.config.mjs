import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/drizzle/**',
      'docs/**',
      // The older static site that shares this repository.
      'admin/**',
      'book/**',
      'booked/**',
      'brand-sheet/**',
      'brand-sheet-admin/**',
      'campaign-admin/**',
      'campaign-hub/**',
      'campaigns/**',
      'candyrific/**',
      'coinjuice/**',
      'dashboard/**',
      'functions/**',
      'fuzzbucket/**',
      'gordon-system/**',
      'lib/**',
      'media/**',
      'michael/**',
      'owning-the-feed/**',
      'runitbak/**',
      'samer/**',
      'scott-sebastian/**',
      'steal-like-an-artist/**',
      'talent/**',
      'valuepilot/**',
      'valuepilot-engagement/**',
      'valuepilot-gtm/**',
      'booked/**',
      'worker.js',
      'index.html',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
)
