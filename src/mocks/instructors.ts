import type { Instructor } from '../types/domain.ts';

/**
 * 讲师库（S2-IAM / 学院讲师档案）的本地桩。
 * 全部为虚构示例数据：人名、机构、履历均不对应真实个人或企业。
 * 其中 2 位 status = 'disabled'（已停用），用于验证"停用讲师不可选"。
 */
export const INSTRUCTORS: Instructor[] = [
  {
    id: 'ins_9001',
    name: '沈知微',
    title: '增长负责人（示例）',
    org: '示例科技',
    bio: '虚构示例数据：负责会员增长与留存体系搭建。',
    status: 'active',
    courseCount: 6,
  },
  {
    id: 'ins_9002',
    name: '陆行舟',
    title: '产品总监（示例）',
    org: '示例科技',
    bio: '虚构示例数据：主导多个企业服务产品的 0 到 1。',
    status: 'active',
    courseCount: 11,
  },
  {
    id: 'ins_9003',
    name: '苏晚棠',
    title: '数据分析专家（示例）',
    org: '示例研究院',
    bio: '虚构示例数据：擅长指标体系与实验设计。',
    status: 'active',
    courseCount: 4,
  },
  {
    id: 'ins_9004',
    name: '何叙白',
    title: '前运营负责人（已停用）',
    org: '示例科技',
    bio: '虚构示例数据：账号已停用，不应出现在可选列表中。',
    status: 'disabled',
    courseCount: 2,
  },
  {
    id: 'ins_9005',
    name: '顾南枝',
    title: '外部顾问（已停用）',
    org: '示例咨询',
    bio: '虚构示例数据：合作已结束，账号停用。',
    status: 'disabled',
    courseCount: 0,
  },
];

export function findInstructor(id: string): Instructor | undefined {
  return INSTRUCTORS.find((item) => item.id === id);
}

export function isInstructorSelectable(instructor: Instructor): boolean {
  return instructor.status === 'active';
}
