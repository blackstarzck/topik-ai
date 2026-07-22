import {
  createHash,
  createHmac,
  timingSafeEqual
} from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

declare const process: {
  env: Record<string, string | undefined>;
};

export const maxDuration = 10;

const MAX_BODY_BYTES = 32 * 1024;
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;
const TOPIK_PROD_PROJECT_REF = 'eymlabowhfgtxbiqwxqh';
const TOPIK_DEV_PROJECT_REF = 'fglggyfvzjdsbyckinqa';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ERROR_CODE_PATTERN = /^[A-Z0-9_]{1,64}$/;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;

type BackupComponentReport = {
  status: 'succeeded' | 'failed' | 'not_run';
  size_bytes: number;
  validation_status: 'passed' | 'failed' | 'not_run';
  error_code?: string;
  object_count?: number;
};

export type NormalizedBackupReport = Record<string, unknown> & {
  report_type: 'backup_started' | 'backup_completed' | 'restore_drill_completed';
  report_id: string;
  source_project: 'topik-prod';
};

type ParsedReport = {
  report: NormalizedBackupReport;
  payloadHash: string;
};

export type BackupReportDestination = 'primary' | 'mirror';

type MonitoringTarget = {
  secret?: string;
  supabaseUrl?: string;
  serviceRoleKey?: string;
  projectRef?: string;
  expectedProjectRef?: string;
};

type ReportRecorder = (
  report: NormalizedBackupReport,
  payloadHash: string
) => Promise<'accepted' | 'duplicate'>;

class RequestFailure extends Error {
  constructor(
    readonly code: string,
    readonly status: number
  ) {
    super(code);
  }
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, init);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[]
): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(value).some((key) => !allowedSet.has(key))) {
    throw new RequestFailure('unexpected_field', 400);
  }
  if (required.some((key) => !(key in value))) {
    throw new RequestFailure('missing_field', 400);
  }
}

function requireString(value: unknown, code = 'invalid_field'): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new RequestFailure(code, 400);
  }
  return value;
}

function requireUuid(value: unknown): string {
  const text = requireString(value);
  if (!UUID_PATTERN.test(text)) {
    throw new RequestFailure('invalid_identifier', 400);
  }
  return text.toLowerCase();
}

function requireIsoTimestamp(value: unknown): string {
  const text = requireString(value);
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(text)) {
    throw new RequestFailure('invalid_timestamp', 400);
  }
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) {
    throw new RequestFailure('invalid_timestamp', 400);
  }
  return new Date(timestamp).toISOString();
}

function requireNonNegativeInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new RequestFailure('invalid_number', 400);
  }
  return value as number;
}

function requireDiskPercent(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new RequestFailure('invalid_disk_usage', 400);
  }
  return Math.round(value * 100) / 100;
}

function optionalErrorCode(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const code = requireString(value);
  if (!ERROR_CODE_PATTERN.test(code)) {
    throw new RequestFailure('invalid_error_code', 400);
  }
  return code;
}

function requireTimeOrder(startedAt: string, completedAt: string): void {
  if (Date.parse(completedAt) < Date.parse(startedAt)) {
    throw new RequestFailure('invalid_time_order', 400);
  }
}

