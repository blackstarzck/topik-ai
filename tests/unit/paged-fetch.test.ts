import { describe, expect, it } from 'vitest';

import { fetchAllPages } from '../../src/shared/api/paged-fetch';

function makeServer(total: number, serverCap?: number) {
  const calls: Array<[number, number]> = [];
  const rows = Array.from({ length: total }, (_, index) => index);
  const fetchPage = async (from: number, to: number): Promise<number[]> => {
    calls.push([from, to]);
    const requested = to - from + 1;
    const granted = serverCap ? Math.min(requested, serverCap) : requested;
    return rows.slice(from, from + granted);
  };
  return { calls, fetchPage };
}

describe('fetchAllPages — PostgREST db-max-rows 절단 방어', () => {
  it('0행이면 1회 호출로 빈 배열을 돌려준다', async () => {
    const { calls, fetchPage } = makeServer(0);
    await expect(
      fetchAllPages(fetchPage, { pageSize: 10, maxPages: 3 })
    ).resolves.toEqual([]);
    expect(calls).toEqual([[0, 9]]);
  });

  it('짧은 페이지로 끝을 단정하지 않고 빈 페이지로 확정한다', async () => {
    const { calls, fetchPage } = makeServer(3);
    const rows = await fetchAllPages(fetchPage, { pageSize: 10, maxPages: 3 });
    expect(rows).toEqual([0, 1, 2]);
    expect(calls).toEqual([
      [0, 9],
      [3, 12]
    ]);
  });

  it('페이지 경계를 정확히 걸어 전량을 잇는다', async () => {
    const { fetchPage } = makeServer(20);
    const rows = await fetchAllPages(fetchPage, { pageSize: 10, maxPages: 5 });
    expect(rows).toHaveLength(20);
    expect(rows).toEqual(Array.from({ length: 20 }, (_, index) => index));
  });

  it('서버 상한이 pageSize 보다 작아도 전량을 받는다 (핵심 회귀 케이스)', async () => {
    // 운영 db-max-rows 가 요청 range 보다 작게 잘라 돌려주는 상황.
    const { fetchPage } = makeServer(14, 4);
    const rows = await fetchAllPages(fetchPage, { pageSize: 10, maxPages: 10 });
    expect(rows).toHaveLength(14);
    expect(rows).toEqual(Array.from({ length: 14 }, (_, index) => index));
  });

  it('페이지 상한 초과는 조용한 절단 대신 명시적 오류다', async () => {
    const { fetchPage } = makeServer(1000);
    await expect(
      fetchAllPages(fetchPage, { pageSize: 10, maxPages: 3 })
    ).rejects.toThrow(/refusing to return a silently truncated list/);
  });
});
