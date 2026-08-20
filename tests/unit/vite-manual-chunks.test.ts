import { describe, expect, it } from 'vitest';

import { packageNameOfModuleId, vendorChunkOfPackage } from '../../vite.config';

describe('packageNameOfModuleId', () => {
  it('reads the package name from unscoped and scoped module ids', () => {
    expect(packageNameOfModuleId('/repo/node_modules/react-dom/client.js')).toBe('react-dom');
    expect(packageNameOfModuleId('/repo/node_modules/@supabase/auth-js/dist/main/index.js')).toBe(
      '@supabase/auth-js'
    );
  });

  it('uses the last node_modules segment so nested installs resolve to the inner package', () => {
    expect(
      packageNameOfModuleId('/repo/node_modules/antd/node_modules/rc-util/es/hooks/useEvent.js')
    ).toBe('rc-util');
  });

  it('normalizes Windows separators', () => {
    expect(packageNameOfModuleId('C:\\repo\\node_modules\\scheduler\\index.js')).toBe('scheduler');
  });

  it('returns undefined for app sources and for a scope with no package segment', () => {
    expect(packageNameOfModuleId('/repo/src/app/app.tsx')).toBeUndefined();
    expect(packageNameOfModuleId('/repo/node_modules/@supabase')).toBeUndefined();
  });
});

describe('vendorChunkOfPackage', () => {
  it('groups the react runtime and router into one deploy-stable chunk', () => {
    for (const packageName of [
      'react',
      'react-dom',
      'scheduler',
      'react-router',
      'react-router-dom',
      '@remix-run/router'
    ]) {
      expect(vendorChunkOfPackage(packageName)).toBe('vendor-react');
    }
  });

  it('groups every @supabase client package into one chunk', () => {
    for (const packageName of [
      '@supabase/supabase-js',
      '@supabase/auth-js',
      '@supabase/postgrest-js',
      '@supabase/storage-js',
      '@supabase/realtime-js'
    ]) {
      expect(vendorChunkOfPackage(packageName)).toBe('vendor-supabase');
    }
  });

  /**
   * 회귀 가드 — antd 계열을 이름 규칙으로 묶으면 초기 페이로드가 커진다(gap-register §3.14).
   * 배럴(`antd/es/index.js`) 때문에 표 전용 `rc-table`·날짜 전용 `rc-picker` 까지 엔트리에서
   * 정적 도달 가능해 보이지만, Rollup 은 tree-shaking 이후 기준으로 이들을 지연 청크에 둔다.
   * 실측: 이 그룹을 넣었을 때 초기 페이로드가 1,250.79 → 1,741 kB 로 늘었다.
   */
  it('leaves the antd ecosystem to the default chunking', () => {
    for (const packageName of [
      'antd',
      'rc-table',
      'rc-picker',
      'rc-select',
      'rc-field-form',
      '@rc-component/trigger',
      '@ant-design/icons',
      '@ant-design/cssinjs',
      'stylis'
    ]) {
      expect(vendorChunkOfPackage(packageName)).toBeUndefined();
    }
  });

  it('leaves on-demand heavy packages to the default chunking', () => {
    expect(vendorChunkOfPackage('exceljs')).toBeUndefined();
    expect(vendorChunkOfPackage('dayjs')).toBeUndefined();
    expect(vendorChunkOfPackage('@dnd-kit/core')).toBeUndefined();
  });
});
