module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended'
  ],
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    '@typescript-eslint/consistent-type-imports': 'warn',
    // Phase 2 게이트(2026-08-18) — 배경: docs/specs/admin-page-gap-register.md §3.12
    // 파일 비대화 차단. 기존 위반은 아래 overrides baseline 에만 남고, 목록은 줄이기만 한다.
    'max-lines': ['error', { max: 800, skipBlankLines: true, skipComments: true }],
    // mock 픽스처는 소유 feature 밖에서 import 금지(프로덕션 경로 오염 차단).
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../../*/api/mock-*', '@/features/*/api/mock-*'],
            message:
              'mock 픽스처는 소유 feature 내부에서만 import 한다. 다른 feature 의 데이터가 필요하면 그 feature 의 service facade 를 사용 (gap-register §3.12).'
          }
        ]
      }
    ]
  }
  // Phase 2 baseline(2026-08-18, 기존 위반 24개)은 Phase 4 분해 1~22호로 전량
  // 해소되어 override 를 제거했다 — max-lines 800 게이트가 예외 0 으로 전면 적용된다.
};
