import type { OutlineItem } from '../types/domain.ts';

/**
 * 不可变地把 from 位置的条目移动到 to 位置。
 * 使用 splice 的"先删后插"语义：to 为移动后目标下标，返回值总是新数组。
 */
export function moveOutlineItem(items: OutlineItem[], from: number, to: number): OutlineItem[] {
  if (from === to) return [...items];
  if (from < 0 || from >= items.length) return [...items];
  const boundedTo = Math.max(0, Math.min(items.length - 1, to));
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(boundedTo, 0, moved);
  return next;
}

/** 上移一位（键盘/按钮可达，作为拖拽的等价操作） */
export function moveOutlineUp(items: OutlineItem[], index: number): OutlineItem[] {
  return moveOutlineItem(items, index, index - 1);
}

/** 下移一位 */
export function moveOutlineDown(items: OutlineItem[], index: number): OutlineItem[] {
  return moveOutlineItem(items, index, index + 1);
}

/** 新增一条空大纲，默认时长 15 分钟 */
export function appendOutlineItem(items: OutlineItem[], id: string): OutlineItem[] {
  return [...items, { id, title: '', durationMinutes: 15 }];
}

/** 更新某条大纲的字段 */
export function patchOutlineItem(
  items: OutlineItem[],
  id: string,
  patch: Partial<Omit<OutlineItem, 'id'>>,
): OutlineItem[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

/** 删除某条大纲 */
export function removeOutlineItem(items: OutlineItem[], id: string): OutlineItem[] {
  return items.filter((item) => item.id !== id);
}

/** 顺序摘要，便于断言与日志："1.开营 > 2.拉新 > 3.激活" */
export function outlineDigest(items: OutlineItem[]): string {
  return items.map((item, index) => String(index + 1) + '.' + item.title).join(' > ');
}
