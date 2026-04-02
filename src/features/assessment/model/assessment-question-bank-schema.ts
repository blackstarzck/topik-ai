export function parseAssessmentQuestionReviewPassed(
  value: string | null
): boolean | null {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return null;
}

export function getWorkflowStatusColor(status: string): string {
  if (status === 'approved') {
    return 'green';
  }

  if (status === 'rejected') {
    return 'volcano';
  }

  if (status === 'pending') {
    return 'gold';
  }

  return 'default';
}

export function getReviewPassedColor(reviewPassed: boolean): string {
  return reviewPassed ? 'green' : 'default';
}

export function getReviewPassedLabel(reviewPassed: boolean): string {
  return reviewPassed ? '검수 통과' : '검수 미통과';
}