function parseComponent(
  value: unknown,
  target: 'database' | 'storage'
): BackupComponentReport {
  if (!isObject(value)) {
    throw new RequestFailure('invalid_component', 400);
  }
  const allowed = target === 'storage'
    ? ['status', 'size_bytes', 'object_count', 'validation_status', 'error_code']
    : ['status', 'size_bytes', 'validation_status', 'error_code'];
  const required = target === 'storage'
    ? ['status', 'size_bytes', 'object_count', 'validation_status']
    : ['status', 'size_bytes', 'validation_status'];
  assertExactKeys(value, allowed, required);

  const status = requireString(value.status);
  if (!['succeeded', 'failed', 'not_run'].includes(status)) {
    throw new RequestFailure('invalid_component_status', 400);
  }
  const validationStatus = requireString(value.validation_status);
  if (!['passed', 'failed', 'not_run'].includes(validationStatus)) {
    throw new RequestFailure('invalid_validation_status', 400);
  }
  if (status === 'succeeded' && validationStatus !== 'passed') {
    throw new RequestFailure('inconsistent_component_result', 400);
  }
  if (status === 'not_run' && validationStatus !== 'not_run') {
    throw new RequestFailure('inconsistent_component_result', 400);
  }
  if (status === 'failed' && validationStatus !== 'failed') {
    throw new RequestFailure('inconsistent_component_result', 400);
  }

  const report: BackupComponentReport = {
    status: status as BackupComponentReport['status'],
    size_bytes: requireNonNegativeInteger(value.size_bytes),
    validation_status: validationStatus as BackupComponentReport['validation_status']
  };
  const errorCode = optionalErrorCode(value.error_code);
  if (status === 'succeeded' && errorCode) {
    throw new RequestFailure('inconsistent_component_result', 400);
  }
  if (status !== 'succeeded' && !errorCode) {
    throw new RequestFailure('missing_error_code', 400);
  }
  if (errorCode) report.error_code = errorCode;
  if (target === 'storage') {
    report.object_count = requireNonNegativeInteger(value.object_count);
  }
  return report;
}

function validateOverallStatus(
  status: string,
  database: BackupComponentReport,
  storage: BackupComponentReport
): void {
  const succeeded = [database, storage].filter((item) => item.status === 'succeeded').length;
  const notRun = [database, storage].filter((item) => item.status === 'not_run').length;
  const expected = succeeded === 2
    ? 'succeeded'
    : notRun === 2
      ? 'delayed'
      : succeeded === 1
        ? 'partial_failure'
        : 'failed';
  if (status !== expected) {
    throw new RequestFailure('inconsistent_overall_status', 400);
  }
}

function parseBackupStarted(value: Record<string, unknown>): NormalizedBackupReport {
  assertExactKeys(
    value,
    [
      'report_type',
      'report_id',
      'run_id',
      'source_project',
      'started_at',
      'next_scheduled_at',
      'disk_used_percent'
    ],
    ['report_type', 'report_id', 'run_id', 'source_project', 'started_at', 'next_scheduled_at']
  );
  const report: NormalizedBackupReport = {
    report_type: 'backup_started',
    report_id: requireUuid(value.report_id),
    run_id: requireUuid(value.run_id),
    source_project: 'topik-prod',
    started_at: requireIsoTimestamp(value.started_at),
    next_scheduled_at: requireIsoTimestamp(value.next_scheduled_at)
  };
  if (value.disk_used_percent !== undefined) {
    report.disk_used_percent = requireDiskPercent(value.disk_used_percent);
  }
  return report;
}

function parseBackupCompleted(value: Record<string, unknown>): NormalizedBackupReport {
  assertExactKeys(
    value,
    [
      'report_type',
      'report_id',
      'run_id',
      'source_project',
      'started_at',
      'completed_at',
      'next_scheduled_at',
      'status',
      'database',
      'storage',
      'disk_used_percent',
      'error_code'
    ],
    [
      'report_type',
      'report_id',
      'run_id',
      'source_project',
      'started_at',
      'completed_at',
      'next_scheduled_at',
      'status',
      'database',
      'storage',
      'disk_used_percent'
    ]
  );
  const startedAt = requireIsoTimestamp(value.started_at);
  const completedAt = requireIsoTimestamp(value.completed_at);
  requireTimeOrder(startedAt, completedAt);
  const database = parseComponent(value.database, 'database');
  const storage = parseComponent(value.storage, 'storage');
  const status = requireString(value.status);
  validateOverallStatus(status, database, storage);

  const report: NormalizedBackupReport = {
    report_type: 'backup_completed',
    report_id: requireUuid(value.report_id),
    run_id: requireUuid(value.run_id),
    source_project: 'topik-prod',
    started_at: startedAt,
    completed_at: completedAt,
    next_scheduled_at: requireIsoTimestamp(value.next_scheduled_at),
    status,
    database,
    storage,
    disk_used_percent: requireDiskPercent(value.disk_used_percent)
  };
  const errorCode = optionalErrorCode(value.error_code);
  if ((status === 'succeeded' && errorCode) || (status !== 'succeeded' && !errorCode)) {
    throw new RequestFailure('inconsistent_error_code', 400);
  }
  if (errorCode) report.error_code = errorCode;
  return report;
}

