import { describe, expect, it } from 'vitest';
import type { OutlineItem } from '../src/types/domain.ts';
import {
  appendOutlineItem,
  moveOutlineDown,
  moveOutlineItem,
  moveOutlineUp,
  outlineDigest,
  patchOutlineItem,
  removeOutlineItem,
} from '../src/domain/outline.ts';
import { toSavePayload, toFormState } from '../src/domain/form.ts';
import { readCourse, C_DRAFT_ID } from '../src/mocks/courses.ts';

function items(...titles: string[]): OutlineItem[] {
  return titles.map((title, index) => ({ id: 'ol_' + index, title, durationMinutes: 10 + index }));
}

describe('大纲拖拽排序（AC1 的核心逻辑）', () => {
  it('把第 1 条拖到第 3 位后，顺序变成 2 > 3 > 1', () => {
    const before = items('A', 'B', 'C', 'D');
    const after = moveOutlineItem(before, 0, 2);
    expect(after.map((i) => i.title)).toEqual(['B', 'C', 'A', 'D']);
  });

  it('把最后一条拖到第一位，顺序整体前移', () => {
    const after = moveOutlineItem(items('A', 'B', 'C'), 2, 0);
    expect(after.map((i) => i.title)).toEqual(['C', 'A', 'B']);
  });

  it('原地拖动不改变顺序', () => {
    const before = items('A', 'B', 'C');
    expect(moveOutlineItem(before, 1, 1).map((i) => i.title)).toEqual(['A', 'B', 'C']);
  });

  it('越界下标被钳制而不是抛错', () => {
    const before = items('A', 'B', 'C');
    expect(moveOutlineItem(before, 0, 99).map((i) => i.title)).toEqual(['B', 'C', 'A']);
    expect(moveOutlineItem(before, 5, 0).map((i) => i.title)).toEqual(['A', 'B', 'C']);
  });

  it('是纯函数：原数组不被修改（不可变更新）', () => {
    const before = items('A', 'B', 'C');
    const snapshot = JSON.stringify(before);
    moveOutlineItem(before, 0, 2);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('上移/下移按钮与拖动等价', () => {
    expect(moveOutlineDown(items('A', 'B', 'C'), 0).map((i) => i.title)).toEqual(['B', 'A', 'C']);
    expect(moveOutlineUp(items('A', 'B', 'C'), 2).map((i) => i.title)).toEqual(['A', 'C', 'B']);
  });

  it('digest 给出可断言的顺序摘要', () => {
    expect(outlineDigest(items('开营', '拉新', '激活'))).toBe('1.开营 > 2.拉新 > 3.激活');
  });

  it('新增 / 改字段 / 删除都是不可变操作', () => {
    const base = items('A');
    const added = appendOutlineItem(base, 'ol_new_01');
    expect(added).toHaveLength(2);
    expect(added[1]).toEqual({ id: 'ol_new_01', title: '', durationMinutes: 15 });
    expect(base).toHaveLength(1);

    const patched = patchOutlineItem(base, 'ol_0', { title: 'A2', durationMinutes: 20 });
    expect(patched[0]).toMatchObject({ title: 'A2', durationMinutes: 20 });
    expect(base[0].title).toBe('A');

    expect(removeOutlineItem(added, 'ol_0')).toHaveLength(1);
    expect(added).toHaveLength(2);
  });
});

describe('保存请求体里的 order 数组（AC1 的可观测证据）', () => {
  it('order 严格等于拖拽后的数组下标', () => {
    const record = readCourse(C_DRAFT_ID);
    expect(record).toBeDefined();
    if (!record) return;

    const state = toFormState(record);
    const reordered = {
      ...state,
      outline: moveOutlineItem(state.outline, 0, 3),
    };
    const payload = toSavePayload(reordered);

    expect(payload.outline.map((item) => item.order)).toEqual([0, 1, 2, 3, 4]);
    // 第 1 条被移动到第 4 位：order 3 的标题应等于原来的第 1 条
    expect(payload.outline[3].title).toBe(record.outline[0].title);
    expect(payload.outline[0].title).toBe(record.outline[1].title);
  });

  it('保存后重新解析得到的顺序与拖拽结果一致（可证伪）', () => {
    const record = readCourse(C_DRAFT_ID);
    if (!record) throw new Error('mock 缺失');
    const state = toFormState(record);
    const reordered = { ...state, outline: moveOutlineItem(state.outline, 4, 0) };
    const payload = toSavePayload(reordered);

    // 模拟后端落库后再读回：按 order 排序还原
    const restored = [...payload.outline].sort((a, b) => a.order - b.order).map((i) => i.title);
    expect(restored).toEqual(reordered.outline.map((i) => i.title));
    expect(restored[0]).toBe(record.outline[4].title);
  });
});
