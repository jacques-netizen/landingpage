import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    // `pnpm lint` runs on apps and packages only. The existing static site and the docs are out of scope.
    ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', 'packages/db/migrations/**', 'apps/web/next-env.d.ts', 'apps/web/test-results/**', 'apps/web/playwright-report/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-syntax': [
        'error',
        // Money is whole cents. parseFloat on money input is the classic way floats sneak in.
        { selector: "CallExpression[callee.name='parseFloat']", message: 'Do not use parseFloat. Money is whole cents.' },
      ],
    },
  },
)
