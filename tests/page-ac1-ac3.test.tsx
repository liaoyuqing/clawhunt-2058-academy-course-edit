import { describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { flush, isDisabled, renderAt, waitForSaved } from './helpers.tsx';
import { C_DRAFT_ID } from '../src/mocks/courses.ts';
import { readApiLog } from '../src/api/courseApi.ts';

/** 读取当前渲染出的章节顺序（按 DOM 顺序，而不是内存里的 state） */
function domOrder(): string[] {
  return Array.from(document.querySelectorAll('[data-outline-row]')).map(
    (row) => row.querySelector('[data-testid^="outline-title-"] input')?.getAttribute('value') ?? '',
  );
}

describe('AC1：大纲拖拽排序后保存的顺序正确', () => {
  it('鼠标拖动把第 1 条拖到第 3 位：DOM 顺序立即变化，order 证据同步更新', async () => {
    renderAt('/academy/courses/' + C_DRAFT_ID + '/edit');
    await waitFor(() => expect(document.querySelectorAll('[data-outline-row]').length).toBeGreaterThan(0));
    await flush();

    const before = domOrder();
    expect(before).toHaveLength(5);

    const handle = screen.getByTestId('outline-handle-ol_1');
    // 2 行 = 首条被拖到第 3 位（rowHeight = 56）
    fireEvent.mouseDown(handle, { button: 0, clientY: 500 });
    fireEvent.mouseMove(window, { clientY: 500 + 56 });
    fireEvent.mouseMove(window, { clientY: 500 + 56 * 2 });
    fireEvent.mouseUp(window, { clientY: 500 + 56 * 2 });
    await flush();

    const after = domOrder();
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toBe(before[2]);
    expect(after[2]).toBe(before[0]);
    expect(after).not.toEqual(before);
    expect(screen.getByTestId('current-order').textContent).toContain(before[0]);
  });

  it('拖动后点保存草稿：请求体里的 order 数组严格递增且顺序与 DOM 一致', async () => {
    renderAt('/academy/courses/' + C_DRAFT_ID + '/edit');
    await waitFor(() => expect(document.querySelectorAll('[data-outline-row]').length).toBe(5));
    await flush();

    const handle = screen.getByTestId('outline-handle-ol_1');
    fireEvent.mouseDown(handle, { button: 0, clientY: 300 });
    fireEvent.mouseMove(window, { clientY: 300 + 56 * 3 });
    fireEvent.mouseUp(window, { clientY: 300 + 56 * 3 });
    await flush();

    const expectedOrder = domOrder();
    expect(expectedOrder[3]).toBe('开营：增长模型的六个动作');

    fireEvent.click(screen.getByTestId('save-draft'));
    await waitForSaved();

    const log = readApiLog();
    const saveEntry = log.filter((e) => e.method === 'PUT').pop();
    expect(saveEntry).toBeDefined();
    if (!saveEntry) return;

    const body = saveEntry.body as { outline: Array<{ title: string; order: number }> };
    expect(body.outline.map((i) => i.order)).toEqual([0, 1, 2, 3, 4]);
    expect(body.outline.map((i) => i.title)).toEqual(expectedOrder);
    expect(body.outline[3].title).toBe('开营：增长模型的六个动作');
  });

  it('保存后基线顺序更新，重新读取列表顺序与保存结果一致（重新加载后仍正确）', async () => {
    renderAt('/academy/courses/' + C_DRAFT_ID + '/edit');
    await waitFor(() => expect(document.querySelectorAll('[data-outline-row]').length).toBe(5));
    await flush();

    // 用按钮把最后一条移到最前（等价操作，同样写入 order）
    const lastRow = document.querySelectorAll('[data-outline-row]')[4];
    const lastId = lastRow.getAttribute('data-outline-row');
    expect(lastId).toBe('ol_5');
    fireEvent.click(screen.getByTestId('outline-up-ol_5'));
    fireEvent.click(screen.getByTestId('outline-up-ol_5'));
    fireEvent.click(screen.getByTestId('outline-up-ol_5'));
    fireEvent.click(screen.getByTestId('outline-up-ol_5'));
    await flush();

    const edited = domOrder();
    expect(edited[0]).toBe('复购与推荐：会员权益设计');

    fireEvent.click(screen.getByTestId('save-draft'));
    await waitForSaved();

    // 保存后基线（saved-order 证据条）应等于当前顺序，且不再有未保存提示
    await waitFor(() => {
      expect(screen.getByTestId('saved-order').textContent).toContain('复购与推荐：会员权益设计');
    });
    expect(screen.getByTestId('course-edit-page').getAttribute('data-dirty')).toBe('false');
    expect(isDisabled('save-draft')).toBe(false);

    // 重新挂载（模拟刷新）：mock 库读回的顺序仍是编辑后的顺序。
    // 先卸载上一棵树，否则两棵 DOM 会叠在一起（rows 数量翻倍）。
    cleanup();
    renderAt('/academy/courses/' + C_DRAFT_ID + '/edit', { seed: false });
    await waitFor(() => expect(document.querySelectorAll('[data-outline-row]').length).toBe(5));
    await flush();
    expect(domOrder()).toEqual(edited);
  });

  it('未保存时基线顺序与当前顺序不同（拖拽确实产生了待保存差异）', async () => {
    renderAt('/academy/courses/' + C_DRAFT_ID + '/edit');
    await waitFor(() => expect(document.querySelectorAll('[data-outline-row]').length).toBe(5));
    await flush();

    const baselineBefore = screen.getByTestId('saved-order').textContent;
    fireEvent.click(screen.getByTestId('outline-down-ol_1'));
    await flush();

    expect(screen.getByTestId('saved-order').textContent).toBe(baselineBefore);
    expect(screen.getByTestId('current-order').textContent).not.toBe(baselineBefore);
    expect(screen.getByTestId('course-edit-page').getAttribute('data-dirty')).toBe('true');
  });
});

describe('AC3：有未保存修改时离开页面出现确认弹窗', () => {
  it('未修改时点返回：直接离开，不弹窗（isDirty=false 分支）', async () => {
    const { router } = renderAt('/academy/courses/' + C_DRAFT_ID + '/edit');
    await waitFor(() => expect(screen.getByTestId('back-link')).toBeInTheDocument());
    await flush();

    expect(screen.getByTestId('course-edit-page').getAttribute('data-dirty')).toBe('false');
    fireEvent.click(screen.getByTestId('back-link'));
    await flush();

    expect(screen.queryByTestId('leave-dialog')).toBeNull();
    expect(router.state.location.pathname).toBe('/academy/courses');
    await screen.findByTestId('course-list');
  });

  it('改了标题后点返回：弹窗出现（isDirty=true 分支）', async () => {
    const { router } = renderAt('/academy/courses/' + C_DRAFT_ID + '/edit');
    await waitFor(() => expect(screen.getByTestId('input-title')).toBeInTheDocument());
    await flush();

    const titleInput = screen.getByTestId('input-title').querySelector('input') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: titleInput.value + '（未保存的修改）' } });
    await flush();
    expect(screen.getByTestId('course-edit-page').getAttribute('data-dirty')).toBe('true');

    fireEvent.click(screen.getByTestId('back-link'));
    await flush();

    // 弹窗出现，且路由仍停在编辑页
    await screen.findByTestId('leave-dialog');
    expect(screen.getByTestId('leave-dialog').textContent).toContain('尚未保存');
    expect(router.state.location.pathname).toBe('/academy/courses/' + C_DRAFT_ID + '/edit');

    // 点「留下继续编辑」：弹窗关闭，路由不动，修改仍在
    fireEvent.click(screen.getByTestId('leave-stay'));
    await flush();
    expect(screen.queryByTestId('leave-dialog')).toBeNull();
    expect(router.state.location.pathname).toBe('/academy/courses/' + C_DRAFT_ID + '/edit');
    expect((screen.getByTestId('input-title').querySelector('input') as HTMLInputElement).value).toContain('未保存的修改');
  });

  it('弹窗里点「放弃修改并离开」：跳转到列表页', async () => {
    const { router } = renderAt('/academy/courses/' + C_DRAFT_ID + '/edit');
    await waitFor(() => expect(screen.getByTestId('input-title')).toBeInTheDocument());
    await flush();

    const titleInput = screen.getByTestId('input-title').querySelector('input') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: '改过的标题' } });
    await flush();

    fireEvent.click(screen.getByTestId('back-link'));
    await flush();
    await screen.findByTestId('leave-dialog');

    fireEvent.click(screen.getByTestId('leave-confirm'));
    await flush(10);

    expect(router.state.location.pathname).toBe('/academy/courses');
    await screen.findByTestId('course-list');
    expect(screen.queryByTestId('course-edit-page')).toBeNull();
  });

  it('改动大纲顺序也算未保存修改，返回时同样拦截', async () => {
    const { router } = renderAt('/academy/courses/' + C_DRAFT_ID + '/edit');
    await waitFor(() => expect(document.querySelectorAll('[data-outline-row]').length).toBe(5));
    await flush();

    fireEvent.click(screen.getByTestId('outline-down-ol_1'));
    await flush();
    expect(screen.getByTestId('course-edit-page').getAttribute('data-dirty')).toBe('true');

    fireEvent.click(screen.getByTestId('back-link'));
    await flush();
    await screen.findByTestId('leave-dialog');
    expect(router.state.location.pathname).toBe('/academy/courses/' + C_DRAFT_ID + '/edit');
    fireEvent.click(screen.getByTestId('leave-stay'));
    await flush();
  });

  it('保存后再点返回不再弹窗（脏状态被清除）', async () => {
    const { router } = renderAt('/academy/courses/' + C_DRAFT_ID + '/edit');
    await waitFor(() => expect(screen.getByTestId('input-title')).toBeInTheDocument());
    await flush();

    const titleInput = screen.getByTestId('input-title').querySelector('input') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: '保存后再离开' } });
    await flush();

    fireEvent.click(screen.getByTestId('save-draft'));
    await waitForSaved();
    expect(screen.getByTestId('course-edit-page').getAttribute('data-dirty')).toBe('false');

    fireEvent.click(screen.getByTestId('back-link'));
    await flush(10);
    expect(screen.queryByTestId('leave-dialog')).toBeNull();
    expect(router.state.location.pathname).toBe('/academy/courses');
  });

  it('dirty 时才注册 beforeunload（刷新/关闭标签页的原生拦截）', async () => {
    renderAt('/academy/courses/' + C_DRAFT_ID + '/edit');
    await waitFor(() => expect(screen.getByTestId('input-title')).toBeInTheDocument());
    await flush();

    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    const titleInput = screen.getByTestId('input-title').querySelector('input') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: '脏了' } });
    await flush();

    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});