import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { useMouseSort } from '../src/components/useMouseSort.ts';

/** 拖拽 hook 的最小宿主：顺序放在 state 里，行为与页面里的大纲编辑器一致 */
function Harness() {
  const [items, setItems] = useState(['A', 'B', 'C', 'D', 'E']);
  const sort = useMouseSort({
    count: items.length,
    rowHeight: 56,
    onReorder: (from, to) => {
      setItems((prev) => {
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    },
  });
  return (
    <ul>
      {items.map((item, index) => (
        <li key={item} data-testid={'row-' + item} style={sort.draggingIndex === index ? { transform: 'translateY(' + sort.offsetY + 'px)' } : undefined}>
          <span data-testid={'handle-' + item} {...sort.handleProps(index)}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function order(): string[] {
  return Array.from(document.querySelectorAll('li')).map((li) => li.textContent ?? '');
}

describe('useMouseSort：连续拖动跨多行', () => {
  it('一次拖动过程中跨越 2 行，顺序连续变化（不会只生效第一步）', () => {
    render(<Harness />);
    expect(order()).toEqual(['A', 'B', 'C', 'D', 'E']);

    const handle = screen.getByTestId('handle-A');
    fireEvent.mouseDown(handle, { button: 0, clientY: 100 });
    // 位移相对按下点换算：+1 行 → index 1，+2 行 → index 2，+3 行 → index 3
    fireEvent.mouseMove(window, { clientY: 156 });
    expect(order()).toEqual(['B', 'A', 'C', 'D', 'E']);
    fireEvent.mouseMove(window, { clientY: 212 });
    expect(order()).toEqual(['B', 'C', 'A', 'D', 'E']);
    fireEvent.mouseMove(window, { clientY: 168 });
    expect(order()).toEqual(['B', 'A', 'C', 'D', 'E']);
    fireEvent.mouseMove(window, { clientY: 268 });
    expect(order()).toEqual(['B', 'C', 'D', 'A', 'E']);
    fireEvent.mouseUp(window, { clientY: 268 });

    // 中途回头再前进，最终落点仍由"起点 + 位移"决定，不会累积漂移
    fireEvent.mouseDown(screen.getByTestId('handle-B'), { button: 0, clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 100 + 56 * 3 });
    expect(order()).toEqual(['C', 'D', 'A', 'B', 'E']);
    fireEvent.mouseUp(window, {});

    // 拖动结束后不再有内联偏移（jsdom 里 style 属性可能返回空串而不是 null）
    expect(screen.getByTestId('row-A').getAttribute('style') ?? '').toBe('');
  });

  it('向上拖动跨越 2 行', () => {
    render(<Harness />);
    const handle = screen.getByTestId('handle-E');
    fireEvent.mouseDown(handle, { button: 0, clientY: 400 });
    fireEvent.mouseMove(window, { clientY: 344 });
    expect(order()).toEqual(['A', 'B', 'C', 'E', 'D']);
    fireEvent.mouseMove(window, { clientY: 288 });
    expect(order()).toEqual(['A', 'B', 'E', 'C', 'D']);
    fireEvent.mouseUp(window, {});
  });

  it('位移不足半行时不重排（避免抖动）', () => {
    render(<Harness />);
    const handle = screen.getByTestId('handle-A');
    fireEvent.mouseDown(handle, { button: 0, clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 120 });
    expect(order()).toEqual(['A', 'B', 'C', 'D', 'E']);
    fireEvent.mouseUp(window, {});
  });

  it('拖到边界后不会越界', () => {
    render(<Harness />);
    const handle = screen.getByTestId('handle-A');
    fireEvent.mouseDown(handle, { button: 0, clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 5000 });
    expect(order()).toEqual(['B', 'C', 'D', 'E', 'A']);
    fireEvent.mouseUp(window, {});
  });

  it('mouseup 之后继续移动鼠标不再改变顺序（拖动已结束）', () => {
    render(<Harness />);
    const handle = screen.getByTestId('handle-A');
    fireEvent.mouseDown(handle, { button: 0, clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 156 });
    fireEvent.mouseUp(window, {});
    const snapshot = order();
    fireEvent.mouseMove(window, { clientY: 400 });
    expect(order()).toEqual(snapshot);
  });
});