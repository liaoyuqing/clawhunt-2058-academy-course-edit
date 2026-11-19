import type { DictOption, TagDimension } from '../types/domain.ts';

/**
 * 字典中心（S2-TAX）的本地桩。真实环境中这些值来自 GET /taxonomy/nodes，
 * 这里用固定的虚构数据，保证页面在无后端时可完整运行。
 */

export const CATEGORY_OPTIONS: DictOption[] = [
  { value: 'cat_growth', label: '增长与运营' },
  { value: 'cat_product', label: '产品与设计' },
  { value: 'cat_tech', label: '技术与研发' },
  { value: 'cat_leadership', label: '组织与领导力' },
  { value: 'cat_service', label: '客户服务' },
];

export const DELIVERY_MODE_OPTIONS: DictOption[] = [
  { value: 'video', label: '录播视频' },
  { value: 'live', label: '直播授课' },
  { value: 'hybrid', label: '直播 + 录播' },
  { value: 'offline', label: '线下工作坊' },
];

export const VISIBILITY_OPTIONS: DictOption[] = [
  { value: 'public', label: '全部可见' },
  { value: 'members', label: '仅会员可见' },
  { value: 'internal', label: '仅内部可见' },
];

export const BENEFIT_MODE_OPTIONS: DictOption[] = [
  { value: 'included', label: '包含在会员权益内' },
  { value: 'points', label: '积分兑换' },
  { value: 'paid', label: '单独购买' },
];

/** 赛道与兴趣话题：两个维度各自独立限 3 个 */
export const TAG_DIMENSIONS: Array<{ dimension: TagDimension; label: string; limit: number }> = [
  { dimension: 'track', label: '赛道', limit: 3 },
  { dimension: 'topic', label: '兴趣话题', limit: 3 },
];

export const TRACK_OPTIONS: DictOption[] = [
  { value: 'track_new_retail', label: '新零售' },
  { value: 'track_saas', label: '企业服务 SaaS' },
  { value: 'track_content', label: '内容与社区' },
  { value: 'track_manufacturing', label: '智能制造' },
  { value: 'track_finance', label: '金融科技' },
];

export const TOPIC_OPTIONS: DictOption[] = [
  { value: 'topic_growth', label: '用户增长' },
  { value: 'topic_retention', label: '留存与复购' },
  { value: 'topic_data', label: '数据分析' },
  { value: 'topic_management', label: '团队管理' },
  { value: 'topic_service', label: '客户成功' },
  { value: 'topic_ai', label: 'AI 应用' },
];

export const TAG_OPTIONS: Record<TagDimension, DictOption[]> = {
  track: TRACK_OPTIONS,
  topic: TOPIC_OPTIONS,
};

export const INSTRUCTOR_ROLES: Array<{ value: 'main' | 'co_main' | 'assistant'; label: string }> = [
  { value: 'main', label: '主讲' },
  { value: 'co_main', label: '联合主讲' },
  { value: 'assistant', label: '助教' },
];

export const ROLE_LABEL: Record<string, string> = {
  main: '主讲',
  co_main: '联合主讲',
  assistant: '助教',
};

export const DELIVERY_LABEL: Record<string, string> = Object.fromEntries(
  DELIVERY_MODE_OPTIONS.map((item) => [item.value, item.label]),
);
export const VISIBILITY_LABEL: Record<string, string> = Object.fromEntries(
  VISIBILITY_OPTIONS.map((item) => [item.value, item.label]),
);
export const BENEFIT_LABEL: Record<string, string> = Object.fromEntries(
  BENEFIT_MODE_OPTIONS.map((item) => [item.value, item.label]),
);

/** 某维度最多可选几个标签 */
export function tagLimit(dimension: TagDimension): number {
  return TAG_DIMENSIONS.find((item) => item.dimension === dimension)?.limit ?? 3;
}
