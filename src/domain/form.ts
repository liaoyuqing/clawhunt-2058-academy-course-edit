import type {
  CourseFormState,
  CourseRecord,
  CourseSavePayload,
  OutlineItem,
  SectionKey,
} from '../types/domain.ts';

/** 六个分区的稳定顺序，页面锚点、截图、校验报告都按这个顺序输出 */
export const SECTION_ORDER: SectionKey[] = ['basic', 'intro', 'outline', 'outcomes', 'instructors', 'tags'];

export const SECTION_LABEL: Record<SectionKey, string> = {
  basic: '基本信息',
  intro: '课程介绍',
  outline: '课程大纲',
  outcomes: '学习收获',
  instructors: '讲师',
  tags: '标签',
};

export const LIMITS = {
  /** 标题字数上限 */
  title: 40,
  /** 富文本正文字数上限（纯文本计） */
  intro: 5000,
  /** 学习收获条数上限 */
  outcomes: 8,
  /** 单个标签维度可选数量上限 */
  tagsPerDimension: 3,
  /** 封面上限 5MB */
  coverBytes: 5 * 1024 * 1024,
  /** 封面临界宽高比 16:9 */
  coverAspect: 16 / 9,
} as const;

/** 富文本 HTML → 纯文本，用于字数统计（避免把标签算进 5000 字） */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** 从课程记录派生表单初值；缺字段时补空值，保证受控组件不出现 undefined */
export function toFormState(record: CourseRecord): CourseFormState {
  return {
    id: record.id,
    status: record.status,
    title: record.title,
    subtitle: record.subtitle,
    categoryId: record.categoryId,
    deliveryMode: record.deliveryMode,
    visibility: record.visibility,
    benefitMode: record.benefitMode,
    coverUrl: record.coverUrl,
    coverName: record.coverName,
    introHtml: record.introHtml,
    outline: record.outline.map((item) => ({ ...item })),
    outcomes: [...record.outcomes],
    instructors: record.instructors.map((item, index) => ({ ...item, order: index })),
    tags: record.tags.map((item) => ({ ...item })),
  };
}

/** 表单状态 → 保存请求体，大纲顺序由数组下标写入 order */
export function toSavePayload(state: CourseFormState): CourseSavePayload {
  return {
    id: state.id,
    title: state.title,
    subtitle: state.subtitle,
    categoryId: state.categoryId,
    deliveryMode: state.deliveryMode,
    visibility: state.visibility,
    benefitMode: state.benefitMode,
    coverUrl: state.coverUrl,
    dropExternalStylesOnPaste: true,
    introHtml: state.introHtml,
    introTextLength: htmlToText(state.introHtml).length,
    outline: state.outline.map((item, index) => ({
      id: item.id,
      title: item.title,
      durationMinutes: item.durationMinutes,
      order: index,
    })),
    outcomes: [...state.outcomes],
    instructors: state.instructors.map((item, index) => ({
      instructorId: item.instructorId,
      role: item.role,
      order: index,
    })),
    tags: state.tags.map((item) => ({ ...item })),
  };
}

/**
 * 脏检查：只比较会影响保存结果的字段（updatedAt 之类不参与）。
 * 大纲、学习收获、讲师、标签按"有效内容"比较，忽略仅顺序以外的临时字段。
 */
export function isDirty(a: CourseFormState, b: CourseFormState): boolean {
  return JSON.stringify(dirtySnapshot(a)) !== JSON.stringify(dirtySnapshot(b));
}

function dirtySnapshot(state: CourseFormState): unknown {
  const payload = toSavePayload(state);
  return {
    id: payload.id,
    title: payload.title,
    subtitle: payload.subtitle,
    categoryId: payload.categoryId,
    deliveryMode: payload.deliveryMode,
    visibility: payload.visibility,
    benefitMode: payload.benefitMode,
    coverUrl: payload.coverUrl,
    introHtml: payload.introHtml,
    outline: payload.outline,
    outcomes: payload.outcomes,
    instructors: payload.instructors,
    tags: payload.tags,
  };
}

/** 生成稳定的条目 id，新建大纲行/学习收获时使用 */
export function makeId(prefix: string, seed: number): string {
  return prefix + '_' + String(seed).padStart(2, '0');
}

/** 总时长（分钟），用于预览卡与大纲页脚 */
export function totalDuration(outline: OutlineItem[]): number {
  return outline.reduce((sum, item) => sum + (Number.isFinite(item.durationMinutes) ? item.durationMinutes : 0), 0);
}

/** 分钟 → "1 小时 20 分钟" */
export function humanDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 分钟';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return m + ' 分钟';
  if (m === 0) return h + ' 小时';
  return h + ' 小时 ' + m + ' 分钟';
}
