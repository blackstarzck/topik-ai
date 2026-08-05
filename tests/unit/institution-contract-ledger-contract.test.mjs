import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

// SQL 계약 테스트. 마이그는 적용해야 검증되는 것이 많지만, "이 줄이 사라지면 조용히
// 위험해지는" 성질은 파일 텍스트로도 고정할 수 있다. 여기서는 그런 것만 다룬다:
// 분기 순서, 문자열 수술 대상 보호, upsert 컬럼 범위, down 의 보존 계약, manifest lockstep.
const W1 = '20260804100000_topik_writing_institution_contracts.sql';
const W2 = '20260804100100_topik_writing_auto_assign_new_questions.sql';
const A1 = '20260804100200_institution_code_settings.sql';
const A2 = '20260804100300_institution_contract_delete_cleanup.sql';
const A3 = '20260804100400_institution_intake_guards.sql';

// 🚨 주석을 먼저 걷어낸다. 이 마이그들은 헤더에서 결함·롤백 절차를 설명하며
// `private.admin_has_permission`, `drop table ...` 같은 문자열을 **설명으로** 담고 있어,
// 원문 그대로 검사하면 올바른 코드가 위반으로 잡힌다(이 파일 작성 중 실제로 3건 오탐).
// 줄 주석 제거는 공백 정규화 **전에** 해야 한다 — 개행을 먼저 없애면 `--` 가 파일 끝까지 먹는다.
// 이 파일들의 문자열 리터럴에는 `--` 가 없음을 확인했다(날짜 포맷은 단일 하이픈).
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/--[^\r\n]*/g, ' ');
const normalize = (text) => stripComments(text).replace(/\s+/g, ' ').toLowerCase();
const readWriting = (name, down = false) => normalize(readFileSync(
  join(cwd(), 'supabase', 'migrations', ...(down ? ['down'] : []), name),
  'utf8'
));
const readAdmin = (name, down = false) => normalize(readFileSync(
  join(cwd(), 'supabase', 'migrations-admin', ...(down ? ['down'] : []), name),
  'utf8'
));

const w1 = readWriting(W1);
const w1Down = readWriting(W1, true);
const w2 = readWriting(W2);
const w2Down = readWriting(W2, true);
const a1 = readAdmin(A1);
const a2 = readAdmin(A2);
const a2Down = readAdmin(A2, true);
const a3 = readAdmin(A3);
const a3Down = readAdmin(A3, true);

const manifests = {
  'writing/development': JSON.parse(readFileSync(
    join(cwd(), 'scripts', 'db', 'manifests', 'writing-development-release.json'), 'utf8'
  )),
  'writing/production': JSON.parse(readFileSync(
    join(cwd(), 'scripts', 'db', 'manifests', 'writing-production-cutover.json'), 'utf8'
  )),
  'admin/development': JSON.parse(readFileSync(
    join(cwd(), 'scripts', 'db', 'manifests', 'admin-development-reconciliation.json'), 'utf8'
  )),
  'admin/production': JSON.parse(readFileSync(
    join(cwd(), 'scripts', 'db', 'manifests', 'admin-production-cutover.json'), 'utf8'
  )),
};

/** 특정 함수 정의 하나만 잘라낸다(다음 create 정의 직전까지). */
function functionBody(sql, header) {
  const start = sql.indexOf(header);
  expect(start, `function header not found: ${header}`).toBeGreaterThanOrEqual(0);
  const next = sql.indexOf('create or replace function', start + header.length);
  return next < 0 ? sql.slice(start) : sql.slice(start, next);
}

