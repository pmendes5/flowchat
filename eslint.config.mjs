import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: `CallExpression[callee.object.name='console'] > MemberExpression[property.name=/^(?:log|debug|info|warn|error)$/]`,
          message: 'Do not log credentials or sensitive data. Use a sanitized structured logger.',
        },
      ],
    },
  },
);
