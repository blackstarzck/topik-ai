import { describe, expect, it } from 'vitest';
import {
  analyzeUsersContract,
  parseLocalRows,
} from '../../scripts/db/verify-users-contract.mjs';

const publicFunction = (signature, result, definition) => ({
  signature,
  exists: true,
  security_definer: true,
  anon_execute: false,
  authenticated_execute: true,
  result,
  definition,
});

function validContract() {
  return {
    functions: [
      publicFunction(
        'get_admin_users(text,text,integer,integer,text)',
        'TABLE(user_id uuid, phone_masked text)',
        'select private.admin_profile_phone(to_jsonb(p)) from public.profiles p'
      ),
      publicFunction(
        'get_admin_user(uuid)',
        'TABLE(user_id uuid, phone text, phone_masked text)',
        'select private.admin_profile_phone(to_jsonb(p)) from public.profiles p'
      ),
      publicFunction(
        'admin_export_users(text,boolean,text,text,uuid[],text,text,date,date,text[],text[],text[],text[],text[],text[],text[])',
        'TABLE(user_id uuid, phone text, phone_masked text)',
        'select private.admin_profile_phone(to_jsonb(pr)) from public.profiles pr'
      ),
      publicFunction(
        'admin_list_audit_logs(text,text,text,timestamp with time zone,timestamp with time zone,integer,integer)',
        'TABLE(target_type text, target_id text)',
        'select target_table as target_type, target_id from public.admin_audit_logs'
      ),
      {
        signature: 'private.admin_profile_phone(jsonb)',
        exists: true,
        security_definer: false,
        anon_execute: false,
        authenticated_execute: false,
        result: 'text',
        definition: "select p_profile ->> 'phone_number'",
      },
    ],
    profile_columns: ['phone_country_code', 'phone_number'],
  };
}

describe('Users release DB contract', () => {
  it.each([
    [[{ contract: { functions: [] } }]],
    [{ result: [{ contract: { functions: [] } }] }],
    [{ result: { contract: { functions: [] } } }],
    [{ data: [{ contract: { functions: [] } }] }],
    [{ result: { data: [{ contract: { functions: [] } }] } }],
    [{ boundary: null, rows: [{ contract: { functions: [] } }], warning: null }],
  ])('accepts Supabase CLI JSON envelopes', (payload) => {
    expect(parseLocalRows(JSON.stringify(payload))).toHaveLength(1);
  });

  it('accepts split phone columns and protected admin RPCs', () => {
    const result = analyzeUsersContract(validContract(), { requireNoLegacyPhone: true });
    expect(result.clean).toBe(true);
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects anonymous execute and a legacy direct phone dependency', () => {
    const contract = validContract();
    contract.functions[0].anon_execute = true;
    contract.functions[0].definition = 'select p.phone from public.profiles p';
    const result = analyzeUsersContract(contract, { requireNoLegacyPhone: true });
    expect(result.issues).toContain(
      'anon-execute-enabled:get_admin_users(text,text,integer,integer,text)'
    );
    expect(result.issues).toContain(
      'legacy-phone-reference:get_admin_users(text,text,integer,integer,text)'
    );
  });
});
