// Builds a workflow script (with the extracted API data embedded) that rewrites
// every API into plain, non-expert Korean. Avoids pasting huge args into the tool call.
import fs from 'node:fs';

const SRC = 'C:/Users/admin/AppData/Local/Temp/claude/C--Users-admin-Desktop-workspace-topik-ai/e3677ece-f3e4-4879-a217-95eb53f904d4/tasks/wnfrfkes0.output';
const outer = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const data = typeof outer.result === 'string' ? JSON.parse(outer.result) : outer.result;
const PROJECT_SPLIT = 9;

const DATA = data.domains.map((d, i) => ({
  domain: d.domain,
  project: i < PROJECT_SPLIT ? 'topik-ai' : 'v13',
  apis: d.apis.map((a) => ({
    n: a.name,
    op: a.op,
    type: a.type,
    p: (a.purpose || '').slice(0, 600),
    r: (a.responseShape || '').slice(0, 240),
  })),
}));

const script = `export const meta = {
  name: 'api-plain-rewrite',
  description: 'Rewrite every catalogued API into plain, non-expert Korean (easy one-liners) for a more readable backend handoff doc',
  phases: [{ title: 'Rewrite', detail: 'one agent per domain rewrites its APIs in plain Korean' }],
}

const DATA = ${JSON.stringify(DATA)}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['n', 'op', 'easy', 'easyResp'],
        properties: {
          n: { type: 'string' },
          op: { type: 'string' },
          easy: { type: 'string', description: 'plain Korean, <=45 chars, what this API DOES in everyday words (no jargon, no table/column names)' },
          easyResp: { type: 'string', description: 'plain Korean, 1 short sentence: what comes back / what the screen can show with it' },
        },
      },
    },
  },
}

phase('Rewrite')

const prompt = (d) => [
  '아래는 한 도메인의 API 목록(JSON)입니다. 도메인:', d.domain, '(프로젝트:', d.project + ').',
  '',
  '각 API를 개발 지식이 적은 사람(기획자/신입 백엔드)도 한눈에 이해할 수 있게 한국어로 쉽게 바꿔주세요. 규칙:',
  '- easy: 이 API가 "무엇을 하는지" 한 문장(45자 이내). 일상어로. 테이블명/컬럼명/RPC명 같은 전문용어 금지. 예) "관리자가 회원을 정지/해제한다", "쓰기 답안을 외부 채점에 보낸다".',
  '- easyResp: 응답으로 "무엇을 받는지/화면에 뭘 보여줄 수 있는지" 한 문장. 예) "성공 여부만 돌아온다", "회원 목록과 총 개수가 돌아온다", "점수와 문장별 첨삭이 돌아온다".',
  '- n, op 는 입력 그대로 되돌려 주세요(매칭용).',
  '- 추측하지 말고 주어진 purpose/response 내용에 근거해서 쉽게 풀어 쓰기만 하세요.',
  '',
  'API 목록(JSON):',
  JSON.stringify(d.apis),
  '',
  'items 배열만 구조화해서 반환하세요. 모든 API가 빠짐없이 포함되어야 합니다.',
].join('\\n')

const results = await parallel(DATA.map((d) => () =>
  agent(prompt(d), { label: 'plain:' + d.project + ':' + d.domain.split(' ')[0], phase: 'Rewrite', schema: SCHEMA })
))

return { byDomain: DATA.map((d, i) => ({ domain: d.domain, project: d.project, items: (results[i] && results[i].items) || [] })) }
`;

fs.writeFileSync('scripts/wf-plain-layer.gen.mjs', script, 'utf8');
console.log('wrote scripts/wf-plain-layer.gen.mjs', script.length, 'chars; domains', DATA.length, 'apis', DATA.reduce((n, d) => n + d.apis.length, 0));
