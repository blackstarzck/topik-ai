# Supabase dev → prod 데이터 복구 런북

## 목적과 경계

이 절차는 `topik-dev`의 사용자 앱 데이터를 `topik-prod`로 복구할 때 사용한다.
스키마 적용과 데이터 복구는 별도 작업이며, 스키마가 먼저 prod에 적용되어 있어야 한다.

- source: `topik-dev` (`fglggyfvzjdsbyckinqa`)
- target: `topik-prod` (`eymlabowhfgtxbiqwxqh`)
- 실행 저장소: `topik-ai`
- 기본 동작: 읽기 전용 dry-run
- 사용자, 로그인 연결정보, 프로필, 학습 목표, 쓰기 기록, 피드백, 보관함,
  알림, 동의, canonical 쓰기 문항, 법률 문서, 운영정책, Storage를 복구한다.
- 기존 prod 사용자와 같은 이메일은 prod 사용자 ID를 유지하고 dev의 관련 행을 그
  ID로 매핑한다.
- dev에만 없는 prod 사용자도 삭제하거나 실행을 막지 않고 그대로 보존한다. 겹치는
  프로필의 운영 권한·요금제·상태·탈퇴 시각도 prod 값을 유지한다.
- Auth 사용자는 명시적인 안전 컬럼 allowlist만 복사한다. 세션·refresh token·OTP,
  확인/복구/이메일·전화 변경/재인증 토큰과 감사 로그는 보안상 복사하지 않는다.
  새로 넣는 계정의 JWT 대상과 역할은 일반 사용자(`authenticated`)로 고정하고,
  `is_super_admin`은 `false`, app metadata는 로그인 제공자 정보만 보존한다.
  과거 이관으로 이미 prod에 남은 일회용 토큰은 dev와 prod의 비어 있지 않은 값이
  정확히 같고 적용 시점에도 prod 값이 바뀌지 않은 경우만 조건부로 비운다. prod에서
  새로 발급되거나 변경된 토큰은 정리 대상이 아니다.
- 커뮤니티 글·쿠폰·환불·시스템 로그 등 개발 fixture/demo 업무 행은 복사하지 않는다.
- `institution_codes`의 운영 생성 행은 복구하지만 알려진 화면용 seed
  (`EXPO2026-BOOTH-A/B`)는 제외한다.
- prod 전용 구독 상품, 인증 이메일 템플릿, 알림 운송 설정은 보존한다.

## 사전 점검

`.env.local`에는 `SUPABASE_ACCESS_TOKEN`만 보관하고 값을 출력하지 않는다.
실제 prod 쓰기에는 아래 세 확인값과 dry-run에서 출력된 manifest hash가 모두
일치해야 한다.

```text
SUPABASE_EXPECTED_PROJECT_REF=eymlabowhfgtxbiqwxqh
SUPABASE_PRODUCTION_CONFIRM=eymlabowhfgtxbiqwxqh
--manifest-hash <dry-run 결과>
```

운영정책의 `current_version_id`가 자기 정책 이력을 가리키지 않는 경우 먼저 다음
SQL을 dev에서 적용한다. 이 SQL은 올바른 연결은 건드리지 않고, 누락되거나 다른
정책에 연결된 행만 새 스냅샷으로 복구한다.

```text
scripts/db/sql/repair-operation-policy-history-links.sql
```

적용 전 `operation_policies`, `operation_policy_histories`를 접근 제한된 별도
스키마에 백업한다.

## 실행

1. dry-run에서 사용자 병합 수, 테이블별 최종 행 수, Storage 해시와 manifest
   hash를 확인한다.

```powershell
npm run db:recover-prod
```

2. 실제 prod 트랜잭션을 실행한 뒤 전부 롤백하여 FK, 행 수, Auth/법률 불변식을
   확인한다.

```powershell
$env:SUPABASE_EXPECTED_PROJECT_REF='eymlabowhfgtxbiqwxqh'
$env:SUPABASE_PRODUCTION_CONFIRM='eymlabowhfgtxbiqwxqh'
npm run db:recover-prod -- --validate-transaction --manifest-hash <hash>
```

3. 같은 hash로 적용한다. 실행기는 먼저 `recovery_backup_<UTC timestamp>`를
   만들고, staging schema 적재, Storage 검증, 단일 DB 트랜잭션, FK 전수 검증,
   적용 후 재검증을 수행한다.

```powershell
npm run db:recover-prod -- --apply --manifest-hash <hash>
```

