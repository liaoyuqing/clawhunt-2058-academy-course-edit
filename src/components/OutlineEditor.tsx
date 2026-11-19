import { useState } from 'react';
import { Button, Input, InputNumber, MessagePlugin } from 'tdesign-react';
import { AddIcon, ChevronDownIcon, ChevronUpIcon, DeleteIcon, DragMoveIcon } from 'tdesign-icons-react';
import type { OutlineItem } from '../types/domain.ts';
import { humanDuration, totalDuration } from '../domain/form.ts';
import { moveOutlineDown, moveOutlineUp } from '../domain/outline.ts';
import { useMouseSort } from './useMouseSort.ts';

export interface OutlineEditorProps {
  items: OutlineItem[];
  disabled: boolean;
  onMove: (from: number, to: number) => void;
  onAdd: () => void;
  onPatch: (id: string, patch: Partial<Omit<OutlineItem, 'id'>>) => void;
  onRemove: (id: string) => void;
  /** 拖动次数，用于取证与单测 */
  onDragStep?: (from: number, to: number) => void;
}

const ROW_HEIGHT = 56;

/**
 * 可拖拽排序的大纲编辑器。
 * 拖动用鼠标按住左侧手柄完成，位移除以固定行高换算跨行数，跨行即重排；
 * 同时保留上移/下移按钮，键盘与触屏也能改变顺序（无障碍等价操作）。
 * 顺序只存在于数组下标，保存时由 toSavePayload 写成 order 字段。
 */
export function OutlineEditor({ items, disabled, onMove, onAdd, onPatch, onRemove, onDragStep }: OutlineEditorProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sort = useMouseSort({
    count: items.length,
    rowHeight: ROW_HEIGHT,
    disabled,
    onReorder: (from, to) => {
      const moved = items[from];
      onMove(from, to);
      if (moved) setDraggingId(moved.id);
      onDragStep?.(from, to);
    },
  });

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (disabled) return;
    if (event.key === 'ArrowUp' && event.altKey) {
      event.preventDefault();
      onMove(index, index - 1);
    }
    if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault();
      onMove(index, index + 1);
    }
  };

  return (
    <div className="outline-editor" data-testid="outline-editor">
      <div className="outline-editor__head">
        <span className="outline-editor__col outline-editor__col--handle">排序</span>
        <span className="outline-editor__col outline-editor__col--title">章节标题</span>
        <span className="outline-editor__col outline-editor__col--duration">时长（分钟）</span>
        <span className="outline-editor__col outline-editor__col--ops">操作</span>
      </div>

      <ul className="outline-editor__list" role="list">
        {items.map((item, index) => {
          const isDragging = sort.draggingIndex === index;
          return (
            <li
              key={item.id}
              className={'outline-editor__row' + (isDragging ? ' is-dragging' : '')}
              data-outline-row={item.id}
              data-outline-index={index}
              style={isDragging ? { transform: 'translateY(' + sort.offsetY + 'px)' } : undefined}
            >
              <span className="outline-editor__col outline-editor__col--handle">
                <span
                  className="outline-editor__handle"
                  data-testid={'outline-handle-' + item.id}
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  aria-label={'拖动排序：' + (item.title || '第 ' + (index + 1) + ' 条')}
                  aria-disabled={disabled}
                  title={disabled ? '已发布课程不可调整顺序' : '按住拖动调整顺序'}
                  {...sort.handleProps(index)}
                >
                  <DragMoveIcon />
                  <span className="outline-editor__seq">{index + 1}</span>
                </span>
              </span>

              <span className="outline-editor__col outline-editor__col--title">
                <Input
                  value={item.title}
                  disabled={disabled}
                  placeholder="例如：拉新：渠道选择与成本核算"
                  data-testid={'outline-title-' + item.id}
                  onChange={(value) => onPatch(item.id, { title: String(value) })}
                  onKeydown={(_value: string, context: { e: React.KeyboardEvent<HTMLDivElement> }) => handleKeyDown(context.e, index)}
                />
              </span>

              <span className="outline-editor__col outline-editor__col--duration">
                <InputNumber
                  value={item.durationMinutes}
                  disabled={disabled}
                  min={1}
                  max={600}
                  step={1}
                  theme="normal"
                  data-testid={'outline-duration-' + item.id}
                  onChange={(value) => onPatch(item.id, { durationMinutes: Number(value ?? 0) })}
                />
              </span>

              <span className="outline-editor__col outline-editor__col--ops">
                <Button
                  size="small"
                  variant="text"
                  disabled={disabled || index === 0}
                  aria-label="上移"
                  data-testid={'outline-up-' + item.id}
                  onClick={() => {
                    onMove(index, index - 1);
                    onDragStep?.(index, index - 1);
                  }}
                >
                  <ChevronUpIcon />
                </Button>
                <Button
                  size="small"
                  variant="text"
                  disabled={disabled || index === items.length - 1}
                  aria-label="下移"
                  data-testid={'outline-down-' + item.id}
                  onClick={() => {
                    onMove(index, index + 1);
                    onDragStep?.(index, index + 1);
                  }}
                >
                  <ChevronDownIcon />
                </Button>
                <Button
                  size="small"
                  variant="text"
                  theme="danger"
                  disabled={disabled}
                  aria-label="删除该条"
                  data-testid={'outline-remove-' + item.id}
                  onClick={() => {
                    if (items.length <= 1) {
                      MessagePlugin.warning('至少保留 1 个大纲条目');
                      return;
                    }
                    onRemove(item.id);
                  }}
                >
                  <DeleteIcon />
                </Button>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="outline-editor__foot">
        <Button size="small" variant="outline" disabled={disabled} onClick={onAdd} data-testid="outline-add">
          <AddIcon /> 添加章节
        </Button>
        <span className="outline-editor__total" data-testid="outline-total">
          共 {items.length} 章 · 总时长 {humanDuration(totalDuration(items))}
        </span>
        <span className="outline-editor__tip">拖动左侧手柄排序，顺序会在保存后落库</span>
      </div>

      {draggingId !== null && sort.draggingIndex !== null ? (
        <span className="outline-editor__live" aria-live="polite">
          正在拖动第 {sort.draggingIndex + 1} 条
        </span>
      ) : null}
    </div>
  );
}

/** 供单测复用的等价操作 */
export function moveUp(items: OutlineItem[], index: number): OutlineItem[] {
  return moveOutlineUp(items, index);
}

export function moveDown(items: OutlineItem[], index: number): OutlineItem[] {
  return moveOutlineDown(items, index);
}

export default OutlineEditor;
