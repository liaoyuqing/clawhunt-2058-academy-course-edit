import type { CourseTagSelection, TagDimension } from '../types/domain.ts';
import { LIMITS } from './form.ts';

/**
 * 标签选择的领域规则：只允许从字典中选择，每个维度最多 3 个。
 * 这里是唯一实现"限 3 个"的地方，UI 的禁用态与单测断言都读同一个函数。
 */

export type TagToggleOutcome =
  | { ok: true; next: CourseTagSelection[] }
  | { ok: false; reason: 'limit' };

/** 某维度已选数量 */
export function countDimension(tags: CourseTagSelection[], dimension: TagDimension): number {
  return tags.filter((item) => item.dimension === dimension).length;
}

/** 某维度是否还能再选（达到上限即 false） */
export function canSelectMore(tags: CourseTagSelection[], dimension: TagDimension): boolean {
  return countDimension(tags, dimension) < LIMITS.tagsPerDimension;
}

/**
 * 切换一个标签。已选则取消；未选且该维度已满 3 个则返回 ok:false 且状态不变。
 * 传入的 value 必须来自字典，调用方负责不传自由输入值。
 */
export function toggleTag(
  tags: CourseTagSelection[],
  dimension: TagDimension,
  value: string,
): TagToggleOutcome {
  const exists = tags.some((item) => item.dimension === dimension && item.value === value);
  if (exists) {
    return { ok: true, next: tags.filter((item) => !(item.dimension === dimension && item.value === value)) };
  }
  if (!canSelectMore(tags, dimension)) return { ok: false, reason: 'limit' };
  return { ok: true, next: [...tags, { dimension, value }] };
}

/** 某维度已选的值集合，用于渲染选中态 */
export function selectedValues(tags: CourseTagSelection[], dimension: TagDimension): string[] {
  return tags.filter((item) => item.dimension === dimension).map((item) => item.value);
}

/** 标签校验：每个维度至少 1 个，最多 3 个 */
export function tagProblems(tags: CourseTagSelection[]): Array<{ dimension: TagDimension; message: string }> {
  const problems: Array<{ dimension: TagDimension; message: string }> = [];
  const dims: TagDimension[] = ['track', 'topic'];
  for (const dimension of dims) {
    const count = countDimension(tags, dimension);
    if (count === 0) problems.push({ dimension, message: '至少选择 1 个' });
    if (count > LIMITS.tagsPerDimension) problems.push({ dimension, message: '最多选择 3 个' });
  }
  return problems;
}
