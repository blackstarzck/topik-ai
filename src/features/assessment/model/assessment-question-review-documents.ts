import type { AssessmentQuestionReviewDocument } from './assessment-question-bank-types';

export const assessmentQuestionReviewDocumentsByQuestionId = {
  'AQ-54001': {
    id: 'd04cf277-a178-4810-8720-dbef5c781ea7',
    created_at: '2026-03-26T17:17:36.957000+09:00',
    meta: {
      domain: '경제',
      topic_type: 'importance_problem_effort',
      question_type: 'importance_problem_effort',
      narrative_slots: [
        'summary_trend',
        'detail_feature',
        'cause_sentence',
        'problem_sentence',
        'solution_sentence',
        'forecast_sentence'
      ],
      difficulty: 5,
      inference_gap: true,
      link_keywords: ['우선', '또한', '마지막으로']
    },
    review_workflow: {
      stage_order: ['topic_logic', 'graph_logic', 'rubric', 'final_question'],
      topic_logic: {
        status: 'approved',
        approval_source: 'rule_based_generation',
        artifact_id: 'topic-0694'
      },
      graph_logic: {
        status: 'approved',
        approval_source: 'rule_based_generation',
        artifact_id: 'logic-0694'
      },
      rubric: {
        status: 'approved',
        approval_source: 'rubric_derived_from_source',
        artifact_id: 'rubric-0694'
      },
      final_question: {
        status: 'approved',
        approval_source: 'rule_based_generation',
        artifact_id: 'item-0694'
      }
    },
    approved_topic_seed: {
      shortlist_id: 'topic-0694',
      topic_seed_title: '기초 금융 이해 교육',
      shared_context:
        "기초 금융 이해 교육은 돈의 관리와 위험, 책임을 이해하도록 돕는 교육을 뜻한다.\n\n최근 학교와 사회가 미래 역량의 중요성을 더 크게 인식하면서 기초 금융 이해 교육의 중요성이 다시 주목받고 있다. 기초 금융 이해 교육은 학습자가 자신을 이해하고 성장의 방향을 찾는 데 도움이 된다는 점에서 중요하다. 하지만 충분한 이해와 실천이 따르지 않으면 활동이 형식적으로 흐르거나 학생 사이의 경험 격차가 커질 수 있다. 아래의 내용을 중심으로 '기초 금융 이해 교육'에 대한 자신의 생각을 쓰라.",
      expected_question_type: 'importance_problem_effort',
      expected_cross_chart_bridge:
        '세 가지 과제를 연결하여 가치, 한계, 해결 방안을 논의하도록 설계한다.',
      why_exam_worthy:
        '추상적 사회 주제에 대해 논리적인 주장과 해결 방안을 600~700자로 전개하는 TOPIK 54의 핵심 역량을 점검할 수 있다.'
    },
    approved_graph_logic: {
      graph_logic_id: 'logic-0694',
      scenario_title: '기초 금융 이해 교육',
      logic_chain: ['의미', '문제', '대응'],
      chart_a_focus: '기초 금융 이해 교육이 청소년의 생활과 선택에 왜 필요한가?',
      chart_b_focus: '기초 금융 이해 교육이 부족하면 어떤 판단 실수나 피해가 생길 수 있는가?',
      cross_chart_bridge: '기초 금융 이해 교육이 실제 생활에 도움이 되도록 하려면 무엇이 필요한가?',
      writing_reason:
        '배경 제시문 뒤에 세 가지 과제를 두어 도입-전개-마무리 구조의 답안을 유도한다.'
    },
    approved_rubric: {
      rubric_id: 'rubric-0694',
      content:
        '주어진 세 가지 과제를 모두 수행하고, 주제와 직접 관련된 내용을 풍부하고 구체적으로 전개하였는가.',
      language:
        '격식체를 유지하면서 문법, 어휘, 맞춤법을 다양하고 정확하게 사용하였는가.',
      structure:
        '도입-전개-마무리의 흐름이 분명하고, 단락 구성과 담화 표지가 논리 전개에 효과적으로 기여하는가.',
      rubric_focus_summary:
        '세 가지 과제를 빠짐없이 수행하면서 격식체와 논리적 전개를 유지하도록 요구한다.'
    },
    chart_roles: {
      chart_a_role: '',
      chart_b_role: ''
    },
    scenario_logic: {
      scenario_title: '기초 금융 이해 교육',
      shared_context:
        "기초 금융 이해 교육은 돈의 관리와 위험, 책임을 이해하도록 돕는 교육을 뜻한다.\n\n최근 학교와 사회가 미래 역량의 중요성을 더 크게 인식하면서 기초 금융 이해 교육의 중요성이 다시 주목받고 있다. 기초 금융 이해 교육은 학습자가 자신을 이해하고 성장의 방향을 찾는 데 도움이 된다는 점에서 중요하다. 하지만 충분한 이해와 실천이 따르지 않으면 활동이 형식적으로 흐르거나 학생 사이의 경험 격차가 커질 수 있다. 아래의 내용을 중심으로 '기초 금융 이해 교육'에 대한 자신의 생각을 쓰라.",
      logic_chain: ['의미', '문제', '대응'],
      chart_a_focus: '기초 금융 이해 교육이 청소년의 생활과 선택에 왜 필요한가?',
      chart_b_focus: '기초 금융 이해 교육이 부족하면 어떤 판단 실수나 피해가 생길 수 있는가?',
      cross_chart_bridge: '기초 금융 이해 교육이 실제 생활에 도움이 되도록 하려면 무엇이 필요한가?',
      writing_reason:
        '가치 또는 현상을 제시한 뒤 문제와 해결로 전개하는 최근 54번의 출제 흐름을 반영한다.'
    },
    relation: {
      cause_label: '불확실한 경제 환경과 생활비 부담 증가',
      effect_label: '기초 금융 이해 교육',
      description: '기초 금융 이해 교육의 의미와 문제, 대응 방향을 균형 있게 서술하도록 구성하였다.'
    },
    chart_a: {
      chart_type: '',
      title: '',
      unit: '',
      survey_org: '',
      year_range: [],
      series: []
    },
    chart_b: {
      chart_type: '',
      title: '',
      unit: '',
      survey_org: '',
      year_range: [],
      series: []
    },
    context_notes: {
      display_label: '검수 기준',
      row1_label: '핵심 의미',
      row1_value: '학습자가 자신을 이해하고 성장의 방향을 찾는 데 도움이 된다는',
      row2_label: '핵심 문제',
      row2_value: '활동이 형식적으로 흐르거나 학생 사이의 경험 격차가 커질 수 있다',
      cause: '학교와 가정, 지역사회가 역할을 나누고 지속적인 지원 체계를 마련해야 한다',
      status:
        '단기 성과보다 공정한 기회와 장기적인 성장 가능성을 함께 고려하는 방향으로 이루어져야 한다'
    },
    narrative: {
      summary_trend: '최근 학교와 사회가 미래 역량의 중요성을 더 크게 인식하면서 기초 금융 이해 교육에 대한 논의가 커지고 있다.',
      detail_feature: '학습자가 자신을 이해하고 성장의 방향을 찾는 데 도움이 된다는 점에서 중요하다.',
      rank_flip_sentence: '',
      cause_keywords: ['기초', '중립'],
      cause_sentence: '적절하게 운영되면 배움의 의미를 넓히고 학교와 사회를 연결하는 실제 경험을 제공할 수 있다.',
      plan_keywords: [],
      forecast_sentence:
        '기초 금융 이해 교육은 객관적이고 이해하기 쉬운 설명을 바탕으로 다루어질 때 더 안정적으로 정착할 수 있다.',
      problem_sentence: '활동이 형식적으로 흐르거나 학생 사이의 경험 격차가 커질 수 있다.',
      solution_keywords: [],
      solution_sentence: '학교와 가정, 지역사회가 역할을 나누고 지속적인 지원 체계를 마련해야 한다.'
    },
    prompt_text:
      "다음을 주제로 하여 자신의 생각을 600~700자로 쓰시오. 단, 문제를 그대로 옮겨 쓰지 마시오. (50점)\n\n기초 금융 이해 교육은 돈의 관리와 위험, 책임을 이해하도록 돕는 교육을 뜻한다.\n\n최근 학교와 사회가 미래 역량의 중요성을 더 크게 인식하면서 기초 금융 이해 교육의 중요성이 다시 주목받고 있다. 기초 금융 이해 교육은 학습자가 자신을 이해하고 성장의 방향을 찾는 데 도움이 된다는 점에서 중요하다. 하지만 충분한 이해와 실천이 따르지 않으면 활동이 형식적으로 흐르거나 학생 사이의 경험 격차가 커질 수 있다. 아래의 내용을 중심으로 '기초 금융 이해 교육'에 대한 자신의 생각을 쓰라.\n1) 기초 금융 이해 교육이 청소년의 생활과 선택에 왜 필요한가?\n2) 기초 금융 이해 교육이 부족하면 어떤 판단 실수나 피해가 생길 수 있는가?\n3) 기초 금융 이해 교육이 실제 생활에 도움이 되도록 하려면 무엇이 필요한가?",
    model_answer:
      '기초 금융 이해 교육은 돈의 관리와 위험, 책임을 이해하도록 돕는 교육을 뜻한다. 최근 학교와 사회가 미래 역량의 중요성을 더 크게 인식하면서 기초 금융 이해 교육에 대한 관심이 커지고 있다. 이 주제는 학습자가 자신을 이해하고 성장의 방향을 찾는 데 도움이 된다는 점에서 중요하다. 적절하게 운영되면 배움의 의미를 넓히고 학교와 사회를 연결하는 실제 경험을 제공할 수 있다. 하지만 준비와 이해가 부족하면 활동이 형식적으로 흐르거나 학생 사이의 경험 격차가 커질 수 있다. 과도한 경쟁과 비교가 생기면 본래의 교육 목적이 약해질 수 있다. 따라서 개인은 학습자와 보호자, 교사가 결과보다 성장 과정을 함께 존중하는 태도를 가져야 한다. 또한 사회와 관련 기관은 학교와 가정, 지역사회가 역할을 나누고 지속적인 지원 체계를 마련해야 한다. 어려운 핵심 어휘가 들어갈 때에는 학습자가 문맥 안에서 뜻을 이해할 수 있도록 설명하는 방식이 필요하다. 결국 이 주제에 대한 논의는 단기 성과보다 공정한 기회와 장기적인 성장 가능성을 함께 고려하는 방향으로 이루어져야 한다. 중요한 것은 새로운 흐름을 무조건 따르거나 거부하는 것이 아니라, 실제 생활과 제도에 어떤 영향을 주는지 차분히 살피는 태도이다. 특히 핵심 개념이 어려운 경우에는 누구나 이해할 수 있도록 쉽게 설명하고, 다양한 배경을 가진 사람도 참여할 수 있게 해야 한다.',
    rubric: {
      content:
        '주어진 세 가지 과제를 모두 수행하고, 주제와 직접 관련된 내용을 풍부하고 구체적으로 전개하였는가.',
      structure:
        '도입-전개-마무리의 흐름이 분명하고, 단락 구성과 담화 표지가 논리 전개에 효과적으로 기여하는가.',
      language:
        '격식체를 유지하면서 문법, 어휘, 맞춤법을 다양하고 정확하게 사용하였는가.'
    },
    review_memo:
      "1) 문항에 문단 나누기 하지 말라\n2) 전체적으로 '아래의 내용을 중심으로 '(주제)'에 대한 자신의 생각을 쓰라.'라는 문항에서 (주제)는 아래의 세부 문항 내용을 포함하고 있어야 함,\n예를 들어 \n'아래의 내용을 중심으로 '창의력의 필요성과 기를 기르기 위한 노력'에 대한 자신을 생각을 쓰라.'라는 문항에서 1) 창의력이 필요한 이유는 무엇인가? 2) 창의력을 발휘했을 때 얻을 수 있는 성과는 무엇인가? 3) 창의력을 기르기 위해서 어떠한 노력을 할 수 있는가? \n\n제공된 세부 문항은 선택 사항이 아니라, 메인 글을 구성하기 위한 필수 개요 및 제약 조건으로 존재하거든, 즉, 대주제와 필수 포함 조건을 명확히 분리해야 해!\n-> 작성 주제: (주제)\n-> 필수 포함 조건: 본론 작성 시 다음 1, 2, 3번의 내용을 반드시 포함하여 논리적으로 연결할 것.",
    edit_history: [
      {
        edited_at: '2026-03-26',
        edited_by: 'codex',
        edit_type: 'synthetic_generation',
        source: 'past_exam_patterns_and_rubric',
        changed_fields: ['prompt_text', 'model_answer', 'rubric'],
        summary: '기출 54번의 최근 구조와 채점 기준을 반영하여 배경 제시문, 3개 과제, 격식체 모범답안을 생성함.',
        review_snapshot: ''
      },
      {
        edited_at: '2026-03-26',
        edited_by: 'codex',
        edit_type: 'curated_selection',
        source: 'best100_review',
        changed_fields: ['edit_history'],
        summary: '상위 100개 선별본에 포함함.',
        review_snapshot:
          '소액 투자 교육 선정 사유: 장점-문제-해결의 세 과제가 분명하여 54번형 논술 구조에 가장 잘 맞는다. 모범답안 길이가 620~660자 구간에 있어 실제 답안 분량 기준과 가장 잘 맞는다. 조사 결합 오류가 두드러지지 않아 문장 자연도가 비교적 높다. 주제와 대상 집단의 연결이 크게 어긋나지 않아 활용하기 좋다. 위 기준으로 재검토한 결과 상위 점수권에 들어 선별본에 포함했다. (score=123)'
      },
      {
        edited_at: '2026-03-27',
        edited_by: 'codex',
        edit_type: 'rule_based_revision',
        source: 'TOPIK54_출제_규칙.md',
        changed_fields: [
          'approved_topic_seed',
          'approved_graph_logic',
          'scenario_logic',
          'relation',
          'context_notes',
          'narrative',
          'meta',
          'prompt_text',
          'model_answer'
        ],
        summary: 'TOPIK54 출제 규칙 문서에 맞추어 주제 표현, 지시문, 하위 질문, 모범답안을 실제 기출형 문체로 재작성함.',
        review_snapshot:
          '민감도 금지 기준, 중립성, 어휘 난이도 설명, 실제 기출형 3과제 구조를 반영하여 수정함.'
      },
      {
        edited_at: '2026-03-27',
        edited_by: 'codex',
        edit_type: 'rule_based_revision',
        source: 'TOPIK54_출제_규칙.md',
        changed_fields: [
          'approved_topic_seed',
          'approved_graph_logic',
          'scenario_logic',
          'relation',
          'context_notes',
          'narrative',
          'meta',
          'prompt_text',
          'model_answer'
        ],
        summary: 'TOPIK54 출제 규칙 문서에 맞추어 주제 표현, 지시문, 하위 질문, 모범답안을 실제 기출형 문체로 재작성함.',
        review_snapshot:
          '민감도 금지 기준, 중립성, 어휘 난이도 설명, 실제 기출형 3과제 구조를 반영하여 수정함.'
      }
    ],
    review_passed: false
  },
  'AQ-54002': {
    id: 'b7d2f101-4631-49fc-8bc7-119d9384ef41',
    created_at: '2026-03-26T17:17:36.978395+09:00',
    meta: {
      domain: '교육',
      topic_type: 'importance_problem_effort',
      question_type: 'importance_problem_effort',
      narrative_slots: [
        'summary_trend',
        'detail_feature',
        'cause_sentence',
        'problem_sentence',
        'solution_sentence',
        'forecast_sentence'
      ],
      difficulty: 6,
      inference_gap: true,
      link_keywords: ['우선', '또한', '마지막으로']
    },
    review_workflow: {
      stage_order: ['topic_logic', 'graph_logic', 'rubric', 'final_question'],
      topic_logic: {
        status: 'approved',
        approval_source: 'rule_based_generation',
        artifact_id: 'topic-0255'
      },
      graph_logic: {
        status: 'approved',
        approval_source: 'rule_based_generation',
        artifact_id: 'logic-0255'
      },
      rubric: {
        status: 'approved',
        approval_source: 'rubric_derived_from_source',
        artifact_id: 'rubric-0255'
      },
      final_question: {
        status: 'approved',
        approval_source: 'rule_based_generation',
        artifact_id: 'item-0255'
      }
    },
    approved_topic_seed: {
      shortlist_id: 'topic-0255',
      topic_seed_title: '실패 경험 교육',
      shared_context:
        "최근 학교와 사회가 미래 역량의 중요성을 더 크게 인식하면서 실패 경험 교육의 중요성이 다시 주목받고 있다. 실패 경험 교육은 학습자가 자신을 이해하고 성장의 방향을 찾는 데 도움이 된다는 점에서 중요하다. 하지만 충분한 이해와 실천이 따르지 않으면 활동이 형식적으로 흐르거나 학생 사이의 경험 격차가 커질 수 있다. 아래의 내용을 중심으로 '실패 경험 교육'에 대한 자신의 생각을 쓰라.",
      expected_question_type: 'importance_problem_effort',
      expected_cross_chart_bridge:
        '세 가지 과제를 연결하여 가치, 한계, 해결 방안을 논의하도록 설계한다.',
      why_exam_worthy:
        '추상적 사회 주제에 대해 논리적인 주장과 해결 방안을 600~700자로 전개하는 TOPIK 54의 핵심 역량을 점검할 수 있다.'
    },
    approved_graph_logic: {
      graph_logic_id: 'logic-0255',
      scenario_title: '실패 경험 교육',
      logic_chain: ['의미', '문제', '대응'],
      chart_a_focus: '실패 경험 교육이 학생의 성장 과정에 왜 필요한가?',
      chart_b_focus: '실패를 무조건 피하거나 부정적으로만 받아들이면 어떤 문제가 생길 수 있는가?',
      cross_chart_bridge: '실패 경험 교육이 건강하게 이루어지기 위해 학교와 사회는 무엇을 해야 하는가?',
      writing_reason:
        '배경 제시문 뒤에 세 가지 과제를 두어 도입-전개-마무리 구조의 답안을 유도한다.'
    },
    approved_rubric: {
      rubric_id: 'rubric-0255',
      content:
        '주어진 세 가지 과제를 모두 수행하고, 주제와 직접 관련된 내용을 풍부하고 구체적으로 전개하였는가.',
      language:
        '격식체를 유지하면서 문법, 어휘, 맞춤법을 다양하고 정확하게 사용하였는가.',
      structure:
        '도입-전개-마무리의 흐름이 분명하고, 단락 구성과 담화 표지가 논리 전개에 효과적으로 기여하는가.',
      rubric_focus_summary:
        '세 가지 과제를 빠짐없이 수행하면서 격식체와 논리적 전개를 유지하도록 요구한다.'
    },
    chart_roles: {
      chart_a_role: '',
      chart_b_role: ''
    },
    scenario_logic: {
      scenario_title: '실패 경험 교육',
      shared_context:
        "최근 학교와 사회가 미래 역량의 중요성을 더 크게 인식하면서 실패 경험 교육의 중요성이 다시 주목받고 있다. 실패 경험 교육은 학습자가 자신을 이해하고 성장의 방향을 찾는 데 도움이 된다는 점에서 중요하다. 하지만 충분한 이해와 실천이 따르지 않으면 활동이 형식적으로 흐르거나 학생 사이의 경험 격차가 커질 수 있다. 아래의 내용을 중심으로 '실패 경험 교육'에 대한 자신의 생각을 쓰라.",
      logic_chain: ['의미', '문제', '대응'],
      chart_a_focus: '실패 경험 교육이 학생의 성장 과정에 왜 필요한가?',
      chart_b_focus: '실패를 무조건 피하거나 부정적으로만 받아들이면 어떤 문제가 생길 수 있는가?',
      cross_chart_bridge: '실패 경험 교육이 건강하게 이루어지기 위해 학교와 사회는 무엇을 해야 하는가?',
      writing_reason:
        '가치 또는 현상을 제시한 뒤 문제와 해결로 전개하는 최근 54번의 출제 흐름을 반영한다.'
    },
    relation: {
      cause_label: '지식보다 역량이 강조되는 변화',
      effect_label: '실패 경험 교육',
      description: '실패 경험 교육의 의미와 문제, 대응 방향을 균형 있게 서술하도록 구성하였다.'
    },
    chart_a: {
      chart_type: '',
      title: '',
      unit: '',
      survey_org: '',
      year_range: [],
      series: []
    },
    chart_b: {
      chart_type: '',
      title: '',
      unit: '',
      survey_org: '',
      year_range: [],
      series: []
    },
    context_notes: {
      display_label: '검수 기준',
      row1_label: '핵심 의미',
      row1_value: '학습자가 자신을 이해하고 성장의 방향을 찾는 데 도움이 된다는',
      row2_label: '핵심 문제',
      row2_value: '활동이 형식적으로 흐르거나 학생 사이의 경험 격차가 커질 수 있다',
      cause: '학교와 가정, 지역사회가 역할을 나누고 지속적인 지원 체계를 마련해야 한다',
      status:
        '단기 성과보다 공정한 기회와 장기적인 성장 가능성을 함께 고려하는 방향으로 이루어져야 한다'
    },
    narrative: {
      summary_trend: '최근 학교와 사회가 미래 역량의 중요성을 더 크게 인식하면서 실패 경험 교육에 대한 논의가 커지고 있다.',
      detail_feature: '학습자가 자신을 이해하고 성장의 방향을 찾는 데 도움이 된다는 점에서 중요하다.',
      rank_flip_sentence: '',
      cause_keywords: ['실패', '중립'],
      cause_sentence: '적절하게 운영되면 배움의 의미를 넓히고 학교와 사회를 연결하는 실제 경험을 제공할 수 있다.',
      plan_keywords: [],
      forecast_sentence:
        '실패 경험 교육은 객관적이고 이해하기 쉬운 설명을 바탕으로 다루어질 때 더 안정적으로 정착할 수 있다.',
      problem_sentence: '활동이 형식적으로 흐르거나 학생 사이의 경험 격차가 커질 수 있다.',
      solution_keywords: [],
      solution_sentence: '학교와 가정, 지역사회가 역할을 나누고 지속적인 지원 체계를 마련해야 한다.'
    },
    prompt_text:
      "다음을 주제로 하여 자신의 생각을 600~700자로 쓰시오. 단, 문제를 그대로 옮겨 쓰지 마시오. (50점)\n\n최근 학교와 사회가 미래 역량의 중요성을 더 크게 인식하면서 실패 경험 교육의 중요성이 다시 주목받고 있다. 실패 경험 교육은 학습자가 자신을 이해하고 성장의 방향을 찾는 데 도움이 된다는 점에서 중요하다. 하지만 충분한 이해와 실천이 따르지 않으면 활동이 형식적으로 흐르거나 학생 사이의 경험 격차가 커질 수 있다. 아래의 내용을 중심으로 '실패 경험 교육'에 대한 자신의 생각을 쓰라.\n1) 실패 경험 교육이 학생의 성장 과정에 왜 필요한가?\n2) 실패를 무조건 피하거나 부정적으로만 받아들이면 어떤 문제가 생길 수 있는가?\n3) 실패 경험 교육이 건강하게 이루어지기 위해 학교와 사회는 무엇을 해야 하는가?",
    model_answer:
      '최근 학교와 사회가 미래 역량의 중요성을 더 크게 인식하면서 실패 경험 교육에 대한 관심이 커지고 있다. 이 주제는 학습자가 자신을 이해하고 성장의 방향을 찾는 데 도움이 된다는 점에서 중요하다. 적절하게 운영되면 배움의 의미를 넓히고 학교와 사회를 연결하는 실제 경험을 제공할 수 있다. 하지만 준비와 이해가 부족하면 활동이 형식적으로 흐르거나 학생 사이의 경험 격차가 커질 수 있다. 과도한 경쟁과 비교가 생기면 본래의 교육 목적이 약해질 수 있다. 따라서 개인은 학습자와 보호자, 교사가 결과보다 성장 과정을 함께 존중하는 태도를 가져야 한다. 또한 사회와 관련 기관은 학교와 가정, 지역사회가 역할을 나누고 지속적인 지원 체계를 마련해야 한다. 어려운 핵심 어휘가 들어갈 때에는 학습자가 문맥 안에서 뜻을 이해할 수 있도록 설명하는 방식이 필요하다. 결국 이 주제에 대한 논의는 단기 성과보다 공정한 기회와 장기적인 성장 가능성을 함께 고려하는 방향으로 이루어져야 한다. 이 과정에서 특정 집단에 대한 편견이나 고정관념이 개입되지 않도록 객관적이고 중립적인 기준을 유지하는 일도 중요하다. 중요한 것은 새로운 흐름을 무조건 따르거나 거부하는 것이 아니라, 실제 생활과 제도에 어떤 영향을 주는지 차분히 살피는 태도이다.',
    rubric: {
      content:
        '주어진 세 가지 과제를 모두 수행하고, 주제와 직접 관련된 내용을 풍부하고 구체적으로 전개하였는가.',
      structure:
        '도입-전개-마무리의 흐름이 분명하고, 단락 구성과 담화 표지가 논리 전개에 효과적으로 기여하는가.',
      language:
        '격식체를 유지하면서 문법, 어휘, 맞춤법을 다양하고 정확하게 사용하였는가.'
    },
    review_memo: '1) 실패 경험 교육이 아니라 실패를 한 경험을 주제로 하면 좋겠어',
    edit_history: [
      {
        edited_at: '2026-03-26',
        edited_by: 'codex',
        edit_type: 'synthetic_generation',
        source: 'past_exam_patterns_and_rubric',
        changed_fields: ['prompt_text', 'model_answer', 'rubric'],
        summary: '기출 54번의 최근 구조와 채점 기준을 반영하여 배경 제시문, 3개 과제, 격식체 모범답안을 생성함.',
        review_snapshot: ''
      },
      {
        edited_at: '2026-03-26',
        edited_by: 'codex',
        edit_type: 'curated_selection',
        source: 'best100_review',
        changed_fields: ['edit_history'],
        summary: '상위 100개 선별본에 포함함.',
        review_snapshot:
          '실패 경험 교육 선정 사유: 장점-문제-해결의 세 과제가 분명하여 54번형 논술 구조에 가장 잘 맞는다. 모범답안 길이가 620~660자 구간에 있어 실제 답안 분량 기준과 가장 잘 맞는다. 조사 결합 오류가 두드러지지 않아 문장 자연도가 비교적 높다. 주제와 대상 집단의 연결이 크게 어긋나지 않아 활용하기 좋다. 위 기준으로 재검토한 결과 상위 점수권에 들어 선별본에 포함했다. (score=123)'
      },
      {
        edited_at: '2026-03-27',
        edited_by: 'codex',
        edit_type: 'rule_based_revision',
        source: 'TOPIK54_출제_규칙.md',
        changed_fields: [
          'approved_topic_seed',
          'approved_graph_logic',
          'scenario_logic',
          'relation',
          'context_notes',
          'narrative',
          'meta',
          'prompt_text',
          'model_answer'
        ],
        summary: 'TOPIK54 출제 규칙 문서에 맞추어 주제 표현, 지시문, 하위 질문, 모범답안을 실제 기출형 문체로 재작성함.',
        review_snapshot:
          '민감도 금지 기준, 중립성, 어휘 난이도 설명, 실제 기출형 3과제 구조를 반영하여 수정함.'
      },
      {
        edited_at: '2026-03-27',
        edited_by: 'codex',
        edit_type: 'rule_based_revision',
        source: 'TOPIK54_출제_규칙.md',
        changed_fields: [
          'approved_topic_seed',
          'approved_graph_logic',
          'scenario_logic',
          'relation',
          'context_notes',
          'narrative',
          'meta',
          'prompt_text',
          'model_answer'
        ],
        summary: 'TOPIK54 출제 규칙 문서에 맞추어 주제 표현, 지시문, 하위 질문, 모범답안을 실제 기출형 문체로 재작성함.',
        review_snapshot:
          '민감도 금지 기준, 중립성, 어휘 난이도 설명, 실제 기출형 3과제 구조를 반영하여 수정함.'
      }
    ],
    review_passed: false
  }
} satisfies Record<string, AssessmentQuestionReviewDocument>;
