import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, MessagePlugin, Tag } from 'tdesign-react';
import { AddIcon, ChevronDownIcon, ChevronUpIcon, DeleteIcon, SearchIcon } from 'tdesign-icons-react';
import type { CourseInstructorEntry, Instructor, InstructorRole } from '../types/domain.ts';
import { INSTRUCTOR_ROLES, ROLE_LABEL } from '../mocks/taxonomy.ts';
import { isSelectable } from '../domain/instructors.ts';
import { searchInstructors } from '../api/courseApi.ts';

export interface InstructorPickerProps {
  selected: CourseInstructorEntry[];
  disabled: boolean;
  onAdd: (instructor: Instructor, role: InstructorRole) => void;
  onRemove: (instructorId: string) => void;
  onRoleChange: (instructorId: string, role: InstructorRole) => void;
  onPromote: (instructorId: string) => void;
  onMove: (from: number, to: number) => void;
  /** 选择器里出现过的讲师（含停用），用于取证：停用项确实被渲染过但不可选 */
  onPickerRender?: (list: Instructor[]) => void;
}

/**
 * 讲师选择器：从讲师库搜索并选择。
 * 停用讲师仍然展示（便于管理员看到账号状态），但整行 disabled + 明确标注「已停用」，
 * 点击不会进入已选列表；判定与领域函数 isSelectable 同源。
 */
