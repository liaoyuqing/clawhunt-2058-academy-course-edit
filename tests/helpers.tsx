import { render, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { screen } from '@testing-library/react';
import { readApiLog } from '../src/api/courseApi.ts';
import { routes } from '../src/routes.tsx';
import { seedMockDb } from '../src/api/courseApi.ts';

/**
 * 用内存路由渲染真实路由表，保证 useBlocker / navigate 走的是真实的 react-router 路径。
 * seed:false 用于"保存后重新挂载（模拟刷新）"场景——重新播种会把刚保存的顺序覆盖回种子数据。
 */
export function renderAt(path: string, options: { seed?: boolean } = {}) {
  if (options.seed !== false) seedMockDb();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  return { ...view, router };
}

/** 把异步链（loading → 渲染 → 状态更新）跑到静默 */
export async function flush(times = 6): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

const INTERACTIVE = 'input,button,textarea,select,[contenteditable]';

/**
 * 读取一个控件的"真实可交互元素"。
 * TDesign 的 Input/Button/Select 会在外层 div 上挂 data-testid，真正的 input/button 是子节点，
 * 所以断言可用性时必须向下找一层，否则读到的是包装 div（disabled 永远 undefined）。
 */
export function interactiveOf(testId: string): HTMLElement {
  const root = screen.getByTestId(testId);
  const inner = root.querySelector(INTERACTIVE);
  return (inner as HTMLElement | null) ?? root;
}

/** 控件是否不可用：原生 disabled 或 TDesign 的 t-is-disabled 类 */
export function isDisabled(testId: string): boolean {
  const root = screen.getByTestId(testId);
  const inner = root.querySelector('input,button,textarea,select') as
    | HTMLInputElement
    | HTMLButtonElement
    | HTMLTextAreaElement
    | null;
  if (inner) return inner.disabled === true;
  return root.classList.contains('t-is-disabled') || root.getAttribute('aria-disabled') === 'true';
}

/** 某个 testid 前缀下所有控件的可用性列表 */
export function disabledList(prefix: string): Array<{ id: string; disabled: boolean }> {
  const nodes = Array.from(document.querySelectorAll('[data-testid^="' + prefix + '"]'));
  return nodes.map((node) => {
    const inner = node.querySelector('input,button,textarea,select') as
      | HTMLInputElement
      | HTMLButtonElement
      | HTMLTextAreaElement
      | null;
    const id = node.getAttribute('data-testid') ?? '';
    if (inner) return { id, disabled: inner.disabled === true };
    return { id, disabled: node.classList.contains('t-is-disabled') || node.getAttribute('aria-disabled') === 'true' };
  });
}

/**
 * 等到「保存/提交这类写操作已经落到 mock 库」为止。
 *
 * 早先页面用例用 flush(10)（跑 10 次 setTimeout(0)）来等保存完成，但 setTimeout(0)
 * 的实际间隔依平台不同（Windows ~15ms，Linux 容器 ~1ms），机器稍慢或并行 worker
 * 抢占 CPU 时就会在保存还没返回时断言，导致随机失败。这里改成等待可观测结果：
 * data-dirty 变回 false（保存成功后页面清除脏标记）。
 */
export async function waitForSaved(): Promise<void> {
  const page = await screen.findByTestId('course-edit-page');
  await waitFor(() => {
    expect(page.getAttribute('data-dirty')).toBe('false');
  });
  await flush();
}

/** 等到至少有一条指定方法的接口取证记录（用真实请求日志判断写操作已完成） */
export async function waitForApiCall(method: 'GET' | 'POST' | 'PUT'): Promise<void> {
  await waitFor(() => {
    expect(readApiLog().some((entry) => entry.method === method)).toBe(true);
  });
}