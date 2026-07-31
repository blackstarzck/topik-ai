-- ============================================================================
-- TALKPIK AI - 2026-07-10 - restrict profile country codes to the ISO alpha-2 set
--
-- WHY
--   profiles.phone_country_code only enforced the loose shape check
--   `phone_country_code ~ '^[A-Z]{2}$'` (created 20260709153000, re-created
--   20260709165000). Any two uppercase letters passed -- including non-ISO values
--   such as 'ZZ'/'XX' -- even though the application already restricts input to the
--   real ISO 3166-1 alpha-2 set (src/lib/geo/country-codes.ts ISO_COUNTRY_CODES /
--   isSupportedCountryCode, derived from country-flag-icons@1.6.17 => 249 codes).
--   profiles.nationality_country_code was ALREADY strict: 20260617195000 inlined
--   the same 249-code array, but kept its own private copy of the list.
--
-- WHAT
--   1. Add public.is_supported_country_code(text): an IMMUTABLE membership check
--      over the 249-code ISO alpha-2 set that the nationality constraint already
--      used, so app and DB share one enumerated source instead of two drifting
--      copies. (A Postgres CHECK cannot contain a subquery, so a static-array
--      IMMUTABLE function is the supported way to reuse one list across columns.)
--   2. Re-point profiles_phone_country_code_check at the function => phone codes are
--      now validated against the ISO set, not merely the [A-Z]{2} shape.
--   3. Re-point profiles_nationality_country_code_format at the same function =>
--      identical accepted set (verified 249 == 249, zero diff vs the old inline
--      array and vs the app list), now single-sourced. No nationality behavior change.
--
-- RPC / TRIGGER SCOPE (intentionally NOT touched here)
--   handle_new_user() and the complete_auth_gate() overloads normalize an
--   out-of-shape phone_country_code to NULL via `!~ '^[A-Z]{2}$'`; a non-ISO but
--   well-shaped value (e.g. 'ZZ') still passes their regex. That is acceptable
--   because this CHECK is now the authoritative backstop: such a value is rejected
--   at write time (fail-closed), and the app never emits non-ISO codes. We do NOT
--   re-create the 4-arg complete_auth_gate(text,text,text,boolean) base overload
--   here, to avoid regressing the trusted-consent-doc filter added by
--   20260710094000 (see MEMORY consent-gate-untrusted-doc-bounce). Tightening the
--   RPC/trigger regex to the full ISO set is deferred as a separate optional change.
--
-- DATA SAFETY / BACKFILL
--   Dev profiles (197 rows) already satisfy the ISO set: every non-null
--   nationality_country_code is a valid ISO code and every phone_country_code is
--   NULL, so no backfill is required and VALIDATE is safe. Constraints are added
--   NOT VALID and then VALIDATE'd, matching 20260709153000 / 20260709165000. If a
--   target environment still holds a legacy non-ISO value, VALIDATE will raise
--   (fail-closed) and the offending rows must be reconciled to a supported code (or
--   NULL) before re-applying; the NOT VALID constraint already blocks new bad
--   writes in the meantime.
--
--   The 249-code list reflects country-flag-icons@1.6.17 pinned behavior. If that
--   package is upgraded, re-diff ISO_COUNTRY_CODES against this array to keep the
--   app and DB accepted sets in sync.
--
-- Forward-only, idempotent. Remote apply is handled by the separate ops procedure
-- (not applied from v13).
-- ============================================================================