describe('W1 계약 원장 · 학습자 predicate', () => {
  it('만료 분기를 무제한 모드 분기보다 앞에 둔다', () => {
    const predicate = functionBody(
      w1,
      'create or replace function private.is_writing_question_visible_to_user'
    );
    const expiry = predicate.indexOf('not private.institution_writing_contract_active(v_affiliation_code)');
    const unrestricted = predicate.indexOf("coalesce(v_exposure_mode, '배정분만') = '제한 없음'");

    expect(expiry).toBeGreaterThanOrEqual(0);
    expect(unrestricted).toBeGreaterThan(expiry);
  });

  it('모드와 옵션을 한 번의 SELECT 로 읽어 hot path 조회를 늘리지 않는다', () => {
    expect(w1).toContain('select m.exposure_mode, m.auto_hide_on_expiry');
  });

  it('20260730120000 계약 가드가 검사하는 리터럴 3종을 보존한다', () => {
    expect(w1).toContain('if v_affiliation_code is null then return true; end if;');
    expect(w1).toContain('topik_writing_question_institution_exposure');
    expect(w1).toContain('e.institution_code = v_affiliation_code');
  });

  it('계약이 하나도 없는 기관은 유효로 본다 — 옵션만 켜도 가려지지 않는다', () => {
    const helper = functionBody(
      w1,
      'create or replace function private.institution_writing_contract_active'
    );
    const noRows = helper.indexOf(
      'if not exists ( select 1 from public.topik_writing_institution_contracts c'
      + ' where c.institution_code = v_code ) then return true; end if;'
    );
    expect(noRows).toBeGreaterThanOrEqual(0);
  });

  it('겹침 금지를 사전 검사가 아니라 제약으로 강제한다', () => {
    expect(w1).toContain('exclude using gist ( institution_code with =,'
      + " daterange(starts_on, ends_on, '[]') with && )");
    expect(w1).toContain('create extension if not exists btree_gist');
  });

  it('auto_hide 토글 upsert 는 exposure_mode 를 건드리지 않는다', () => {
    const toggle = functionBody(
      w1,
      'create or replace function public.admin_set_institution_auto_hide_on_expiry'
    );
    expect(toggle).toContain('auto_hide_on_expiry = excluded.auto_hide_on_expiry');
    expect(toggle).not.toContain('exposure_mode = excluded.exposure_mode');
  });

  it('신규 RPC 는 존재하지 않는 private.admin_has_permission 을 부르지 않는다', () => {
    expect(w1).not.toContain('private.admin_has_permission');
    expect(w1).toContain('public.admin_has_permission(caller_id');
  });

  it('down 은 계약 원장 테이블을 남긴다', () => {
    expect(w1Down).not.toContain('drop table');
    expect(w1Down).toContain('drop column if exists auto_hide_on_expiry');
  });
});

describe('W2 신규 문항 자동 배정', () => {
  it('문항 4테이블 전부에 트리거를 건다', () => {
    for (const item of [51, 52, 53, 54]) {
      expect(w2).toContain(`create trigger topik_writing_${item}_auto_assign_on_available`);
      expect(w2).toContain(`after update of service_status on public.topik_writing_${item}_questions`);
    }
    // 개수 단정 — 한 테이블을 빠뜨리면 사후 do-block 도 잡지만 여기서 먼저 잡는다.
    expect((w2.match(/create trigger topik_writing_5\d_auto_assign_on_available/g) ?? []).length)
      .toBe(4);
  });

  it('INSERT 가 아니라 available 로의 전환에만 반응한다', () => {
    // 승격은 상태를 보존하는 DELETE+INSERT 라 INSERT 훅은 신규·갱신을 구분할 수 없다.
    expect(w2).not.toContain('after insert or update of service_status');
    expect(w2).toContain(
      "when (new.service_status = 'available'"
      + " and old.service_status is distinct from 'available')"
    );
  });

  it('배정을 추가만 하고 제거하지 않는다', () => {
    const trigger = functionBody(
      w2,
      'create or replace function private.auto_assign_writing_question_to_institutions'
    );
    expect(trigger).toContain('on conflict (question_id, institution_code) do nothing');
    expect(trigger).not.toContain('delete from');
  });

  it('auto_assign 토글 upsert 도 exposure_mode 를 건드리지 않는다', () => {
    const toggle = functionBody(
      w2,
      'create or replace function public.admin_set_institution_auto_assign'
    );
    expect(toggle).toContain('auto_assign_new_questions = excluded.auto_assign_new_questions');
    expect(toggle).not.toContain('exposure_mode = excluded.exposure_mode');
  });

  it('down 은 이미 배정된 행을 지우지 않는다', () => {
    expect(w2Down).not.toContain('delete from public.topik_writing_question_institution_exposure');
    expect(w2Down).toContain('drop column if exists auto_assign_new_questions');
  });
});