function parseRestoreDrill(value: Record<string, unknown>): NormalizedBackupReport {
  assertExactKeys(
    value,
    [
      'report_type',
      'report_id',
      'drill_id',
      'source_run_id',
      'source_project',
      'started_at',
      'completed_at',
      'status',
      'database_validation_status',
      'storage_validation_status',
      'error_code'
    ],
    [
      'report_type',
      'report_id',
      'drill_id',
      'source_project',
      'started_at',
      'completed_at',
      'status',
      'database_validation_status',
      'storage_validation_status'
    ]
  );
  const startedAt = requireIsoTimestamp(value.started_at);
  const completedAt = requireIsoTimestamp(value.completed_at);
  requireTimeOrder(startedAt, completedAt);
  const status = requireString(value.status);
  const databaseValidation = requireString(value.database_validation_status);
  const storageValidation = requireString(value.storage_validation_status);
  if (!['succeeded', 'failed'].includes(status)) {
    throw new RequestFailure('invalid_restore_status', 400);
  }
  if (!['passed', 'failed'].includes(databaseValidation) || !['passed', 'failed'].includes(storageValidation)) {
    throw new RequestFailure('invalid_validation_status', 400);
  }
  const expected = databaseValidation === 'passed' && storageValidation === 'passed'
    ? 'succeeded'
    : 'failed';
  if (status !== expected) {
    throw new RequestFailure('inconsistent_restore_status', 400);
  }

  const report: NormalizedBackupReport = {
    report_type: 'restore_drill_completed',
    report_id: requireUuid(value.report_id),
    drill_id: requireUuid(value.drill_id),
    source_project: 'topik-prod',
    started_at: startedAt,
    completed_at: completedAt,
    status,
    database_validation_status: databaseValidation,
    storage_validation_status: storageValidation
  };
  if (value.source_run_id !== undefined) {
    report.source_run_id = requireUuid(value.source_run_id);
  }
  const errorCode = optionalErrorCode(value.error_code);
  if ((status === 'succeeded' && errorCode) || (status === 'failed' && !errorCode)) {
    throw new RequestFailure('inconsistent_error_code', 400);
  }
  if (errorCode) report.error_code = errorCode;
  return report;
}

export function normalizeBackupReport(value: unknown): NormalizedBackupReport {
  if (!isObject(value)) {
    throw new RequestFailure('invalid_body', 400);
  }
  if (value.source_project !== 'topik-prod') {
    throw new RequestFailure('invalid_source_project', 400);
  }
  if (value.report_type === 'backup_started') return parseBackupStarted(value);
  if (value.report_type === 'backup_completed') return parseBackupCompleted(value);
  if (value.report_type === 'restore_drill_completed') return parseRestoreDrill(value);
  throw new RequestFailure('invalid_report_type', 400);
}

function verifySignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  secret: string,
  destination: BackupReportDestination
): void {
  const timestampSeconds = Number(timestamp);
  if (!Number.isInteger(timestampSeconds)) {
    throw new RequestFailure('invalid_timestamp_header', 401);
  }
  const currentSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(currentSeconds - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) {
    throw new RequestFailure('stale_request', 401);
  }

  const normalizedSignature = signature.startsWith('sha256=')
    ? signature.slice('sha256='.length)
    : signature;
  if (!SIGNATURE_PATTERN.test(normalizedSignature)) {
    throw new RequestFailure('invalid_signature', 401);
  }
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${destination}.${rawBody}`)
    .digest();
  const received = Buffer.from(normalizedSignature, 'hex');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new RequestFailure('invalid_signature', 401);
  }
}

export async function authenticateAndParseBackupReport(
  request: Request,
  secret: string,
  destination: BackupReportDestination
): Promise<ParsedReport> {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new RequestFailure('request_too_large', 413);
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    throw new RequestFailure('request_too_large', 413);
  }
  const timestamp = request.headers.get('x-backup-timestamp') ?? '';
  const signature = request.headers.get('x-backup-signature') ?? '';
  verifySignature(rawBody, timestamp, signature, secret, destination);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new RequestFailure('invalid_json', 400);
  }
  return {
    report: normalizeBackupReport(parsed),
    payloadHash: createHash('sha256').update(rawBody).digest('hex')
  };
}

export async function handleBackupReport(
  request: Request,
  secret: string,
  recorder: ReportRecorder,
  destination: BackupReportDestination
): Promise<Response> {
  try {
    const { report, payloadHash } = await authenticateAndParseBackupReport(
      request,
      secret,
      destination
    );
    const result = await recorder(report, payloadHash);
    // 운영 보고가 실패를 담고 있으면 즉시 이메일 경보를 보낸다. 미러 보고와
    // 중복 재전송은 제외하고, 발송 실패가 보고 수신 자체를 실패시키지 않는다.
    if (result === 'accepted' && destination === 'primary') {
      await sendBackupAlertEmail(report).catch((alertError) => {
        console.error('[backup-report] alert email failed', alertError);
      });
    }
    return jsonResponse({ ok: true, result }, { status: result === 'duplicate' ? 200 : 202 });
  } catch (error) {
    if (error instanceof RequestFailure) {
      return jsonResponse({ ok: false, error: error.code }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : '';
    const isConflict = /conflicting|immutable|start report required/i.test(message);
    return jsonResponse(
      { ok: false, error: isConflict ? 'report_conflict' : 'report_store_failed' },
      { status: isConflict ? 409 : 500 }
    );
  }
}

function resolveMonitoringTarget(destination: BackupReportDestination): MonitoringTarget {
  if (destination === 'mirror') {
    return {
      secret: process.env.BACKUP_MIRROR_REPORT_SECRET,
      supabaseUrl: process.env.BACKUP_MIRROR_SUPABASE_URL,
      serviceRoleKey: process.env.BACKUP_MIRROR_SUPABASE_SERVICE_ROLE_KEY,
      projectRef: process.env.BACKUP_MIRROR_SUPABASE_PROJECT_REF,
      expectedProjectRef: process.env.BACKUP_MIRROR_SUPABASE_EXPECTED_PROJECT_REF
    };
  }
  return {
    secret: process.env.BACKUP_REPORT_SECRET,
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY,
    projectRef: process.env.SUPABASE_PROJECT_REF,
    expectedProjectRef: process.env.SUPABASE_EXPECTED_PROJECT_REF
  };
}

export function isValidMonitoringTarget(
  supabaseUrl: string,
  projectRef: string,
  expectedProjectRef: string,
  destination: BackupReportDestination
): boolean {
  const requiredProjectRef = destination === 'primary'
    ? TOPIK_PROD_PROJECT_REF
    : TOPIK_DEV_PROJECT_REF;
  if (projectRef !== requiredProjectRef || expectedProjectRef !== requiredProjectRef) {
    return false;
  }
  try {
    return new URL(supabaseUrl).hostname === `${requiredProjectRef}.supabase.co`;
  } catch {
    return false;
  }
}

export type BackupAlert = {
  subject: string;
  lines: string[];
};

// 어떤 보고가 즉시 경보 대상인지 결정하는 순수 함수. 실패한 백업/드릴과
// 디스크 위험(>=90%)만 경보하고, 정상 보고와 시작 보고는 조용히 지나간다.
export function resolveBackupAlert(report: NormalizedBackupReport): BackupAlert | null {
  const type = report.report_type;
  const status = typeof report.status === 'string' ? report.status : '';
  const disk = typeof report.disk_used_percent === 'number' ? report.disk_used_percent : null;
  const errorCode = typeof report.error_code === 'string' ? report.error_code : null;
  const reasons: string[] = [];

  if (type === 'backup_completed' && (status === 'failed' || status === 'partial_failure')) {
    reasons.push(`백업 ${status === 'failed' ? '실패' : '부분 실패'} — run ${String(report.run_id ?? '')}`);
  }
  if (type === 'restore_drill_completed' && status === 'failed') {
    reasons.push(`복원 점검(드릴) 실패 — drill ${String(report.drill_id ?? '')}`);
  }
  if (disk !== null && disk >= 90) {
    reasons.push(`백업 서버 디스크 사용률 위험: ${disk}%`);
  }
  if (reasons.length === 0) return null;

  const lines = [...reasons];
  if (errorCode) lines.push(`오류 코드: ${errorCode}`);
  if (typeof report.completed_at === 'string') lines.push(`완료 시각(UTC): ${report.completed_at}`);
  lines.push('상세: 관리자 화면 시스템 > 백업 관리에서 확인하세요.');
  return { subject: `[topik-prod 백업 경보] ${reasons[0]}`, lines };
}

async function sendBackupAlertEmail(report: NormalizedBackupReport): Promise<void> {
  const alert = resolveBackupAlert(report);
  if (!alert) return;
  const recipients = (process.env.BACKUP_ALERT_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (recipients.length === 0 || !smtpHost || !smtpUser || !smtpPass) {
    console.warn('[backup-report] alert skipped: BACKUP_ALERT_EMAILS/SMTP env missing');
    return;
  }
  const smtpPort = Number(process.env.SMTP_PORT ?? 465);
  // 경보 발송이 보고 응답(maxDuration 10s)을 넘기지 않도록 짧게 제한한다.
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? smtpUser,
    to: recipients.join(', '),
    subject: alert.subject,
    text: alert.lines.join('\n')
  });
}

function parseDestination(request: Request): BackupReportDestination | null {
  const destination = request.headers.get('x-backup-destination');
  return destination === 'primary' || destination === 'mirror' ? destination : null;
}

export function POST(request: Request): Promise<Response> | Response {
  const destination = parseDestination(request);
  if (!destination) {
    return jsonResponse({ ok: false, error: 'invalid_destination' }, { status: 400 });
  }
  const {
    secret,
    supabaseUrl,
    serviceRoleKey,
    projectRef,
    expectedProjectRef
  } = resolveMonitoringTarget(destination);
  if (
    !secret ||
    !supabaseUrl ||
    !serviceRoleKey ||
    !projectRef ||
    !expectedProjectRef ||
    !isValidMonitoringTarget(supabaseUrl, projectRef, expectedProjectRef, destination)
  ) {
    return jsonResponse({ ok: false, error: 'server_misconfigured' }, { status: 500 });
  }
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
  return handleBackupReport(request, secret, async (report, payloadHash) => {
    const { data, error } = await client.rpc('record_admin_backup_report', {
      p_report: report,
      p_payload_hash: payloadHash
    });
    if (error) throw new Error(error.message);
    return data === 'duplicate' ? 'duplicate' : 'accepted';
  }, destination);
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return jsonResponse(
        { ok: false, error: 'method_not_allowed' },
        { status: 405, headers: { Allow: 'POST' } }
      );
    }
    return POST(request);
  }
};
