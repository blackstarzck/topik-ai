import { Tag, Tooltip } from 'antd';

import {
  formatContractPeriod,
  resolveContractDdayLabel,
  resolveContractTone
} from '../model/institution-contracts-types';
import type { InstitutionContractStatusSummary } from '../model/institution-contracts-types';

const TONE_COLOR: Record<string, string | undefined> = {
  danger: 'red',
  warning: 'orange',
  // 기본 톤과 흐린 톤은 색을 주지 않는다. 계약이 넉넉한 기관이 대부분이라 전부 색이 있으면
  // 정작 임박한 기관이 눈에 띄지 않는다.
  normal: undefined,
  muted: undefined
};

const TONE_HINT: Record<string, string> = {
  danger: '계약이 만료됐거나 만료가 임박했습니다.',
  warning: '계약 만료가 한 달 안으로 다가왔습니다.',
  normal: '계약이 유효합니다.',
  muted: '등록된 계약이 없습니다. 만료할 계약이 없으므로 노출은 제한되지 않습니다.'
};

type InstitutionContractDdayBadgeProps = {
  summary: InstitutionContractStatusSummary;
  /** 기간 문자열을 배지 옆에 함께 보여줄지(목록 컬럼은 true, 좁은 자리는 false). */
  showPeriod?: boolean;
};

/**
 * 계약 만료 D-day 배지 — 목록 컬럼과 상세 탭이 **같은 컴포넌트**를 쓴다.
 *
 * 두 화면이 각자 색·문구를 정하면 기준이 갈라진다(구 노출 모드 라벨이 화면마다 달라
 * 오진을 낳은 선례가 있다 — PR #66). 톤·문구 결정은 모델의 순수 함수에 두고 이 컴포넌트는
 * 표시만 한다.
 *
 * `계약 없음` 과 `만료` 를 반드시 구분한다: 전자는 정상 상태(만료할 계약이 없어 노출 제한도
 * 없다)이고 후자는 조치가 필요한 상태다.
 */
export function InstitutionContractDdayBadge({
  summary,
  showPeriod = false
}: InstitutionContractDdayBadgeProps): JSX.Element {
  const tone = resolveContractTone(summary);
  const label = resolveContractDdayLabel(summary);
  const period = formatContractPeriod(summary.activeStartsOn, summary.activeEndsOn);

  return (
    <Tooltip title={TONE_HINT[tone]}>
      <span data-testid={`institution-contract-badge-${summary.code}`}>
        {/*
          기간은 **유효 계약이 있을 때만** 보여준다. 만료 상태에서 `activeStartsOn` 은 비어
          있어 `-` 만 찍히고, `- 만료` 는 정보가 아니라 잡음이다(실측하며 발견).
        */}
        {showPeriod && summary.activeStartsOn ? (
          <span style={{ marginInlineEnd: 6 }}>{period}</span>
        ) : null}
        <Tag color={TONE_COLOR[tone]} style={{ marginInlineEnd: 0 }}>
          {label}
        </Tag>
        {summary.writingHiddenNow ? (
          <Tag color="red" style={{ marginInlineStart: 6, marginInlineEnd: 0 }}>
            만료·비노출
          </Tag>
        ) : null}
      </span>
    </Tooltip>
  );
}