describe('A1 기관 운영 설정', () => {
  it('좌석 계수는 만료 경과 대기 초대를 제외한다', () => {
    const usage = functionBody(w1 === a1 ? a1 : a1, 'create or replace function private.institution_seat_usage');
    expect(usage).toContain("i.status = 'pending'");
    expect(usage).toContain('(i.expires_at is null or i.expires_at >= now())');
  });

  it('감사에 담당자 값을 기록하지 않는다', () => {
    const update = functionBody(
      a1,
      'create or replace function public.admin_update_institution_settings'
    );
    // 변경된 필드명만 남긴다.
    expect(update).toContain("'changed_fields', to_jsonb(v_changed)");
    expect(update).toContain("'contact_value_logged', false");
    expect(update).not.toContain("'contact_name', v_name");
    expect(update).not.toContain("'contact_email', v_email");
  });

  it('정원을 현재 좌석 사용량보다 낮게 설정하는 것을 막는다', () => {
    expect(a1).toContain('is lower than current seat usage');
  });
});

describe('A2 삭제 정리 · 권한 함수 수리', () => {
  it('코드 삭제보다 먼저 계약과 설정을 정리한다', () => {
    const contractCleanup = a2.indexOf(
      'delete from public.topik_writing_institution_contracts where institution_code = $1'
    );
    const settingsCleanup = a2.indexOf(
      'delete from public.institution_code_settings where institution_code = $1'
    );
    const codeDelete = a2.indexOf('delete from public.institution_codes where code = v_code');

    expect(contractCleanup).toBeGreaterThanOrEqual(0);
    expect(settingsCleanup).toBeGreaterThanOrEqual(0);
    expect(codeDelete).toBeGreaterThan(contractCleanup);
    expect(codeDelete).toBeGreaterThan(settingsCleanup);
    expect(a2).toContain("'deleted_contract_count', v_deleted_contract_count");
    expect(a2).toContain("'deleted_settings_count', v_deleted_settings_count");
  });

  it('기존 정리 2종 단정을 회귀시키지 않는다', () => {
    expect(a2).toContain("'deleted_exposure_mode_count', v_deleted_exposure_mode_count");
    expect(a2).toContain('institution_exposure_mode_delete_cleanup_not_wired');
    expect(a2).toContain('institution_exposure_mode_code_lock_not_wired');
  });

  it('노출 모드 RPC 의 권한 함수 스키마를 수리한다', () => {
    const setMode = functionBody(
      a2,
      'create or replace function public.admin_set_institution_exposure_mode'
    );
    expect(setMode).toContain('public.admin_has_permission(caller_id');
    expect(setMode).not.toContain('private.admin_has_permission');
    expect(a2).toContain('institution_exposure_mode_permission_schema_not_fixed');
  });

  it('down 은 권한 수리를 되돌리지 않는다', () => {
    expect(a2Down).not.toContain('private.admin_has_permission');
    expect(a2Down).not.toContain(
      'create or replace function public.admin_set_institution_exposure_mode'
    );
  });
});

describe('A3 intake 가드 — 문자열 수술 보호', () => {
  it('🚨 수술된 RPC 2종을 재정의하지 않는다', () => {
    // 재정의하면 20260731100000 이 문자열 수술로 심은 선행조건 가드가 조용히 사라져
    // 배정 0건 기관에 회원이 들어가 빈 화면이 된다(PR #69 가 막은 경로).
    for (const sql of [a3, a3Down]) {
      expect(sql).not.toContain('create or replace function public.admin_assign_institution_code(');
      expect(sql).not.toContain('create function public.admin_assign_institution_code(');
      expect(sql).not.toContain('create or replace function public.admin_invite_institution_members(');
      expect(sql).not.toContain('create function public.admin_invite_institution_members(');
    }
  });

  it('호출부 생존을 사후 단정으로 증명한다', () => {
    for (const sql of [a3, a3Down]) {
      expect(sql).toContain('institution_assignment_guard_callsite_lost');
    }
  });

  it('wrapper 는 원함수를 재구현하지 않고 위임한다', () => {
    expect(a3).toContain('return public.admin_assign_institution_code(p_user_ids, v_code, p_reason);');
    expect(a3).toContain(
      'return public.admin_invite_institution_members(p_user_ids, v_code, p_reason, v_days);'
    );
    expect(a3).toContain('assign_wrapper_must_delegate_to_original');
    expect(a3).toContain('invite_wrapper_must_delegate_to_original');
  });

  it('헬퍼의 만료 분기가 무제한 모드 분기보다 앞이다', () => {
    const helper = functionBody(
      a3,
      'create or replace function private.institution_has_writing_assignment'
    );
    const expiry = helper.indexOf('coalesce(m.auto_hide_on_expiry, false)');
    const unrestricted = helper.indexOf("coalesce(v_mode, '배정분만') = '제한 없음'");
    expect(expiry).toBeGreaterThanOrEqual(0);
    expect(unrestricted).toBeGreaterThan(expiry);
  });

  it('컬럼 단위 존재 확인으로 폴더 간 부분 적용 창을 견딘다', () => {
    // 테이블 존재만 보면 auto_hide 컬럼이 없는 창에서 42703 으로 실패한다.
    expect(a3).toContain("and a.attname = 'auto_hide_on_expiry'");
  });

  it('기관별 초대 유효기간 기본값을 서버에서 해석한다', () => {
    expect(a3).toContain('coalesce(p_expires_in_days, s.default_invite_expiry_days, 7)');
  });

  it('초대 정원 백스톱을 RPC 가 아니라 테이블에 건다', () => {
    expect(a3).toContain('after insert on public.institution_code_invitations');
    expect(a3).toContain('institution_code_invitations_seat_limit_guard');
  });
});

