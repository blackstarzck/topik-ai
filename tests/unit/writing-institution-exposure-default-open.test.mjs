import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

const MIGRATION = '20260731011500_topik_writing_institution_exposure_default_open.sql';

const upPath = join(cwd(), 'supabase', 'migrations', MIGRATION);
const downPath = join(cwd(), 'supabase', 'migrations', 'down', MIGRATION);

const upSql = readFileSync(upPath, 'utf8');
const downSql = readFileSync(downPath, 'utf8');
const up = upSql.replace(/\s+/g, ' ').toLowerCase();
const down = downSql.replace(/\s+/g, ' ').toLowerCase();

const SIGNATURE = 'private.is_writing_question_visible_to_user(text, smallint, uuid)';

// 기관 단위 폴백. question_id/item_number 조건이 없다는 점이 문항 기준 판정과의 차이다.
const DEFAULT_OPEN_BRANCH =
  'return not exists ( select 1 from public.topik_writing_question_institution_exposure e '
  + 'where e.institution_code = v_affiliation_code );';

const ASSIGNED_BRANCH =
  'if exists ( select 1 from public.topik_writing_question_institution_exposure e '
  + 'where e.question_id = p_question_id and e.item_number = p_item_number '
  + 'and e.institution_code = v_affiliation_code ) then return true; end if;';

/** `comment on ... is` 다음 비어있지 않은 줄이 literal 인지 라인 기반으로 본다.
 *  정규식은 `\s*` 백트래킹으로 위양성이 나므로 쓰지 않는다. */
function commentStatements(rawSql) {
  const lines = rawSql.split(/\r?\n/);
  const out = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^comment on /i.test(lines[index].trim())) continue;
    let cursor = index;
    let joined = lines[index].trim();
    while (!joined.endsWith(';') && cursor + 1 < lines.length) {
      cursor += 1;
      const next = lines[cursor].trim();
      if (next.length > 0) joined += ` ${next}`;
    }
    out.push({
      head: joined.slice(0, 70),
      hasLiteral: / is '[^']/i.test(joined) || / is null;$/i.test(joined)
    });
  }
  return out;
}

