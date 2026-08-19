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
  // wf-plain-layer.gen.mjs 는 Workflow 런타임이 주입하는 전역(phase/parallel/agent)에서
  // 실행되는 생성 산출물이라 일반 Node/브라우저 규칙 대상이 아니다.
  ignorePatterns: ['dist', 'node_modules', 'scripts/wf-plain-layer.gen.mjs'],
  rules: {
    '@typescript-eslint/consistent-type-imports': 'warn',
    // 의도적으로 버리는 값은 밑줄 접두어로 표시한다(rest 로 키만 제외하는 패턴 포함).
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }
    ],
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
  // Phase 2 baseline(2026-08-18, src 기존 위반 24개)은 Phase 4 분해 1~22호로 전량
  // 해소되어 override 를 제거했다 — src/api 는 max-lines 예외 0 이다.
  overrides: [
    {
      // 운영/검증 스크립트와 테스트는 Node 런타임에서 돈다. 2026-08-20 lint 스코프
      // 확장(scripts·tests) 전까지 검사 사각지대였고, browser env 만 켜져 있어
      // process/Buffer 가 no-undef 로 잡혔다.
      files: ['scripts/**/*.mjs', 'tests/**/*.mjs', 'tests/**/*.ts'],
      env: {
        browser: false,
        node: true
      }
    },
    {
      // ── 스코프 확장 baseline (2026-08-20) ─────────────────────────────────
      // lint 스코프를 scripts·tests 로 넓히자 드러난 기존 max-lines 위반 5개.
      // src 쪽 Phase 2 baseline 과 같은 규칙: 목록은 "줄이기만" 한다 — 새 파일을
      // 추가하지 않는다. 다음 분해 라운드의 대상 목록이다 (gap-register §3.12).
      files: [
        'scripts/db/migrate-core.mjs',
        'scripts/db/recover-prod-from-dev.mjs',
        'tests/live-e2e/analytics-learning-live.pw.ts'
      ],
      rules: {
        'max-lines': 'off'
      }
    }
  ]
};
