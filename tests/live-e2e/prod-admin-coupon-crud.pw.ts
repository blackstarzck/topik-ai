import { expect, test, type Page, type Response } from '@playwright/test';

const PRODUCTION_PROJECT_REF = 'eymlabowhfgtxbiqwxqh';
const targetProjectRef = process.env.E2E_TARGET_PROJECT_REF ?? PRODUCTION_PROJECT_REF;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const expectedProjectRef = process.env.SUPABASE_EXPECTED_PROJECT_REF;

type VerificationRow = {
  template_rows: number | string;
  saved_audits: number | string;
  deleted_audits: number | string;
  deletion_reason_audits: number | string;
};

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function runSql<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    }
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`live verification query failed (${response.status}): ${body}`);
  }
  return JSON.parse(body) as T[];
}

async function loginIfNeeded(page: Page): Promise<void> {
  if (await page.getByRole('heading', { name: 'TOPIK 관리자 로그인' }).isVisible()) {
    await page.getByLabel('이메일').fill(adminEmail ?? '');
    await page.getByLabel('비밀번호').fill(adminPassword ?? '');
    await page.getByRole('button', { name: '로그인' }).click();
  }
}

test.beforeAll(() => {
  if (!adminEmail || !adminPassword || !accessToken) {
    throw new Error(
      'E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, and SUPABASE_ACCESS_TOKEN are required.'
    );
  }
  if (
    projectRef !== targetProjectRef
    || expectedProjectRef !== targetProjectRef
  ) {
    throw new Error('Live CRUD E2E requires explicit matching target project refs.');
  }
});

test('현재 관리자 계정으로 대상 DB의 정기 쿠폰 CRUD와 감사 로그를 검증한다', async ({
  page
}) => {
  const templateResponses: Response[] = [];
  const runId = Date.now();
  const targetLabel = targetProjectRef === PRODUCTION_PROJECT_REF ? 'PROD' : 'DEV';
  const templateName = `E2E ${targetLabel} PW ${runId}`;
  const updatedTemplateName = `${templateName} UPDATED`;
  const deletionReason = `${targetLabel} Playwright E2E 검증 후 테스트 데이터 정리 ${runId}`;
  let templateId = '';
  let deletedThroughUi = false;

  page.on('response', (response) => {
    if (response.url().includes('/rest/v1/commerce_coupon_subscription_templates')) {
      templateResponses.push(response);
    }
  });

  try {
    await page.goto('/commerce/coupons?view=subscriptionTemplate');
    await loginIfNeeded(page);

    await expect(page.getByRole('heading', { name: '쿠폰' })).toBeVisible();
    await expect(page.getByText('현재 세션: E2E Admin · 슈퍼')).toBeVisible();
    await expect.poll(() => templateResponses.length).toBeGreaterThan(0);
    expect(
      templateResponses.every((response) =>
        response.url().startsWith(`https://${targetProjectRef}.supabase.co/`)
      )
    ).toBe(true);
    expect(templateResponses.some((response) => response.status() >= 400)).toBe(false);

    await page.getByRole('button', { name: '쿠폰 만들기' }).click();
    await page.getByText('정기 쿠폰 템플릿 만들기').click();
    await expect(
      page.getByRole('heading', { name: '정기 쿠폰 템플릿 등록' })
    ).toBeVisible();

    await page.getByPlaceholder('정기 쿠폰명을 입력해 주세요.').fill(templateName);
    await page.getByRole('button', { name: '템플릿 생성' }).click();
    await expect(page.getByText('정기 쿠폰 템플릿을 생성했어요')).toBeVisible();

    await expect.poll(() => new URL(page.url()).searchParams.get('selected')).not.toBeNull();
    templateId = new URL(page.url()).searchParams.get('selected') ?? '';
    expect(templateId).toMatch(/^CPT-\d{4,}$/);

    const drawer = page.locator('.ant-drawer-content-wrapper:visible').last();
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText(templateId);
    await expect(drawer).toContainText(templateName);

    await drawer.getByRole('button', { name: '수정' }).click();
    await expect(
      page.getByRole('heading', { name: '정기 쿠폰 템플릿 수정' })
    ).toBeVisible();
    const nameInput = page.getByPlaceholder('정기 쿠폰명을 입력해 주세요.');
    await expect(nameInput).toHaveValue(templateName);
    await nameInput.fill(updatedTemplateName);
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page.getByText('정기 쿠폰 템플릿을 수정했어요')).toBeVisible();

    const updatedDrawer = page.locator('.ant-drawer-content-wrapper:visible').last();
    await expect(updatedDrawer).toContainText(updatedTemplateName);
    await updatedDrawer.getByRole('button', { name: '삭제' }).click();

    const confirmDialog = page.getByRole('dialog', {
      name: '정기 쿠폰 템플릿을 삭제할까요?'
    });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog
      .getByPlaceholder('조치 사유를 입력해 주세요.')
      .fill(deletionReason);
    await confirmDialog.getByRole('button', { name: '삭제' }).click();
    await expect(page.getByText('정기 쿠폰 템플릿을 삭제했어요')).toBeVisible();
    deletedThroughUi = true;

    await page.getByRole('link', { name: '감사 로그 확인' }).last().click();
    await expect(page).toHaveURL(
      new RegExp(
        `/system/audit-logs\\?targetType=CommerceCouponTemplate&targetId=${templateId}`
      )
    );
    await expect(page.getByRole('heading', { name: '감사 로그' })).toBeVisible();
    await expect(
      page.getByRole('row').filter({ hasText: deletionReason })
    ).toHaveCount(1);
    await expect(
      page.getByRole('row').filter({ hasText: deletionReason })
    ).toContainText('coupon_template_deleted');

    const rows = await runSql<VerificationRow>(`
      select
        (select count(*) from public.commerce_coupon_subscription_templates
          where id = ${sqlLiteral(templateId)}) as template_rows,
        (select count(*) from public.admin_audit_logs
          where target_table = 'CommerceCouponTemplate'
            and target_id = ${sqlLiteral(templateId)}
            and action = 'coupon_template_saved'
            and payload->>'template_name' in (
              ${sqlLiteral(templateName)},
              ${sqlLiteral(updatedTemplateName)}
            )) as saved_audits,
        (select count(*) from public.admin_audit_logs
          where target_table = 'CommerceCouponTemplate'
            and target_id = ${sqlLiteral(templateId)}
            and action = 'coupon_template_deleted'
            and payload->>'template_name' = ${sqlLiteral(updatedTemplateName)})
          as deleted_audits,
        (select count(*) from public.admin_audit_logs
          where target_table = 'CommerceCouponTemplate'
            and target_id = ${sqlLiteral(templateId)}
            and action = 'coupon_template_deleted'
            and payload->>'reason' = ${sqlLiteral(deletionReason)}) as deletion_reason_audits;
    `);
    expect(Number(rows[0]?.template_rows)).toBe(0);
    expect(Number(rows[0]?.saved_audits)).toBe(2);
    expect(Number(rows[0]?.deleted_audits)).toBe(1);
    expect(Number(rows[0]?.deletion_reason_audits)).toBe(1);
  } finally {
    if (templateId && !deletedThroughUi) {
      await runSql(`
        delete from public.commerce_coupon_subscription_templates
        where id = ${sqlLiteral(templateId)}
          and template_name like ${sqlLiteral(`E2E ${targetLabel} PW %`)};
      `);
    }
  }
});
