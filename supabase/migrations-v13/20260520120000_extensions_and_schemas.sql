-- =====================================================================
-- TALKPIK AI · Tier 1 MVP
-- 01/12 · extensions + private schema
-- Spec: docs/development/database-schema.md
-- =====================================================================

-- gen_random_uuid()
create extension if not exists pgcrypto;

-- profiles.nickname citext
create extension if not exists citext;

-- private schema for SECURITY DEFINER helpers (e.g. is_admin)
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
