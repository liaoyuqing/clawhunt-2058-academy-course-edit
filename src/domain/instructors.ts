import type { CourseInstructorEntry, Instructor, InstructorRole } from '../types/domain.ts';

/**
 * 讲师选择的领域规则。所有"不可选"判定都收敛在这里，
 * 让 UI 与单测共用同一份判定，避免置灰和点击两处逻辑漂移。
 */

/** 停用讲师不可选 */
export function isSelectable(instructor: Instructor): boolean {
  return instructor.status === 'active';
}

/** 已在课程中的讲师不允许重复添加 */
export function isAlreadySelected(selected: CourseInstructorEntry[], instructorId: string): boolean {
  return selected.some((item) => item.instructorId === instructorId);
}

export type AddInstructorOutcome =
  | { ok: true; next: CourseInstructorEntry[] }
  | { ok: false; reason: 'disabled' | 'duplicated' };

/**
 * 尝试把一位讲师加入课程。
 * 停用讲师与重复讲师都返回 ok:false，且不产生任何状态变更。
 */
export function addInstructor(
  selected: CourseInstructorEntry[],
  instructor: Instructor,
  role: InstructorRole = 'co_main',
): AddInstructorOutcome {
  if (!isSelectable(instructor)) return { ok: false, reason: 'disabled' };
  if (isAlreadySelected(selected, instructor.id)) return { ok: false, reason: 'duplicated' };
  const next = [...selected, { instructorId: instructor.id, role, order: selected.length }];
  return { ok: true, next: normalizeOrder(next) };
}

/** 移除讲师并重排 order */
export function removeInstructor(selected: CourseInstructorEntry[], instructorId: string): CourseInstructorEntry[] {
  return normalizeOrder(selected.filter((item) => item.instructorId !== instructorId));
}

/** 修改角色，主讲只能有一位时由 UI 决定是否降级，这里只做替换 */
export function setInstructorRole(
  selected: CourseInstructorEntry[],
  instructorId: string,
  role: InstructorRole,
): CourseInstructorEntry[] {
  return selected.map((item) => (item.instructorId === instructorId ? { ...item, role } : item));
}

/** 把某位讲师拉为主讲：其余主讲降级为联合主讲，保证"至少 1 名主讲"且主讲唯一 */
export function promoteToMain(selected: CourseInstructorEntry[], instructorId: string): CourseInstructorEntry[] {
  return selected.map((item) => {
    if (item.instructorId === instructorId) return { ...item, role: 'main' as InstructorRole };
    if (item.role === 'main') return { ...item, role: 'co_main' as InstructorRole };
    return item;
  });
}

/** 上移/下移讲师顺序，与大纲一致的可达操作 */
export function moveInstructor(selected: CourseInstructorEntry[], from: number, to: number): CourseInstructorEntry[] {
  if (from < 0 || from >= selected.length) return [...selected];
  const boundedTo = Math.max(0, Math.min(selected.length - 1, to));
  const next = [...selected];
  const [moved] = next.splice(from, 1);
  next.splice(boundedTo, 0, moved);
  return normalizeOrder(next);
}

/** 顺序字段始终等于数组下标，避免脏数据 */
export function normalizeOrder(selected: CourseInstructorEntry[]): CourseInstructorEntry[] {
  return selected.map((item, index) => ({ ...item, order: index }));
}

/** 主讲数量（用于校验"至少 1 名主讲"） */
export function mainInstructorCount(selected: CourseInstructorEntry[]): number {
  return selected.filter((item) => item.role === 'main').length;
}

/** 可选讲师列表：默认过滤掉停用讲师 */
export function selectableInstructors(instructors: Instructor[]): Instructor[] {
  return instructors.filter(isSelectable);
}