describe('manifest lockstep', () => {
  it.each([['writing/development'], ['writing/production']])(
    '%s 은 39개 + 계약 배치를 등재한다',
    (key) => {
      const manifest = manifests[key];
      // 39 = 계약 5종 + PR-C 가 추가한 노출 옵션 읽기 RPC(20260805100000).
      expect(manifest.expectedLocalCount).toBe(39);
      // release-all 의 끝은 더 이상 W2 가 아니다. 끝을 고정하면 뒤에 파일이 붙을 때마다
      // 무관한 테스트가 깨지므로 "릴리스 범위에 포함된다"는 의도만 남긴다.
      expect(manifest.batches['release-all'].to >= W2).toBe(true);
      expect(manifest.batches['institution-contracts'].migrations).toEqual([W1, W2]);
      expect(manifest.batches['institution-contracts'].expectPresentAfter).toEqual(
        expect.arrayContaining([
          { kind: 'table', identity: 'public.topik_writing_institution_contracts' },
          { kind: 'function', identity: 'private.institution_writing_contract_active(text)' },
          {
            kind: 'column',
            identity: 'public.topik_writing_institution_exposure_mode.auto_hide_on_expiry'
          },
        ])
      );
    }
  );

  it.each([['admin/development'], ['admin/production']])(
    '%s 은 97개 + 신규 배치 3종을 등재한다',
    (key) => {
      const manifest = manifests[key];
      expect(manifest.expectedLocalCount).toBe(97);
      expect(manifest.batches['release-all'].to).toBe(A3);
      expect(manifest.batches['baseline-all'].to).toBe(A3);
      expect(manifest.batches['institution-code-settings'].migrations).toEqual([A1]);
      expect(manifest.batches['institution-contract-delete-cleanup'].migrations).toEqual([A2]);
      expect(manifest.batches['institution-intake-guards'].migrations).toEqual([A3]);
      expect(manifest.batches['institution-intake-guards'].expectPresentAfter).toEqual(
        expect.arrayContaining([
          {
            kind: 'function',
            identity: 'public.admin_assign_institution_code_guarded(uuid[],text,text)'
          },
          {
            kind: 'trigger',
            identity:
              'public.institution_code_invitations.institution_code_invitations_seat_limit_guard'
          },
        ])
      );
    }
  );

  it.each([['writing/development'], ['writing/production']])(
    '%s 은 노출 옵션 읽기 RPC 배치를 등재한다',
    (key) => {
      const batch = manifests[key].batches['institution-exposure-options-read'];
      expect(batch).toBeDefined();
      expect(batch.migrations).toEqual([
        '20260805100000_topik_writing_institution_exposure_options_read.sql'
      ]);
      expect(batch.expectPresentAfter).toEqual(
        expect.arrayContaining([
          {
            kind: 'function',
            identity: 'public.admin_list_institution_exposure_options(text[])'
          }
        ])
      );
    }
  );

  it('모든 신규 배치에 한국어 reason 이 있다', () => {
    const batches = [
      manifests['writing/development'].batches['institution-contracts'],
      manifests['writing/production'].batches['institution-contracts'],
      manifests['admin/development'].batches['institution-code-settings'],
      manifests['admin/development'].batches['institution-contract-delete-cleanup'],
      manifests['admin/development'].batches['institution-intake-guards'],
      manifests['writing/development'].batches['institution-exposure-options-read'],
    ];
    for (const batch of batches) {
      expect(batch.reason).toBeTruthy();
      expect(batch.reason).toMatch(/[가-힣]/);
    }
  });
});
