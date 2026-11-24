// ESLint flat config. Method rule 1 (no `private`) is enforced here; see docs/coding-standards.md.
import tseslint from 'typescript-eslint';

const NO_PRIVATE = 'Do not use private: use protected or public (docs/coding-standards.md).';

export default tseslint.config(
    {
        ignores: [
            'node_modules/**',
            'allure-report/**',
            'allure-results/**',
            'test-results/**',
            'report/**',
            'reports/**',
            'logs/**',
            'screenshots/**',
        ],
    },
    ...tseslint.configs.recommended,
    {
        files: ['**/*.ts'],
        rules: {
            'no-restricted-syntax': [
                'error',
                { selector: "MethodDefinition[accessibility='private']", message: NO_PRIVATE },
                { selector: "PropertyDefinition[accessibility='private']", message: NO_PRIVATE },
                { selector: "TSParameterProperty[accessibility='private']", message: NO_PRIVATE },
                {
                    selector: "TSAbstractMethodDefinition[accessibility='private'], TSAbstractPropertyDefinition[accessibility='private']",
                    message: NO_PRIVATE,
                },
                {
                    selector: 'PrivateIdentifier',
                    message: 'Do not use #private members: use protected or public (docs/coding-standards.md).',
                },
            ],
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        },
    },
    {
        files: ['**/*.mjs', '**/*.js'],
        rules: {
            'no-restricted-syntax': [
                'error',
                { selector: 'PrivateIdentifier', message: 'Do not use #private members (docs/coding-standards.md).' },
            ],
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        },
    },
);
