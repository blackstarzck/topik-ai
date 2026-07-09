// v13 feedback_dimension_scores.dimension 슬러그 → 한글 라벨(작문 평가 차원 7종).
// dev DB 실측 기준: content/expression/grammar/language/structure/topic_fit/vocab.
export const writingDimensionLabels: Record<string, string> = {
  content: '내용',
  structure: '구성',
  expression: '표현',
  grammar: '문법',
  vocab: '어휘',
  topic_fit: '주제 적합성',
  language: '언어 사용'
};

export const formatWritingDimension = (value: string): string =>
  writingDimensionLabels[value] ?? value;
