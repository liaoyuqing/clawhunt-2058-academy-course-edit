import { describe, expect, it } from 'vitest';
import type { CourseTagSelection } from '../src/types/domain.ts';
import {
  canSelectMore,
  countDimension,
  selectedValues,
  tagProblems,
  toggleTag,
} from '../src/domain/tags.ts';
import { TAG_OPTIONS, TRACK_OPTIONS, TOPIC_OPTIONS, tagLimit } from '../src/mocks/taxonomy.ts';

describe('标签每个维度最多 3 个', () => {
  it('连续选 3 个赛道都成功，第 4 个被拒绝且状态不变', () => {
    let tags: CourseTagSelection[] = [];
    for (const value of ['track_new_retail', 'track_saas', 'track_content']) {
      const outcome = toggleTag(tags, 'track', value);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) tags = outcome.next;
    }
    expect(countDimension(tags, 'track')).toBe(3);
    expect(canSelectMore(tags, 'track')).toBe(false);

    const rejected = toggleTag(tags, 'track', 'track_manufacturing');
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.reason).toBe('limit');
    expect(countDimension(tags, 'track')).toBe(3);
    expect(tags.map((t) => t.value)).not.toContain('track_manufacturing');
  });

  it('赛道满 3 个时，兴趣话题仍然可以继续选（两个维度独立计数）', () => {
    let tags: CourseTagSelection[] = [
      { dimension: 'track', value: 'track_saas' },
      { dimension: 'track', value: 'track_content' },
      { dimension: 'track', value: 'track_finance' },
    ];
    expect(canSelectMore(tags, 'track')).toBe(false);
    expect(canSelectMore(tags, 'topic')).toBe(true);

    const outcome = toggleTag(tags, 'topic', 'topic_growth');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    tags = outcome.next;
    expect(countDimension(tags, 'track')).toBe(3);
    expect(countDimension(tags, 'topic')).toBe(1);
  });

  it('取消已选后立刻可以再选回来（上限是软约束不是锁死）', () => {
    let tags: CourseTagSelection[] = [
      { dimension: 'track', value: 'track_saas' },
      { dimension: 'track', value: 'track_content' },
      { dimension: 'track', value: 'track_finance' },
    ];
    const removed = toggleTag(tags, 'track', 'track_saas');
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    tags = removed.next;
    expect(canSelectMore(tags, 'track')).toBe(true);
    const added = toggleTag(tags, 'track', 'track_manufacturing');
    expect(added.ok).toBe(true);
  });

  it('已选数量不会超过上限（穷举全部赛道逐个尝试）', () => {
    let tags: CourseTagSelection[] = [];
    for (const option of TRACK_OPTIONS) {
      const outcome = toggleTag(tags, 'track', option.value);
      if (outcome.ok) tags = outcome.next;
    }
    expect(countDimension(tags, 'track')).toBe(3);
    expect(countDimension(tags, 'track')).toBeLessThanOrEqual(tagLimit('track'));
  });

  it('toggle 不可变：原数组不被修改', () => {
    const before: CourseTagSelection[] = [{ dimension: 'track', value: 'track_saas' }];
    const snapshot = JSON.stringify(before);
    toggleTag(before, 'topic', 'topic_ai');
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('selectedValues 只返回指定维度的值', () => {
    const tags: CourseTagSelection[] = [
      { dimension: 'track', value: 'track_saas' },
      { dimension: 'topic', value: 'topic_growth' },
    ];
    expect(selectedValues(tags, 'track')).toEqual(['track_saas']);
    expect(selectedValues(tags, 'topic')).toEqual(['topic_growth']);
  });
});

describe('标签校验与字典边界', () => {
  it('两个维度都为空时各报一条问题', () => {
    const problems = tagProblems([]);
    expect(problems).toHaveLength(2);
    expect(problems.every((p) => p.message.includes('至少'))).toBe(true);
  });

  it('两个维度都有值时不报问题', () => {
    const tags: CourseTagSelection[] = [
      { dimension: 'track', value: 'track_saas' },
      { dimension: 'topic', value: 'topic_growth' },
    ];
    expect(tagProblems(tags)).toHaveLength(0);
  });

  it('字典里没有自由输入的空值：所有可选项 value 都来自固定字典', () => {
    for (const option of [...TRACK_OPTIONS, ...TOPIC_OPTIONS]) {
      expect(option.value.length).toBeGreaterThan(0);
      expect(option.label.length).toBeGreaterThan(0);
    }
    expect(TAG_OPTIONS.track).toEqual(TRACK_OPTIONS);
    expect(TAG_OPTIONS.topic).toEqual(TOPIC_OPTIONS);
  });

  it('toggle 一个不在字典里的自由输入值不会被任何 UI 触发（领域层不校验，UI 只渲染字典项）', () => {
    // 这里断言的是"UI 只渲染字典项"的数据来源：TAG_OPTIONS 里的 value 集合是封闭的
    const allowed = new Set([...TRACK_OPTIONS, ...TOPIC_OPTIONS].map((o) => o.value));
    expect(allowed.size).toBe(TRACK_OPTIONS.length + TOPIC_OPTIONS.length);
    expect(allowed.has('自由输入的任何文本')).toBe(false);
  });
});
