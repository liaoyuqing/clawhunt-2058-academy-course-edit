import { useCallback, useEffect, useRef, useState } from 'react';

export interface MouseSortOptions {
  /** 当前条目数量 */
  count: number;
  /** 每行固定像素高度，用于把位移换算成跨越的行数 */
  rowHeight: number;
  /** 拖动过程中每次跨越一行就调用一次，参数是"当前下标 → 目标下标" */
  onReorder: (from: number, to: number) => void;
  /** 关闭拖动（例如只读状态） */
  disabled?: boolean;
}

export interface MouseSortApi {
  /** 正在拖动的下标，未拖动为 null */
  draggingIndex: number | null;
  /** 相对起始位置的位移，用于给拖动行加视觉偏移 */
  offsetY: number;
  /** 挂在拖拽手柄上的属性 */
  handleProps: (index: number) => {
    onMouseDown: (event: React.MouseEvent) => void;
    'data-drag-handle': string;
  };
}

/**
 * 鼠标拖拽排序。用固定行高换算位移，而不是读 getBoundingClientRect，
 * 这样在 jsdom 里（所有 rect 为 0）与真实浏览器里得到完全一致的排序结果，
 * 拖拽行为可以被单测覆盖，而不只是靠截图。
 *
 * onReorder 存在 ref 里，监听器只在开始拖动时挂一次：
 * 回调身份每次渲染都变，如果把它放进 effect 依赖，拖动途中会被反复解绑/重绑，
 * 连续拖动就会只生效第一步。
 */
export function useMouseSort(options: MouseSortOptions): MouseSortApi {
  const { count, rowHeight, onReorder, disabled = false } = options;
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [offsetY, setOffsetY] = useState(0);
  const currentIndex = useRef<number | null>(null);
  const originIndex = useRef(0);
  const startY = useRef(0);

  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const countRef = useRef(count);
  countRef.current = count;
  const rowHeightRef = useRef(rowHeight);
  rowHeightRef.current = rowHeight;

  const active = draggingIndex !== null;

  useEffect(() => {
    if (!active) return;

    const handleMove = (event: MouseEvent) => {
      const index = currentIndex.current;
      if (index === null) return;
      // 位移始终相对"按下时的起点"换算，而不是每步重置。
      // 重置起点会让半行阈值在连续小步移动里被反复触发，一次拖动跨 3 行可能变成跨 6 行。
      const dy = event.clientY - startY.current;
      setOffsetY(dy);
      const desired = Math.max(
        0,
        Math.min(countRef.current - 1, originIndex.current + Math.round(dy / rowHeightRef.current)),
      );
      if (desired === index) return;
      onReorderRef.current(index, desired);
      currentIndex.current = desired;
    };

    const handleUp = () => {
      currentIndex.current = null;
      setDraggingIndex(null);
      setOffsetY(0);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [active]);

  const handleProps = useCallback(
    (index: number) => ({
      'data-drag-handle': 'true',
      onMouseDown: (event: React.MouseEvent) => {
        if (disabled) return;
        if (event.button !== 0) return;
        event.preventDefault();
        currentIndex.current = index;
        originIndex.current = index;
        startY.current = event.clientY;
        setDraggingIndex(index);
        setOffsetY(0);
      },
    }),
    [disabled],
  );

  return { draggingIndex, offsetY, handleProps };
}