create or replace function public.is_supported_country_code(p_code text)
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select p_code = any (array[
    'AD'::text, 'AE'::text, 'AF'::text, 'AG'::text,
    'AI'::text, 'AL'::text, 'AM'::text, 'AO'::text,
    'AQ'::text, 'AR'::text, 'AS'::text, 'AT'::text,
    'AU'::text, 'AW'::text, 'AX'::text, 'AZ'::text,
    'BA'::text, 'BB'::text, 'BD'::text, 'BE'::text,
    'BF'::text, 'BG'::text, 'BH'::text, 'BI'::text,
    'BJ'::text, 'BL'::text, 'BM'::text, 'BN'::text,
    'BO'::text, 'BQ'::text, 'BR'::text, 'BS'::text,
    'BT'::text, 'BV'::text, 'BW'::text, 'BY'::text,
    'BZ'::text, 'CA'::text, 'CC'::text, 'CD'::text,
    'CF'::text, 'CG'::text, 'CH'::text, 'CI'::text,
    'CK'::text, 'CL'::text, 'CM'::text, 'CN'::text,
    'CO'::text, 'CR'::text, 'CU'::text, 'CV'::text,
    'CW'::text, 'CX'::text, 'CY'::text, 'CZ'::text,
    'DE'::text, 'DJ'::text, 'DK'::text, 'DM'::text,
    'DO'::text, 'DZ'::text, 'EC'::text, 'EE'::text,
    'EG'::text, 'EH'::text, 'ER'::text, 'ES'::text,
    'ET'::text, 'FI'::text, 'FJ'::text, 'FK'::text,
    'FM'::text, 'FO'::text, 'FR'::text, 'GA'::text,
    'GB'::text, 'GD'::text, 'GE'::text, 'GF'::text,
    'GG'::text, 'GH'::text, 'GI'::text, 'GL'::text,
    'GM'::text, 'GN'::text, 'GP'::text, 'GQ'::text,
    'GR'::text, 'GS'::text, 'GT'::text, 'GU'::text,
    'GW'::text, 'GY'::text, 'HK'::text, 'HM'::text,
    'HN'::text, 'HR'::text, 'HT'::text, 'HU'::text,
    'ID'::text, 'IE'::text, 'IL'::text, 'IM'::text,
    'IN'::text, 'IO'::text, 'IQ'::text, 'IR'::text,
    'IS'::text, 'IT'::text, 'JE'::text, 'JM'::text,
    'JO'::text, 'JP'::text, 'KE'::text, 'KG'::text,
    'KH'::text, 'KI'::text, 'KM'::text, 'KN'::text,
    'KP'::text, 'KR'::text, 'KW'::text, 'KY'::text,
    'KZ'::text, 'LA'::text, 'LB'::text, 'LC'::text,
    'LI'::text, 'LK'::text, 'LR'::text, 'LS'::text,
    'LT'::text, 'LU'::text, 'LV'::text, 'LY'::text,
    'MA'::text, 'MC'::text, 'MD'::text, 'ME'::text,
    'MF'::text, 'MG'::text, 'MH'::text, 'MK'::text,
    'ML'::text, 'MM'::text, 'MN'::text, 'MO'::text,
    'MP'::text, 'MQ'::text, 'MR'::text, 'MS'::text,
    'MT'::text, 'MU'::text, 'MV'::text, 'MW'::text,
    'MX'::text, 'MY'::text, 'MZ'::text, 'NA'::text,
    'NC'::text, 'NE'::text, 'NF'::text, 'NG'::text,
    'NI'::text, 'NL'::text, 'NO'::text, 'NP'::text,
    'NR'::text, 'NU'::text, 'NZ'::text, 'OM'::text,
    'PA'::text, 'PE'::text, 'PF'::text, 'PG'::text,
    'PH'::text, 'PK'::text, 'PL'::text, 'PM'::text,
    'PN'::text, 'PR'::text, 'PS'::text, 'PT'::text,
    'PW'::text, 'PY'::text, 'QA'::text, 'RE'::text,
    'RO'::text, 'RS'::text, 'RU'::text, 'RW'::text,
    'SA'::text, 'SB'::text, 'SC'::text, 'SD'::text,
    'SE'::text, 'SG'::text, 'SH'::text, 'SI'::text,
    'SJ'::text, 'SK'::text, 'SL'::text, 'SM'::text,
    'SN'::text, 'SO'::text, 'SR'::text, 'SS'::text,
    'ST'::text, 'SV'::text, 'SX'::text, 'SY'::text,
    'SZ'::text, 'TC'::text, 'TD'::text, 'TF'::text,
    'TG'::text, 'TH'::text, 'TJ'::text, 'TK'::text,
    'TL'::text, 'TM'::text, 'TN'::text, 'TO'::text,
    'TR'::text, 'TT'::text, 'TV'::text, 'TW'::text,
    'TZ'::text, 'UA'::text, 'UG'::text, 'UM'::text,
    'US'::text, 'UY'::text, 'UZ'::text, 'VA'::text,
    'VC'::text, 'VE'::text, 'VG'::text, 'VI'::text,
    'VN'::text, 'VU'::text, 'WF'::text, 'WS'::text,
    'YE'::text, 'YT'::text, 'ZA'::text, 'ZM'::text,
    'ZW'::text
  ])
$$;

comment on function public.is_supported_country_code(text) is
  'Returns true when the argument is a supported ISO 3166-1 alpha-2 country/region '
  'code. Static 249-code set mirroring src/lib/geo/country-codes.ts ISO_COUNTRY_CODES '
  '(country-flag-icons@1.6.17). IMMUTABLE so it can back CHECK constraints; keep in '
  'sync with the app list on any country-flag-icons upgrade.';

-- phone_country_code: tighten from the [A-Z]{2} shape check to the ISO set.
alter table public.profiles
  drop constraint if exists profiles_phone_country_code_check;

alter table public.profiles
  add constraint profiles_phone_country_code_check
  check (
    phone_country_code is null
    or public.is_supported_country_code(phone_country_code)
  ) not valid;

alter table public.profiles
  validate constraint profiles_phone_country_code_check;

-- nationality_country_code: same accepted set as before (20260617195000), now
-- single-sourced through the function instead of a private inline array copy.
alter table public.profiles
  drop constraint if exists profiles_nationality_country_code_format;

alter table public.profiles
  add constraint profiles_nationality_country_code_format
  check (
    nationality_country_code is null
    or public.is_supported_country_code(nationality_country_code)
  ) not valid;

alter table public.profiles
  validate constraint profiles_nationality_country_code_format;
