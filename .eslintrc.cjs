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
  },
  overrides: [
    {
      // ── Phase 2 baseline (2026-08-18) ─────────────────────────────────────
      // 게이트 도입 시점의 기존 위반 24개. 이 목록은 "줄이기만" 한다 — 새 파일을
      // 추가하지 않는다. Phase 4 분해 작업의 대상 목록이기도 하다 (gap-register §3.12).
      files: [
        'src/features/analytics/pages/analytics-learning-page.tsx',
        'src/features/commerce/pages/commerce-coupon-create-page.tsx',
        'src/features/commerce/pages/commerce-coupon-template-create-page.tsx',
        'src/features/commerce/pages/commerce-coupons-page.tsx',
        'src/features/commerce/pages/commerce-points-page.tsx',
        'src/features/message/pages/message-groups-page.tsx',
        'src/features/operation/pages/operation-event-create-page.tsx',
        'src/features/operation/pages/operation-faq-page.tsx',
        'src/features/operation/pages/operation-policies-page.tsx',
        'src/features/system/model/system-metadata-store.ts',
        'src/features/system/pages/system-metadata-page.tsx',
        'src/features/users/pages/user-detail-page.tsx',
        'src/features/users/pages/users-page.tsx',
        'src/features/users/pages/users-referrals-page.tsx'
      ],
      rules: {
        'max-lines': 'off'
      }
    }
  ]
};
