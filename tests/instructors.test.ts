import { describe, expect, it } from 'vitest';
import { INSTRUCTORS, findInstructor, isInstructorSelectable } from '../src/mocks/instructors.ts';
import {
  addInstructor,
  isAlreadySelected,
  mainInstructorCount,
  moveInstructor,
  normalizeOrder,
  promoteToMain,
  removeInstructor,
  selectableInstructors,
  setInstructorRole,
} from '../src/domain/instructors.ts';
import type { CourseInstructorEntry } from '../src/types/domain.ts';

const active = findInstructor('ins_9001');

const disabled = findInstructor('ins_9004');
const disabled2 = findInstructor('ins_9005');

describe('讲师库 mock 覆盖停用状态（AC2 前置条件）', () => {
  it('至少 4 位讲师，其中恰好 2 位停用', () => {
    expect(INSTRUCTORS.length).toBeGreaterThanOrEqual(4);
    expect(INSTRUCTORS.filter((i) => i.status === 'disabled')).toHaveLength(2);
  });

  it('isSelectable 只认 status=active', () => {
    expect(active && isInstructorSelectable(active)).toBe(true);
    expect(disabled && isInstructorSelectable(disabled)).toBe(false);
    expect(disabled2 && isInstructorSelectable(disabled2)).toBe(false);
  });
});

describe('停用讲师不可选（AC2 的领域断言）', () => {
  it('addInstructor 对停用讲师返回 ok:false，且已选列表保持不变', () => {
    if (!disabled) throw new Error('mock 缺失');
    const before: CourseInstructorEntry[] = [];
    const outcome = addInstructor(before, disabled);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('disabled');
    expect(before).toHaveLength(0);
  });

  it('两位停用讲师都加不进去，已选列表长度始终为 0（调用次数可证伪）', () => {
    const selected: CourseInstructorEntry[] = [];
    for (const candidate of [disabled, disabled2]) {
      if (!candidate) continue;
      const outcome = addInstructor(selected, candidate);
      expect(outcome.ok).toBe(false);
    }
    expect(selected).toHaveLength(0);
  });

  it('可选列表默认过滤掉停用讲师', () => {
    const options = selectableInstructors(INSTRUCTORS);
    expect(options).toHaveLength(3);
    expect(options.every((i) => i.status === 'active')).toBe(true);
    expect(options.some((i) => i.id === 'ins_9004')).toBe(false);
  });

  it('active 讲师可以加入，重复加入被拒绝', () => {
    if (!active) throw new Error('mock 缺失');
    const first = addInstructor([], active);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.next).toHaveLength(1);
    expect(first.next[0]).toMatchObject({ instructorId: active.id, role: 'co_main', order: 0 });

    const second = addInstructor(first.next, active);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('duplicated');
    expect(first.next).toHaveLength(1);
  });
});

describe('讲师角色与顺序', () => {
  it('promoteToMain 保证主讲唯一：其余主讲降级为联合主讲', () => {
    const selected: CourseInstructorEntry[] = [
      { instructorId: 'ins_9001', role: 'main', order: 0 },
      { instructorId: 'ins_9002', role: 'co_main', order: 1 },
      { instructorId: 'ins_9003', role: 'assistant', order: 2 },
    ];
    const next = promoteToMain(selected, 'ins_9002');
    expect(mainInstructorCount(next)).toBe(1);
    expect(next.find((i) => i.instructorId === 'ins_9001')?.role).toBe('co_main');
    expect(next.find((i) => i.instructorId === 'ins_9002')?.role).toBe('main');
  });

  it('没有任何主讲时 mainInstructorCount 为 0（提交时被校验拦截）', () => {
    expect(mainInstructorCount([{ instructorId: 'ins_9001', role: 'co_main', order: 0 }])).toBe(0);
  });

  it('移动讲师后 order 重新等于下标', () => {
    const selected: CourseInstructorEntry[] = [
      { instructorId: 'a', role: 'main', order: 0 },
      { instructorId: 'b', role: 'assistant', order: 1 },
      { instructorId: 'c', role: 'assistant', order: 2 },
    ];
    const next = moveInstructor(selected, 2, 0);
    expect(next.map((i) => i.instructorId)).toEqual(['c', 'a', 'b']);
    expect(next.map((i) => i.order)).toEqual([0, 1, 2]);
  });

  it('移除讲师后不留下 order 空洞', () => {
    const selected = normalizeOrder([
      { instructorId: 'a', role: 'main', order: 0 },
      { instructorId: 'b', role: 'assistant', order: 1 },
      { instructorId: 'c', role: 'assistant', order: 2 },
    ]);
    const next = removeInstructor(selected, 'b');
    expect(next.map((i) => i.order)).toEqual([0, 1]);
    expect(isAlreadySelected(next, 'b')).toBe(false);
  });

  it('setInstructorRole 只改目标行', () => {
    const selected: CourseInstructorEntry[] = [
      { instructorId: 'a', role: 'main', order: 0 },
      { instructorId: 'b', role: 'assistant', order: 1 },
    ];
    const next = setInstructorRole(selected, 'b', 'co_main');
    expect(next[1].role).toBe('co_main');
    expect(next[0].role).toBe('main');
  });
});
