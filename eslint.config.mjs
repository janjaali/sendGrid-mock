import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import globals from "globals";

export default [
  // Configuration for both JavaScript/JSX and TypeScript files
  {
    files: ['src/server/**/*.ts', 'src/server/**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },

      },
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      'typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      indent: ['error', 2],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/ui/**/*.ts', 'src/ui/**/*.tsx', 'src/ui/**/*.js', 'src/ui/**/*.jsx'],
    ...reactPlugin.configs.flat.recommended,
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 2018,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.nodeBuiltin,
        ...globals.es2021,
      },
    },
    plugins: {
      'typescript-eslint': tseslint.plugin,
      react: reactPlugin,
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      indent: ['error', 2],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
    },
  }
];

