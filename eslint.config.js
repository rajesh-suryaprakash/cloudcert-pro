import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';
import securityPlugin from 'eslint-plugin-security';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js'],
  },
  securityPlugin.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      'security/detect-object-injection': 'off',
      // ── TypeScript ────────────────────────────────────────────────────────
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-unreachable': 'error',
      'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      '@typescript-eslint/no-non-null-assertion': 'warn', // flag ! assertions
      '@typescript-eslint/no-empty-object-type': 'warn', // flag empty interfaces {}

      // ── General JS quality ────────────────────────────────────────────────
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-var': 'error', // always const/let
      'prefer-const': 'warn', // use const when not reassigned
      eqeqeq: ['error', 'always'], // no == / !=
      curly: ['warn', 'all'], // always use braces
      'object-shorthand': ['warn', 'always'], // { foo: foo } → { foo }

      // ── React ─────────────────────────────────────────────────────────────
      'react/react-in-jsx-scope': 'off', // not needed with React 17+ JSX transform
      'react/self-closing-comp': 'warn', // <Foo></Foo> → <Foo />
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-useless-fragment': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
    settings: {
      react: { version: 'detect' },
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-non-literal-regexp': 'off',
    },
  },
  // Disable any ESLint rules that conflict with Prettier (must be last)
  prettierConfig,
];
