export type PageFetcher<T> = (from: number, to: number) => Promise<T[]>;

export type FetchAllPagesOptions = {
  /** 한 번에 요청할 행 수. PostgREST db-max-rows 상한보다 커도 서버가 자른다. */
  pageSize: number;
  /** 허용 페이지 수 상한 — 초과는 조용한 절단 대신 명시적 오류로 드러낸다. */
  maxPages: number;
};

/**
 * PostgREST 는 한 응답을 db-max-rows(운영 1000행)로 자르므로, limit 없는 전량
 * 조회는 행이 그 상한을 넘는 순간 조용히 잘린다(HTTP 206). 이 헬퍼는 range
 * 배치로 끝까지 걷는다.
 *
 * 종료 판정은 "짧은 페이지"가 아니라 "빈 페이지"다 — 서버 상한이 pageSize 보다
 * 작으면 모든 페이지가 짧게 오므로, 받은 만큼만 전진하고 빈 응답으로 끝을
 * 확정해야 상한 값과 무관하게 전량이 보장된다.
 */
export async function fetchAllPages<T>(
  fetchPage: PageFetcher<T>,
  options: FetchAllPagesOptions
): Promise<T[]> {
  const { pageSize, maxPages } = options;
  const rows: T[] = [];
  let from = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const slice = await fetchPage(from, from + pageSize - 1);
    if (slice.length === 0) {
      return rows;
    }
    rows.push(...slice);
    from += slice.length;
  }

  throw new Error(
    `paged fetch exceeded ${maxPages} pages (${rows.length} rows so far); ` +
      'refusing to return a silently truncated list'
  );
}
