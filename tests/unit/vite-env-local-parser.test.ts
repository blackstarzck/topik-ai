import { describe, expect, it } from 'vitest';

import { parseDotEnvLocal } from '../../vite.config';

describe('parseDotEnvLocal', () => {
  it('parses a BOM-prefixed first variable used by the local API adapter', () => {
    expect(
      parseDotEnvLocal(
        '\uFEFFVITE_SUPABASE_URL="https://dev.supabase.co"\r\nSUPABASE_SECRET_KEY=secret'
      )
    ).toEqual([
      ['VITE_SUPABASE_URL', 'https://dev.supabase.co'],
      ['SUPABASE_SECRET_KEY', 'secret']
    ]);
  });

  it('supports comments, whitespace, export syntax, and quoted values', () => {
    expect(
      parseDotEnvLocal("  # local only\n export API_BASE_URL = 'http://127.0.0.1:5180' \n")
    ).toEqual([['API_BASE_URL', 'http://127.0.0.1:5180']]);
  });
});
