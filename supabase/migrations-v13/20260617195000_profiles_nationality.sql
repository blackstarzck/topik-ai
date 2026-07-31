-- =====================================================================
-- TALKPIK AI - 2026-06-17 - profiles.nationality_country_code
--
-- Adds nullable country/region profile metadata captured during sign-up.
-- Existing users remain valid; handle_new_user seeds from Auth metadata.
-- =====================================================================

alter table public.profiles
  add column if not exists nationality_country_code text;

alter table public.profiles
  drop constraint if exists profiles_nationality_country_code_format;

alter table public.profiles
  add constraint profiles_nationality_country_code_format
  check (
    nationality_country_code is null
    or (
      nationality_country_code ~ '^[A-Z]{2}$'
      and nationality_country_code = any (array[
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
    )
  );

comment on column public.profiles.nationality_country_code is
  'User-provided ISO 3166-1 alpha-2 country/region code captured during sign-up. Nullable for existing users.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, display_name, nationality_country_code)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
    upper(nullif(btrim(new.raw_user_meta_data->>'nationality_country_code'), ''))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

comment on function public.handle_new_user() is
  'After insert on auth.users, create matching public.profiles row idempotently '
  'and seed display_name/nationality_country_code from raw_user_meta_data. '
  'SECURITY DEFINER with locked search_path. Sign-up country code 2026-06-17.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