과거 전체 복구로 prod에 복사된 Auth 일회용 토큰만 정리할 때는 전체 복구를 다시
실행하지 않는다. 아래 전용 모드는 dev와 prod에 남은 토큰이 정확히 같은 사용자만
대상으로 별도 manifest hash를 만들며, 다른 운영 데이터가 바뀌어도 이 hash에는
영향을 주지 않는다. 반대로 대상 토큰이 prod에서 새로 발급되거나 변경되면 hash가
달라지거나 정리 대상에서 빠진다.

```powershell
npm run db:recover-prod -- --auth-token-cleanup-only
npm run db:recover-prod -- --validate-transaction --auth-token-cleanup-only --manifest-hash <hash>
npm run db:recover-prod -- --apply --auth-token-cleanup-only --manifest-hash <hash>
```

적용 시에는 대상 Auth 사용자만 `auth_token_cleanup_backup_<UTC timestamp>`에 접근
제한 상태로 백업한다. 정리 트랜잭션은 staging에 기록한 예상 토큰과 적용 순간의 prod
값이 여전히 같을 때만 빈 값으로 바꾸며, 다른 사용자 데이터나 Storage는 수정하지
않는다.

Storage가 비어 있으면 복사한다. 이미 복구된 Storage는 bucket 수, 누락 bucket,
객체 수, 전체 bytes, 경로·파일 checksum 종합 hash가 모두 같을 때만
`already-synced`로 재사용한다. 하나라도 다르면 자동 병합하지 않고 중단한다.

staging JSON은 Base64로 인코딩해 사용자 본문의 SQL delimiter 충돌을 막는다. 같은
기본키의 dev/prod 행이 서로 다른 뜻을 가지면 자동으로 한쪽을 선택하지 않고 dry-run을
중단한다. 특히 운영정책 현재 이력은 이력 행이 존재하는지만 보지 않고 같은 정책을
가리키는지까지 트랜잭션 안팎에서 확인한다.

읽기 요청만 일시적인 429/5xx에 재시도한다. DB 쓰기는 응답이 5xx이거나 연결이
끊어지면 결과가 불확실할 수 있으므로 재시도하지 않는다. 이 경우 DB가 이미 반영됐을
가능성에 대비해 Storage를 자동 삭제하지 않고 수동 정합성 확인 대상으로 남긴다.
Storage 쓰기도 네트워크 응답 유실 또는 5xx이면 결과가 불확실하므로 자동 롤백하지
않는다. 409처럼 결과가 확정된 충돌은 그 경로를 복구 실행 소유로 간주하지 않아 다른
운영 writer가 만든 객체나 bucket을 삭제하지 않는다.

## 2026-07-17 실행 결과

- 최초 prod 백업: `recovery_backup_20260716215959`
- 운영정책 보강 전 dev 백업: `policy_history_backup_20260716221937`
- 운영정책 보강 전 prod 백업: `recovery_backup_20260716222301`
- 사용자 200명, 로그인 연결정보 209개, 프로필 200명
- 로그인 연결정보 없는 사용자 0명
- 운영정책 16개, 정책 이력 21개, 잘못 연결된 현재 이력 0개
- published 법률 문서 2개, placeholder 0개
- Storage 4 bucket, 43 object, 1,999,432 bytes
- 사용자별 핵심 17개 데이터 영역을 200명 전수 비교해 불일치 0건
- 과거 전체 복구에서 복사된 Auth 일회용 토큰: 22명/23개를 전용 트랜잭션으로
  정리하고 재조회 0명/0개 확인
- Auth 토큰 정리 백업: `auth_token_cleanup_backup_20260717003343716`
- 정리 후 감사: 임시 recovery stage 0개, 잘못된 Auth 역할 0명, 허용하지 않은 app
  metadata 0명, 남은 일회용 토큰 0명

## 롤백

자동 적용 중 DB 오류가 발생하면 DB 트랜잭션은 롤백되고, 그 실행에서 새로 올린
Storage 객체와 bucket도 제거한다. Storage 쓰기 후보는 요청 전에 기록하되, 409처럼
소유권이 다른 것으로 확정된 후보는 즉시 제외한다. 응답 유실·5xx처럼 쓰기 결과가
불확실하면 동시 운영 데이터를 지울 위험이 있으므로 자동 롤백하지 않고 Storage를
보존한다. Storage API 삭제 오류도 성공으로 처리하지 않는다. 적용 완료 뒤
수동 롤백이 필요하면 가장 최근
`recovery_backup_<timestamp>`의 백업 테이블을 기준으로 복구한다.

수동 롤백은 Auth 사용자와 여러 사용자 소유 테이블을 함께 되돌리는 작업이므로,
대상 backup schema와 현재 prod 변경분을 먼저 비교하고 별도 승인 후 실행한다.
백업 schema를 확인하지 않은 상태에서 전체 삭제·덮어쓰기를 실행하지 않는다.