describe('institution exposure default-open (opt-in curation)', () => {
  it('keeps the unaffiliated learner contract from 20260730120000', () => {
    expect(up).toContain('if p_user_id is null then return false; end if;');
    expect(up).toContain("select nullif(btrim(p.affiliation_code), '') into v_affiliation_code");
    expect(up).toContain('if not found then return false; end if;');
    expect(up).toContain('if v_affiliation_code is null then return true; end if;');
  });

  it('keeps assigned questions visible to the owning institution', () => {
    expect(up).toContain(ASSIGNED_BRANCH);
  });

  it('treats an institution with zero mappings as unrestricted', () => {
    expect(up).toContain(DEFAULT_OPEN_BRANCH);
  });

  it('refuses to stack on a non-assignment base', () => {
    expect(up).toContain('institution_exposure_base_is_not_assignment_model');
    expect(up).toContain('institution_exposure_base_does_not_read_mapping');
  });

  // 20260730120000 의 guard 는 포함 단정만 걸어 분기 추가를 통과시켰다.
  // 이 마이그의 shape guard 는 배제·완결성 단정을 함께 걸어야 한다.
  it('guards the deployed shape with completeness assertions, not just presence', () => {
    for (const marker of [
      'institution_exposure_shape_missing_unaffiliated_branch',
      'institution_exposure_shape_missing_assigned_branch',
      'institution_exposure_shape_missing_default_open_branch',
      'institution_exposure_shape_unexpected_branch_count',
      'institution_exposure_shape_unexpected_mapping_refs',
      'institution_exposure_shape_writes_profiles',
      'institution_exposure_shape_duplicates_service_status_axis'
    ]) {
      expect(up).toContain(marker);
    }
    // return 개수와 매핑 참조 개수를 실제로 센다.
    expect(up).toContain("replace(v_body, 'return ', '')");
    expect(up).toContain('if v_returns <> 5 then');
    expect(up).toContain('if v_mapping_refs <> 2 then');
  });

  it('body actually matches the shape the guard asserts', () => {
    // guard 가 5 를 요구하므로 본문의 return 도 5개여야 한다(가드-본문 정합).
    const body = up.slice(
      up.indexOf('create or replace function private.is_writing_question_visible_to_user'),
      up.indexOf('revoke all on function')
    );
    expect(body.length).toBeGreaterThan(0);
    const returns = body.split('return ').length - 1;
    expect(returns).toBe(5);
    const mappingRefs = body.split('topik_writing_question_institution_exposure').length - 1;
    expect(mappingRefs).toBe(2);
  });

  it('re-states the closed privilege posture', () => {
    for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
      expect(up).toContain(`revoke all on function ${SIGNATURE} from ${role};`);
    }
    expect(up).not.toContain(`grant execute on function ${SIGNATURE}`);
  });

  it('rewrites all three contract comments to include the opt-in default', () => {
    for (const target of [
      'comment on table public.topik_writing_question_institution_exposure is',
      `comment on function ${SIGNATURE} is`,
      'comment on function public.get_available_writing_questions(smallint, uuid) is'
    ]) {
      expect(up).toContain(target);
    }
    expect(up).toContain('해당 기관의 매핑 0건');
    expect(up).toContain('기관 단위 옵트인');
    // 20260730120000 의 문구를 그대로 남기면 거짓 SoT 가 된다.
    expect(up).not.toContain(
      '학습자 최종 노출 계약: service_status=available and (user.affiliation_code 없음 '
      + 'or 매핑.institution_code = user.affiliation_code)'
    );
  });

  it('defines exactly one function and touches no unrelated object', () => {
    expect(up.match(/create or replace function/g) ?? []).toHaveLength(1);
    for (const unrelated of [
      'get_available_writing_questions(smallint default null',
      'assert_writing_question_submittable',
      'topik_writing_question_learner_projection',
      'list_user_problems',
      'drop function',
      'drop table'
    ]) {
      expect(up).not.toContain(unrelated);
    }
    expect(up).not.toMatch(/update public\.profiles|insert into public\.profiles|delete from public\.profiles/);
    // 데이터는 손대지 않는다(오너 결정: 기존 배정 전부 의도됨).
    expect(up).not.toMatch(/delete from public\.topik_writing_question_institution_exposure/);
    expect(up).not.toMatch(/insert into public\.topik_writing_question_institution_exposure/);
  });

  it('leaves every comment complete and ends on a terminated statement', () => {
    for (const [label, sqlText] of [['up', upSql], ['down', downSql]]) {
      const comments = commentStatements(sqlText);
      expect(comments.length, `${label}: comment count`).toBe(3);
      for (const entry of comments) {
        expect(entry.hasLiteral, `${label}: incomplete comment -> ${entry.head}`).toBe(true);
      }
      expect(sqlText.trimEnd().endsWith(';'), `${label}: terminated`).toBe(true);
    }
  });

  describe('down migration', () => {
    it('restores the 20260713080015 assignment body', () => {
      expect(down).toContain(
        'return exists ( select 1 from public.topik_writing_question_institution_exposure e '
        + 'where e.question_id = p_question_id and e.item_number = p_item_number '
        + 'and e.institution_code = v_affiliation_code );'
      );
    });

    it('drops the opt-in default so the same assertions fail on the old shape', () => {
      expect(down).not.toContain(DEFAULT_OPEN_BRANCH);
      expect(down).not.toContain(ASSIGNED_BRANCH);
      // down 헤더는 무엇을 되돌리는지 설명하므로 파일 전체가 아니라
      // 복원되는 계약 문구(comment literal)에 옵트인 표현이 없어야 한다.
      const restoredComments = downSql
        .split(/\r?\n/)
        .filter((line) => line.trim().startsWith("'"))
        .join(' ');
      expect(restoredComments.length).toBeGreaterThan(0);
      expect(restoredComments).not.toContain('옵트인');
      expect(restoredComments).not.toContain('매핑 0건');
    });

    it('restores the 20260730120000 comment wording', () => {
      expect(down).toContain('기관 할당제 학습자 가시성 predicate');
      expect(down).toContain('미매핑 문항은 기관 소속 학습자에게 보이지 않는다');
    });

    it('warns that rollback can hide every question from a zero-mapping institution', () => {
      expect(downSql).toContain('0문항');
      expect(down).toContain('exposure_rows=0');
    });
  });
});
