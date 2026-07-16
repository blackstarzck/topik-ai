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
- Auth 세션·refresh token·OTP·감사 로그는 보안상 복사하지 않는다.
- 커뮤니티 글·쿠폰·환불·시스템 로그 등 개발 fixture/demo 업무 행은 복사하지 않는다.
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

Storage가 비어 있으면 복사한다. 이미 복구된 Storage는 bucket 수, 누락 bucket,
객체 수, 전체 bytes, 경로·파일 checksum 종합 hash가 모두 같을 때만
`already-synced`로 재사용한다. 하나라도 다르면 자동 병합하지 않고 중단한다.

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

## 롤백

자동 적용 중 DB 오류가 발생하면 DB 트랜잭션은 롤백되고, 그 실행에서 새로 올린
Storage 객체와 bucket도 제거한다. 적용 완료 뒤 수동 롤백이 필요하면 가장 최근
`recovery_backup_<timestamp>`의 백업 테이블을 기준으로 복구한다.

수동 롤백은 Auth 사용자와 여러 사용자 소유 테이블을 함께 되돌리는 작업이므로,
대상 backup schema와 현재 prod 변경분을 먼저 비교하고 별도 승인 후 실행한다.
백업 schema를 확인하지 않은 상태에서 전체 삭제·덮어쓰기를 실행하지 않는다.