export function InstructorPicker({
  selected, disabled, onAdd, onRemove, onRoleChange, onPromote, onMove, onPickerRender,
}: InstructorPickerProps) {
  const [keyword, setKeyword] = useState('');
  const [list, setList] = useState<Instructor[]>([]);
  const [role, setRole] = useState<InstructorRole>('co_main');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    let alive = true;
    const current = ++reqId.current;
    setLoading(true);
    void searchInstructors(keyword).then((result) => {
      // 关键词快速变化时只采纳最后一次请求的结果
      if (!alive || current !== reqId.current) return;
      setList(result);
      onPickerRender?.(result);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [keyword, onPickerRender]);

  const selectedIds = useMemo(() => new Set(selected.map((item) => item.instructorId)), [selected]);

  return (
    <div className="instructor-picker" data-testid="instructor-picker">
      <div className="instructor-picker__search">
        <Input
          value={keyword}
          disabled={disabled}
          placeholder="搜索讲师姓名 / 职称 / 机构"
          prefixIcon={<SearchIcon />}
          data-testid="instructor-search"
          onChange={(value) => setKeyword(String(value))}
          onFocus={() => setOpen(true)}
        />
        <Button size="small" variant="outline" disabled={disabled} onClick={() => setOpen((v) => !v)} data-testid="instructor-toggle">
          {open ? '收起讲师库' : '浏览讲师库'}
        </Button>
      </div>

      {open ? (
        <ul className="instructor-picker__list" role="listbox" aria-label="讲师库" data-testid="instructor-list">
          {list.map((instructor) => {
            const selectable = isSelectable(instructor);
            const already = selectedIds.has(instructor.id);
            const blocked = disabled || !selectable || already;
            return (
              <li
                key={instructor.id}
                className={'instructor-picker__item' + (selectable ? '' : ' is-disabled') + (already ? ' is-selected' : '')}
                role="option"
                aria-selected={already}
                aria-disabled={blocked}
                data-instructor-id={instructor.id}
                data-instructor-status={instructor.status}
                data-selectable={selectable ? 'true' : 'false'}
                data-testid={'instructor-option-' + instructor.id}
                onClick={() => {
                  if (blocked) {
                    if (!selectable) MessagePlugin.warning(instructor.name + ' 的账号已停用，不可选择');
                    else if (already) MessagePlugin.info(instructor.name + ' 已在课程中');
                    return;
                  }
                  onAdd(instructor, role);
                }}
              >
                <span className="instructor-picker__avatar" aria-hidden="true">{instructor.name.slice(0, 1)}</span>
                <span className="instructor-picker__meta">
                  <span className="instructor-picker__name">
                    {instructor.name}
                    {instructor.status === 'disabled' ? (
                      <Tag theme="default" variant="light" size="small" className="instructor-picker__badge" data-testid={'disabled-badge-' + instructor.id}>
                        已停用
                      </Tag>
                    ) : null}
                    {already ? (
                      <Tag theme="success" variant="light" size="small">已添加</Tag>
                    ) : null}
                  </span>
                  <span className="instructor-picker__sub">{instructor.title} · {instructor.org} · {instructor.courseCount} 门课</span>
                </span>
              </li>
            );
          })}
          {!loading && list.length === 0 ? <li className="instructor-picker__empty">没有匹配的讲师</li> : null}
        </ul>
      ) : null}

      <div className="instructor-picker__rolebar">
        <span className="instructor-picker__rolebar-label">新添加的讲师角色</span>
        {INSTRUCTOR_ROLES.map((item) => (
          <Button
            key={item.value}
            size="small"
            variant={role === item.value ? 'base' : 'outline'}
            theme={role === item.value ? 'primary' : 'default'}
            disabled={disabled}
            data-testid={'role-radio-' + item.value}
            onClick={() => setRole(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <ul className="instructor-selected" role="list" data-testid="instructor-selected">
        {selected.length === 0 ? <li className="instructor-selected__empty">尚未添加讲师，至少需要 1 名主讲</li> : null}
        {selected.map((entry, index) => (
          <li className="instructor-selected__row" key={entry.instructorId} data-instructor-entry={entry.instructorId}>
            <span className="instructor-selected__order">{index + 1}</span>
            <span className="instructor-selected__name">{nameOf(entry.instructorId)}</span>
            <span className="instructor-selected__role">
              {entry.role === 'main' ? (
                <Tag theme="primary" variant="light" size="small">主讲</Tag>
              ) : (
                <select
                  className="instructor-selected__select"
                  value={entry.role}
                  disabled={disabled}
                  aria-label={'角色：' + nameOf(entry.instructorId)}
                  data-testid={'instructor-role-' + entry.instructorId}
                  onChange={(event) => onRoleChange(entry.instructorId, event.target.value as InstructorRole)}
                >
                  {INSTRUCTOR_ROLES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              )}
            </span>
            <span className="instructor-selected__ops">
              <Button
                size="small" variant="text" disabled={disabled || entry.role === 'main'}
                data-testid={'instructor-promote-' + entry.instructorId}
                onClick={() => onPromote(entry.instructorId)}
              >
                设为主讲
              </Button>
              <Button size="small" variant="text" aria-label="上移" disabled={disabled || index === 0} onClick={() => onMove(index, index - 1)}>
                <ChevronUpIcon />
              </Button>
              <Button size="small" variant="text" aria-label="下移" disabled={disabled || index === selected.length - 1} onClick={() => onMove(index, index + 1)}>
                <ChevronDownIcon />
              </Button>
              <Button size="small" variant="text" theme="danger" aria-label="移除" disabled={disabled} data-testid={'instructor-remove-' + entry.instructorId} onClick={() => onRemove(entry.instructorId)}>
                <DeleteIcon />
              </Button>
            </span>
          </li>
        ))}
      </ul>

      <p className="instructor-picker__note">
        <AddIcon /> 至少 1 名主讲；停用账号在讲师库中置灰且不可选中。角色：{INSTRUCTOR_ROLES.map((i) => i.label).join(' / ')}。
        当前已选 {selected.length} 人（{selected.filter((i) => i.role === 'main').length} 名主讲）。
      </p>
    </div>
  );
}

function nameOf(id: string): string {
  const found = INSTRUCTOR_LOOKUP.get(id);
  return found ?? id;
}

/** 讲师姓名查表：只用于展示，数据源仍是讲师库 mock */
const INSTRUCTOR_LOOKUP = new Map<string, string>();
export function registerInstructorNames(list: Instructor[]): void {
  for (const item of list) INSTRUCTOR_LOOKUP.set(item.id, item.name);
}

export { ROLE_LABEL };
export default InstructorPicker;
