import { Tag, Tooltip } from 'tdesign-react';
import type { CourseTagSelection, TagDimension } from '../types/domain.ts';
import { TAG_DIMENSIONS, TAG_OPTIONS } from '../mocks/taxonomy.ts';
import { canSelectMore, countDimension, selectedValues } from '../domain/tags.ts';

export interface TagPickerProps {
  tags: CourseTagSelection[];
  disabled: boolean;
  onToggle: (dimension: TagDimension, value: string) => void;
}

/**
 * 标签选择器：只能从字典（赛道 / 兴趣话题）中点选，没有自由输入框。
 * 每个维度上限 3 个；达到上限后该维度其余项置灰不可点。
 */
export function TagPicker({ tags, disabled, onToggle }: TagPickerProps) {
  return (
    <div className="tag-picker" data-testid="tag-picker">
      {TAG_DIMENSIONS.map(({ dimension, label, limit }) => {
        const count = countDimension(tags, dimension);
        const atLimit = !canSelectMore(tags, dimension);
        const chosen = selectedValues(tags, dimension);
        return (
          <div className="tag-picker__dimension" key={dimension} data-dimension={dimension} data-dimension-count={count}>
            <div className="tag-picker__head">
              <span className="tag-picker__label">{label}</span>
              <span className={'tag-picker__counter' + (atLimit ? ' is-full' : '')} data-testid={'tag-count-' + dimension}>
                已选 {count} / {limit}
              </span>
            </div>
            <div className="tag-picker__options" role="group" aria-label={label + '（最多 ' + limit + ' 个）'}>
              {TAG_OPTIONS[dimension].map((option) => {
                const checked = chosen.includes(option.value);
                const blocked = disabled || (!checked && atLimit);
                return (
                  <Tooltip key={option.value} content={!checked && atLimit ? '该维度最多选择 ' + limit + ' 个' : option.label}>
                    <span
                      className={'tag-picker__chip' + (checked ? ' is-checked' : '') + (blocked ? ' is-blocked' : '')}
                      role="checkbox"
                      aria-checked={checked}
                      aria-disabled={blocked}
                      tabIndex={blocked ? -1 : 0}
                      data-testid={'tag-' + dimension + '-' + option.value}
                      data-checked={checked ? 'true' : 'false'}
                      onClick={() => {
                        if (blocked) return;
                        onToggle(dimension, option.value);
                      }}
                      onKeyDown={(event) => {
                        if (blocked) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onToggle(dimension, option.value);
                        }
                      }}
                    >
                      {checked ? <Tag theme="primary" variant="light" size="small">{option.label}</Tag> : <span>{option.label}</span>}
                    </span>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="tag-picker__note">
        标签只能从「赛道 / 兴趣话题」字典中选择，不支持自由输入；每个维度最多 3 个。
      </p>
    </div>
  );
}

export default TagPicker;
