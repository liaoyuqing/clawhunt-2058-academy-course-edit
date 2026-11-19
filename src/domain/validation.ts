import type {
  CourseFormState,
  SectionKey,
  ValidationIssue,
} from '../types/domain.ts';
import { LIMITS, SECTION_LABEL, htmlToText, totalDuration } from './form.ts';
import { mainInstructorCount } from './instructors.ts';
import { tagProblems } from './tags.ts';

/**
 * 前端校验。与后端共用 ValidationIssue 结构，页面把两份问题合并展示：
 * 前端先拦明显不合法，后端返回的缺失项列表原样贴到对应分区。
 */

function issue(section: SectionKey, field: string, label: string, message: string): ValidationIssue {
  return { section, field, label, message };
}

export function validate(state: CourseFormState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 基本信息
  const title = state.title.trim();
  if (title.length === 0) {
    issues.push(issue('basic', 'title', '课程标题', '必填'));
  } else if (title.length > LIMITS.title) {
    issues.push(issue('basic', 'title', '课程标题', '不能超过 ' + LIMITS.title + ' 字'));
  }
  if (!state.categoryId) issues.push(issue('basic', 'categoryId', '类别', '必选'));
  if (!state.deliveryMode) issues.push(issue('basic', 'deliveryMode', '交付方式', '必选'));
  if (!state.visibility) issues.push(issue('basic', 'visibility', '可见范围', '必选'));
  if (!state.benefitMode) issues.push(issue('basic', 'benefitMode', '权益方式', '必选'));
  if (!state.coverUrl) issues.push(issue('basic', 'coverUrl', '课程封面', '必传'));

  // 课程介绍
  const introLength = htmlToText(state.introHtml).length;
  if (introLength === 0) {
    issues.push(issue('intro', 'introHtml', '课程介绍', '必填'));
  } else if (introLength > LIMITS.intro) {
    issues.push(issue('intro', 'introHtml', '课程介绍', '不能超过 ' + LIMITS.intro + ' 字（当前 ' + introLength + ' 字）'));
  }

  // 课程大纲
  if (state.outline.length === 0) {
    issues.push(issue('outline', 'outline', '课程大纲', '至少 1 个条目'));
  }
  state.outline.forEach((item, index) => {
    if (item.title.trim().length === 0) {
      issues.push(issue('outline', 'outline.' + item.id + '.title', '大纲第 ' + (index + 1) + ' 条标题', '必填'));
    }
    if (!Number.isFinite(item.durationMinutes) || item.durationMinutes <= 0) {
      issues.push(issue('outline', 'outline.' + item.id + '.duration', '大纲第 ' + (index + 1) + ' 条时长', '需大于 0 分钟'));
    }
  });
  if (state.outline.length > 0 && totalDuration(state.outline) <= 0) {
    issues.push(issue('outline', 'outline.total', '课程总时长', '需大于 0 分钟'));
  }

  // 学习收获
  if (state.outcomes.length > LIMITS.outcomes) {
    issues.push(issue('outcomes', 'outcomes', '学习收获', '最多 ' + LIMITS.outcomes + ' 条'));
  }
  state.outcomes.forEach((item, index) => {
    if (item.trim().length === 0) {
      issues.push(issue('outcomes', 'outcomes.' + index, '学习收获第 ' + (index + 1) + ' 条', '不能为空'));
    }
  });

  // 讲师
  if (state.instructors.length === 0) {
    issues.push(issue('instructors', 'instructors', '讲师', '至少添加 1 名讲师'));
  } else if (mainInstructorCount(state.instructors) < 1) {
    issues.push(issue('instructors', 'instructors.main', '主讲', '至少 1 名主讲'));
  }

  // 标签
  for (const problem of tagProblems(state.tags)) {
    const label = problem.dimension === 'track' ? '赛道' : '兴趣话题';
    issues.push(issue('tags', problem.dimension, label, problem.message));
  }

  return issues;
}

/**
 * 服务端校验的本地实现，用于模拟"提交审核后返回缺失项列表"。
 * 故意与前端校验不同源：它多拦一条"副标题建议填写"，用来证明
 * 页面展示的缺失项确实来自后端返回，而不是把前端校验结果复用一遍。
 */
export function serverValidate(state: CourseFormState): ValidationIssue[] {
  const issues = validate(state);
  if (state.subtitle.trim().length === 0) {
    issues.push(issue('basic', 'subtitle', '课程副标题', '服务端要求填写：用于小程序卡片展示'));
  }
  return issues;
}

/** 按分区聚合，渲染时每个分区下方直接列出自己的问题 */
export function groupBySection(issues: ValidationIssue[]): Record<SectionKey, ValidationIssue[]> {
  const grouped: Record<SectionKey, ValidationIssue[]> = {
    basic: [], intro: [], outline: [], outcomes: [], instructors: [], tags: [],
  };
  for (const item of issues) grouped[item.section].push(item);
  return grouped;
}

/** 汇总文案："基本信息 2 项、课程介绍 1 项"，用于顶部提示 */
export function summarize(issues: ValidationIssue[]): string {
  const grouped = groupBySection(issues);
  const parts = (Object.keys(grouped) as SectionKey[])
    .filter((key) => grouped[key].length > 0)
    .map((key) => SECTION_LABEL[key] + ' ' + grouped[key].length + ' 项');
  return parts.join('、');
}
