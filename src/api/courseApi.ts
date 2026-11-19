import type {
  CourseRecord,
  CourseSavePayload,
  Instructor,
  SubmitReviewResult,
  ValidationIssue,
} from '../types/domain.ts';
import { C_NEW_ID, readCourse as readMockCourse, resetCourseDb } from '../mocks/courses.ts';
import { INSTRUCTORS } from '../mocks/instructors.ts';
import { sanitizeForStorage } from '../domain/richtext.ts';

/**
 * 接口层。USE_MOCK = true 时不发任何网络请求，读写都落在 localStorage 的 mock 库上，
 * 这样"保存 → 刷新页面 → 顺序仍然正确"可以被真实复现（刷新不会丢数据）。
 * 对接真实后端时把 USE_MOCK 改成 false，并在下方标注的对接点替换实现即可。
 */
export const USE_MOCK = true;

const DB_KEY = 'academy.course.db.v1';
const LOG_KEY = 'academy.api.log.v1';
const DEFAULT_LATENCY_MS = 30;

/**
 * mock 接口的模拟网络延迟。默认 30ms 贴近真实接口手感；
 * 测试里由 tests/setup.ts 调用 setMockLatency(0) 归零，
 * 避免断言依赖固定次数的 setTimeout(0) 轮询 —— 那种写法在慢机器/慢 CI 上会读到中间态而随机失败。
 */
let latencyMs = DEFAULT_LATENCY_MS;

export function setMockLatency(ms: number): void {
  latencyMs = Math.max(0, Math.floor(ms));
}

export function getMockLatency(): number {
  return latencyMs;
}

/** 一次接口调用的取证记录，截图与单测都读它 */
export interface ApiLogEntry {
  at: string;
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  status: number;
  body: unknown;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readDb(): Record<string, CourseRecord> {
  if (typeof localStorage === 'undefined') return {};
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, CourseRecord>;
    return {};
  } catch {
    // 本地 mock 库被外部改坏时按空库处理，由上层回落种子数据
    return {};
  }
}

function writeDb(db: Record<string, CourseRecord>): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function appendLog(entry: ApiLogEntry): void {
  if (typeof localStorage === 'undefined') return;
  const raw = localStorage.getItem(LOG_KEY);
  const list: ApiLogEntry[] = raw ? (JSON.parse(raw) as ApiLogEntry[]) : [];
  list.push(entry);
  localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(-20)));
}

export function readApiLog(): ApiLogEntry[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(LOG_KEY);
  return raw ? (JSON.parse(raw) as ApiLogEntry[]) : [];
}

export function clearApiLog(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(LOG_KEY);
}

/** 用种子数据重建本地 mock 库（截图脚本与测试复位用） */
export function seedMockDb(): void {
  resetCourseDb();
  const seedIds = ['crs_2058_draft', 'crs_2058_published', 'crs_2058_new'];
  const db: Record<string, CourseRecord> = {};
  for (const id of seedIds) {
    const record = readMockCourse(id);
    if (record) db[id] = record;
  }
  writeDb(db);
}

/**
 * GET /academy/courses/:id
 * 对接点：替换为 fetch('/api/academy/courses/' + id)。
 */
export async function fetchCourse(id: string): Promise<CourseRecord> {
  await sleep(latencyMs);
  const db = readDb();
  const record = db[id] ?? readMockCourse(id);
  appendLog({ at: new Date().toISOString(), method: 'GET', path: '/academy/courses/' + id, status: record ? 200 : 404, body: null });
  if (!record) throw new Error('course not found: ' + id);
  return record;
}

/**
 * PUT /academy/courses/:id/draft
 * 保存草稿：把提交体写回本地 mock 库，返回落库后的记录。
 * 对接点：替换为 fetch(..., { method: 'PUT', body: JSON.stringify(payload) })。
 */
export async function saveDraft(payload: CourseSavePayload): Promise<CourseRecord> {
  await sleep(latencyMs);
  const db = readDb();
  const previous = db[payload.id] ?? readMockCourse(payload.id);
  const saved: CourseRecord = {
    id: payload.id,
    status: previous?.status ?? 'draft',
    title: payload.title,
    subtitle: payload.subtitle,
    categoryId: payload.categoryId,
    deliveryMode: payload.deliveryMode,
    visibility: payload.visibility,
    benefitMode: payload.benefitMode,
    coverUrl: payload.coverUrl,
    coverName: previous?.coverName ?? '',
    // 入库不变式：所有写入 mock 库的富文本先过白名单清洗（存储型 XSS 防护）
    introHtml: sanitizeForStorage(payload.introHtml),
    outline: payload.outline.map((item) => ({ id: item.id, title: item.title, durationMinutes: item.durationMinutes })),
    outcomes: payload.outcomes,
    instructors: payload.instructors.map((item) => ({ instructorId: item.instructorId, role: item.role, order: item.order })),
    tags: payload.tags,
    updatedAt: new Date().toISOString(),
  };
  db[payload.id] = saved;
  writeDb(db);
  appendLog({ at: new Date().toISOString(), method: 'PUT', path: '/academy/courses/' + payload.id + '/draft', status: 200, body: payload });
  return structuredClone(saved);
}

/**
 * POST /academy/courses/:id/submit-review
 * 提交审核：后端先跑一遍服务端校验，把缺失项列表原样返回给前端展示。
 * 对接点：替换为 fetch(..., { method: 'POST' })。
 */
export async function submitReview(
  payload: CourseSavePayload,
  serverMissing: ValidationIssue[],
): Promise<SubmitReviewResult> {
  await sleep(latencyMs);
  const hasProblem = serverMissing.length > 0;
  const result: SubmitReviewResult = hasProblem
    ? { ok: false, missing: serverMissing }
    : { ok: true, reviewId: 'rev_' + String(Date.now()).slice(-8), missing: [] };
  appendLog({
    at: new Date().toISOString(),
    method: 'POST',
    path: '/academy/courses/' + payload.id + '/submit-review',
    status: hasProblem ? 422 : 200,
    body: { request: payload, response: result },
  });
  return result;
}

/**
 * GET /academy/instructors?keyword=
 * 讲师库搜索。已停用账号仍会返回，但带 status='disabled'，由前端置灰不可选。
 * 对接点：替换为 fetch('/api/academy/instructors?keyword=' + encodeURIComponent(keyword))。
 */
export async function searchInstructors(keyword: string): Promise<Instructor[]> {
  await sleep(latencyMs);
  const normalized = keyword.trim();
  const list = normalized.length === 0
    ? INSTRUCTORS
    : INSTRUCTORS.filter((item) =>
        item.name.includes(normalized) || item.title.includes(normalized) || item.org.includes(normalized),
      );
  appendLog({
    at: new Date().toISOString(),
    method: 'GET',
    path: '/academy/instructors?keyword=' + encodeURIComponent(normalized),
    status: 200,
    body: { count: list.length },
  });
  return list.map((item) => ({ ...item }));
}

/** 新建课程时的空记录 id；真正的 id 由后端签发，mock 下固定 */
export function newCourseId(): string {
  return C_NEW_ID;
}
