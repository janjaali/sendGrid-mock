import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
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
          jsx: true, // Enable JSX parsing
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
    },
  },
  {
    files: ['src/ui/**/*.ts', 'src/ui/**/*.tsx', 'src/ui/**/*.js', 'src/ui/**/*.jsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true, // Enable JSX parsing
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
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
    },
  },
  eslintConfigPrettier
];

