import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { disabledList, flush, isDisabled, renderAt } from './helpers.tsx';
import { C_DRAFT_ID, C_PUBLISHED_ID } from '../src/mocks/courses.ts';

describe('AC2：停用讲师在选择器中不可选中', () => {
  it('讲师库渲染出停用讲师，但标记为不可选，点击后不会进入已选列表', async () => {
    renderAt('/academy/courses/' + C_DRAFT_ID + '/edit');
    await waitFor(() => expect(screen.getByTestId('instructor-search')).toBeInTheDocument());
    await flush();

    fireEvent.click(screen.getByTestId('instructor-toggle'));
    await flush();

    const disabledOption = await screen.findByTestId('instructor-option-ins_9004');
    expect(disabledOption.getAttribute('data-instructor-status')).toBe('disabled');
    expect(disabledOption.getAttribute('data-selectable')).toBe('false');
    expect(disabledOption.getAttribute('aria-disabled')).toBe('true');

    expect(screen.getByTestId('disabled-badge-ins_9004')).toBeInTheDocument();

    fireEvent.click(disabledOption);
    await flush();

    expect(screen.queryByTestId('instructor-remove-ins_9004')).toBeNull();
    expect(screen.getAllByTestId('instructor-selected')).toHaveLength(1);
  });

  it('第 2 位停用讲师同样不可选（边界枚举）', async () => {
    renderAt('/academy/courses/' + C_DRAFT_ID + '/edit');
    await waitFor(() => expect(screen.getByTestId('instructor-search')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('instructor-toggle'));
    await flush();

    const option = await screen.findByTestId('instructor-option-ins_9005');
    expect(option.getAttribute('data-selectable')).toBe('false');
    fireEvent.click(option);
    await flush();
    expect(screen.queryByTestId('instructor-remove-ins_9005')).toBeNull();
  });

  it('可选讲师（active）点击后进入已选列表（对照组，证明上面的失败不是整体坏掉）', async () => {
    renderAt('/academy/courses/' + C_DRAFT_ID + '/edit');
    await waitFor(() => expect(screen.getByTestId('instructor-search')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('instructor-toggle'));
    await flush();

    const option = await screen.findByTestId('instructor-option-ins_9002');
    expect(option.getAttribute('data-selectable')).toBe('true');
    fireEvent.click(option);
    await flush();

    await waitFor(() => expect(screen.getByTestId('instructor-remove-ins_9002')).toBeInTheDocument());
  });
});

describe('AC4：published 课程全部只读', () => {
  it('进入 published 课程显示「需下架后修改」提示条', async () => {
    renderAt('/academy/courses/' + C_PUBLISHED_ID + '/edit');
    const banner = await screen.findByTestId('readonly-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain('需下架后修改');
    expect(screen.getByTestId('course-edit-page').getAttribute('data-readonly')).toBe('true');
    expect(screen.getByTestId('course-edit-page').getAttribute('data-course-status')).toBe('published');
  });

  it('基本信息所有输入被禁用', async () => {
    renderAt('/academy/courses/' + C_PUBLISHED_ID + '/edit');
    await screen.findByTestId('readonly-banner');

    expect(isDisabled('input-title')).toBe(true);
    expect(isDisabled('input-subtitle')).toBe(true);
    expect(isDisabled('select-category')).toBe(true);
    expect(isDisabled('select-delivery')).toBe(true);
    expect(isDisabled('select-visibility')).toBe(true);
    expect(isDisabled('select-benefit')).toBe(true);
    expect(isDisabled('cover-pick')).toBe(true);
  });

  it('富文本编辑器不可编辑，工具栏按钮全部禁用', async () => {
    renderAt('/academy/courses/' + C_PUBLISHED_ID + '/edit');
    await screen.findByTestId('readonly-banner');

    const editor = screen.getByTestId('intro-editor');
    expect(editor.getAttribute('contenteditable')).toBe('false');
    expect(editor.getAttribute('aria-readonly')).toBe('true');

    const toolbarButtons = document.querySelectorAll('.richtext__btn');
    expect(toolbarButtons.length).toBeGreaterThan(0);
    toolbarButtons.forEach((btn) => expect((btn as HTMLButtonElement).disabled).toBe(true));
  });

  it('大纲拖动把手 aria-disabled=true，上下移/删除按钮全部禁用', async () => {
    renderAt('/academy/courses/' + C_PUBLISHED_ID + '/edit');
    await screen.findByTestId('readonly-banner');

    const handles = document.querySelectorAll('[data-drag-handle]');
    expect(handles.length).toBeGreaterThan(0);
    handles.forEach((handle) => {
      expect(handle.getAttribute('aria-disabled')).toBe('true');
      expect(handle.getAttribute('tabindex')).toBe('-1');
    });

    const removeButtons = disabledList('outline-remove-');
    expect(removeButtons.length).toBeGreaterThan(0);
    expect(removeButtons.every((item) => item.disabled)).toBe(true);

    const titleInputs = disabledList('outline-title-');
    expect(titleInputs.length).toBeGreaterThan(0);
    expect(titleInputs.every((item) => item.disabled)).toBe(true);
  });

  it('学习收获输入禁用且「添加」按钮不可用', async () => {
    renderAt('/academy/courses/' + C_PUBLISHED_ID + '/edit');
    await screen.findByTestId('readonly-banner');
    const inputs = disabledList('outcome-input-');
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every((item) => item.disabled)).toBe(true);
    expect(isDisabled('outcome-add')).toBe(true);
  });

  it('讲师选择器与已选讲师操作全部只读', async () => {
    renderAt('/academy/courses/' + C_PUBLISHED_ID + '/edit');
    await screen.findByTestId('readonly-banner');

    expect(isDisabled('instructor-search')).toBe(true);
    const removeButtons = disabledList('instructor-remove-');
    expect(removeButtons.length).toBeGreaterThan(0);
    expect(removeButtons.every((item) => item.disabled)).toBe(true);

    const selects = document.querySelectorAll('.instructor-selected__select');
    expect(selects.length).toBeGreaterThan(0);
    selects.forEach((select) => expect((select as HTMLSelectElement).disabled).toBe(true));
  });

  it('标签选项 aria-disabled 全为 true，点击不改变已选数量', async () => {
    renderAt('/academy/courses/' + C_PUBLISHED_ID + '/edit');
    await screen.findByTestId('readonly-banner');

    const chips = document.querySelectorAll('.tag-picker__chip');
    expect(chips.length).toBeGreaterThan(0);
    chips.forEach((chip) => expect(chip.getAttribute('aria-disabled')).toBe('true'));

    const countBefore = screen.getByTestId('tag-count-track').textContent;
    const unchecked = document.querySelector('.tag-picker__chip[data-checked="false"]');
    expect(unchecked).not.toBeNull();
    if (unchecked) fireEvent.click(unchecked);
    await flush();
    expect(screen.getByTestId('tag-count-track').textContent).toBe(countBefore);
  });

  it('保存草稿与提交审核按钮被禁用', async () => {
    renderAt('/academy/courses/' + C_PUBLISHED_ID + '/edit');
    await screen.findByTestId('readonly-banner');
    expect(isDisabled('save-draft')).toBe(true);
    expect(isDisabled('submit-review')).toBe(true);
  });
});

describe('草稿课程不是只读（对照）', () => {
  it('draft 课程没有提示条，输入可编辑', async () => {
    renderAt('/academy/courses/' + C_DRAFT_ID + '/edit');
    await waitFor(() => expect(screen.getByTestId('input-title')).toBeInTheDocument());
    expect(screen.queryByTestId('readonly-banner')).toBeNull();
    expect(isDisabled('input-title')).toBe(false);
    expect(screen.getByTestId('intro-editor').getAttribute('contenteditable')).toBe('true');
    expect(isDisabled('save-draft')).toBe(false);
  });
});
