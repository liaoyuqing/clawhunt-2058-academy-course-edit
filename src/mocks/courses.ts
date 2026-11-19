import type { CourseRecord, Instructor } from '../types/domain.ts';
import { COVER_DATA_URL } from './cover.ts';
import { INSTRUCTORS } from './instructors.ts';

/**
 * 课程 mock：覆盖三种进入方式
 * - C_DRAFT_ID：草稿，带完整数据，用于拖拽排序与保存演示
 * - C_PUBLISHED_ID：已发布，用于验证全字段只读
 * - C_NEW_ID：新建，所有字段为空
 * 数据全部虚构。
 */
export const C_DRAFT_ID = 'crs_2058_draft';
export const C_PUBLISHED_ID = 'crs_2058_published';
export const C_NEW_ID = 'crs_2058_new';

const DRAFT: CourseRecord = {
  id: C_DRAFT_ID,
  status: 'draft',
  title: '会员增长实战：从拉新到留存的六个动作',
  subtitle: '用一套可复用的增长模型，把流量变成长期会员',
  categoryId: 'cat_growth',
  deliveryMode: 'hybrid',
  visibility: 'members',
  benefitMode: 'included',
  coverUrl: COVER_DATA_URL,
  coverName: 'growth-cover-16x9.png',
  introHtml:
    '<p>这门课程把会员增长拆成<strong>拉新、激活、留存、复购、推荐、召回</strong>六个动作，每个动作都配一套可以直接套用的模板。</p>' +
    '<ul><li>第一周：找到你的增长杠杆</li><li>第二周：用实验验证假设</li><li>第三周：把有效动作沉淀成流程</li></ul>' +
    '<p>课程配套 12 份可编辑的工具表，学完即可在自己团队落地。</p>',
  outline: [
    { id: 'ol_1', title: '开营：增长模型的六个动作', durationMinutes: 18 },
    { id: 'ol_2', title: '拉新：渠道选择与成本核算', durationMinutes: 35 },
    { id: 'ol_3', title: '激活：首周体验设计', durationMinutes: 42 },
    { id: 'ol_4', title: '留存：分层运营与触达节奏', durationMinutes: 50 },
    { id: 'ol_5', title: '复购与推荐：会员权益设计', durationMinutes: 28 },
  ],
  outcomes: [
    '搭出一张适合自己业务的增长模型图',
    '用实验数据判断渠道是否值得继续投入',
    '设计一套首周激活的会员体验路径',
    '把留存分层落到具体的触达节奏上',
  ],
  instructors: [
    { instructorId: 'ins_9001', role: 'main', order: 0 },
    { instructorId: 'ins_9003', role: 'assistant', order: 1 },
  ],
  tags: [
    { dimension: 'track', value: 'track_saas' },
    { dimension: 'track', value: 'track_content' },
    { dimension: 'topic', value: 'topic_growth' },
    { dimension: 'topic', value: 'topic_retention' },
  ],
  updatedAt: '2026-11-10T09:30:00+08:00',
};

const PUBLISHED: CourseRecord = {
  ...DRAFT,
  id: C_PUBLISHED_ID,
  status: 'published',
  title: '会员增长实战（已发布版本）',
  updatedAt: '2026-10-28T16:05:00+08:00',
};

const NEW_COURSE: CourseRecord = {
  id: C_NEW_ID,
  status: 'draft',
  title: '',
  subtitle: '',
  categoryId: '',
  deliveryMode: '',
  visibility: '',
  benefitMode: '',
  coverUrl: '',
  coverName: '',
  introHtml: '',
  outline: [],
  outcomes: [],
  instructors: [],
  tags: [],
  updatedAt: '',
};

/** 课程库（mock 存储），保存草稿会写回这里，模拟"重新加载后顺序正确" */
const COURSE_DB: Map<string, CourseRecord> = new Map<string, CourseRecord>([
  [DRAFT.id, DRAFT],
  [PUBLISHED.id, PUBLISHED],
  [NEW_COURSE.id, NEW_COURSE],
]);

export function readCourse(id: string): CourseRecord | undefined {
  const found = COURSE_DB.get(id);
  return found ? structuredClone(found) : undefined;
}

export function writeCourse(record: CourseRecord): CourseRecord {
  const saved = structuredClone(record);
  COURSE_DB.set(saved.id, saved);
  return structuredClone(saved);
}

/** 供测试与截图脚本复位 mock 存储 */
export function resetCourseDb(): void {
  COURSE_DB.set(DRAFT.id, structuredClone(DRAFT));
  COURSE_DB.set(PUBLISHED.id, structuredClone(PUBLISHED));
  COURSE_DB.set(NEW_COURSE.id, structuredClone(NEW_COURSE));
}

export function instructorName(id: string): string {
  const hit: Instructor | undefined = INSTRUCTORS.find((item) => item.id === id);
  return hit ? hit.name : id;
}