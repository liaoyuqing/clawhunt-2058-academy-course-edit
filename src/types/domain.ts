/**
 * 课程编辑页的领域类型。所有字段都来自工单 2058 的六个分区表单，
 * 与接口契约（mock）保持一致，便于后续替换为真实后端口径。
 */

/** 课程状态：草稿 / 审核中 / 已发布 */
export type CourseStatus = 'draft' | 'in_review' | 'published';

/** 六个分区表单的稳定标识，截图、锚点、校验定位都用它 */
export type SectionKey = 'basic' | 'intro' | 'outline' | 'outcomes' | 'instructors' | 'tags';

/** 交付方式 */
export type DeliveryMode = 'video' | 'live' | 'hybrid' | 'offline';

/** 可见范围 */
export type Visibility = 'public' | 'members' | 'internal';

/** 权益方式 */
export type BenefitMode = 'included' | 'points' | 'paid';

/** 讲师角色：主讲 / 联合主讲 / 助教 */
export type InstructorRole = 'main' | 'co_main' | 'assistant';

/** 标签维度：赛道 / 兴趣话题 */
export type TagDimension = 'track' | 'topic';

/** 讲师库中一位讲师的可用状态 */
export type InstructorStatus = 'active' | 'disabled';

/** 大纲条目：标题 + 时长（分钟），order 由数组顺序承载 */
export interface OutlineItem {
  id: string;
  title: string;
  durationMinutes: number;
}

/** 课程与讲师的关联，order 决定展示顺序 */
export interface CourseInstructorEntry {
  instructorId: string;
  role: InstructorRole;
  order: number;
}

/** 已选标签，每个维度最多 3 个 */
export interface CourseTagSelection {
  dimension: TagDimension;
  value: string;
}

/** 讲师库条目 */
export interface Instructor {
  id: string;
  name: string;
  title: string;
  org: string;
  bio: string;
  status: InstructorStatus;
  courseCount: number;
}

/** 字典项（类别 / 交付方式 / 可见范围 / 权益方式 / 赛道 / 话题） */
export interface DictOption {
  value: string;
  label: string;
}

/** 课程聚合（接口返回体），表单状态由它派生 */
export interface CourseRecord {
  id: string;
  status: CourseStatus;
  title: string;
  subtitle: string;
  categoryId: string;
  deliveryMode: DeliveryMode | '';
  visibility: Visibility | '';
  benefitMode: BenefitMode | '';
  coverUrl: string;
  coverName: string;
  introHtml: string;
  outline: OutlineItem[];
  outcomes: string[];
  instructors: CourseInstructorEntry[];
  tags: CourseTagSelection[];
  updatedAt: string;
}

/** 表单状态：比 CourseRecord 多一个"是否已存在"的语义由 id 承载 */
export type CourseFormState = Omit<CourseRecord, 'updatedAt'>;

/** 一条校验问题：分区 + 字段 + 人类可读文案，前后端共用同一结构 */
export interface ValidationIssue {
  section: SectionKey;
  field: string;
  label: string;
  message: string;
}

/** 保存/提交接口的请求体 */
export interface CourseSavePayload {
  id: string;
  title: string;
  subtitle: string;
  categoryId: string;
  deliveryMode: DeliveryMode | '';
  visibility: Visibility | '';
  benefitMode: BenefitMode | '';
  coverUrl: string;
  dropExternalStylesOnPaste: true;
  introHtml: string;
  introTextLength: number;
  outline: Array<{ id: string; title: string; durationMinutes: number; order: number }>;
  outcomes: string[];
  instructors: Array<{ instructorId: string; role: InstructorRole; order: number }>;
  tags: CourseTagSelection[];
}

/** 提交审核响应 */
export interface SubmitReviewResult {
  ok: boolean;
  reviewId?: string;
  /** 后端返回的缺失项列表，前端原样展示 */
  missing: ValidationIssue[];
}
