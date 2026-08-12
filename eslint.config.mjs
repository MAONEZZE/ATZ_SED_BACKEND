// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },

  // ---------------------------------------------------------------------------
  // Fronteira entre camadas.
  //
  // As dependências apontam para dentro: api -> application -> domain, e
  // infra -> domain. O domínio não conhece ninguém. Em C# isso é de graça — um
  // .csproj sem referência não compila. Em TypeScript nada impede o import, então
  // a garantia vem daqui. Sem essa regra a separação é só convenção, e foi assim
  // que FormFieldKind acabou definido no infra e importado pela camada api.
  // ---------------------------------------------------------------------------
  {
    files: ['app/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@api/*', '@application/*', '@infra/*', '**/api/**', '**/application/**', '**/infra/**'],
              message:
                'domain não pode depender de outra camada. Se precisa de algo de fora, declare o contrato aqui (i-*.ts) e implemente no infra.',
            },
            {
              group: ['@prisma/client'],
              message:
                'domain não pode conhecer o ORM. Declare o tipo na porta (i-repository-*.ts); a tradução para o Prisma mora no repositório.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['app/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@api/*', '**/api/**'],
              message:
                'application não pode depender da camada api. Controllers dependem de services, nunca o contrário.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['app/infra/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@api/*', '@application/*', '**/api/**', '**/application/**'],
              message: 'infra implementa contratos do domain; não conhece application nem api.',
            },
          ],
        },
      ],
    },
  },
);
