import type { CourseFormState } from '../types/domain.ts';
import { DELIVERY_LABEL, BENEFIT_LABEL, ROLE_LABEL } from '../mocks/taxonomy.ts';
import { humanDuration, totalDuration } from '../domain/form.ts';
import { INSTRUCTORS } from '../mocks/instructors.ts';

export interface CoursePreviewCardProps {
  state: CourseFormState;
}

/**
 * 右侧实时预览：按小程序课程卡片的实际字段顺序渲染。
 * 所有字段直接来自当前表单状态，表单改动即时反映，用于"所见即所存"的演示。
 */
export function CoursePreviewCard({ state }: CoursePreviewCardProps) {
  const cover = state.coverUrl;
  const mainInstructor = state.instructors.find((item) => item.role === 'main');
  const mainName = mainInstructor
    ? INSTRUCTORS.find((item) => item.id === mainInstructor.instructorId)?.name ?? ''
    : '';
  const outlineCount = state.outline.length;
  const duration = humanDuration(totalDuration(state.outline));

  return (
    <aside className="preview-pane" data-testid="preview-card" aria-label="小程序课程卡片预览">
      <div className="preview-pane__title">
        <span>小程序预览</span>
        <span className="preview-pane__live" aria-live="polite">实时</span>
      </div>

      <div className="preview-card">
        <div className="preview-card__cover">
          {cover ? (
            <img src={cover} alt="" className="preview-card__img" />
          ) : (
            <span className="preview-card__cover-empty">16:9 封面预览</span>
          )}
          <span className="preview-card__status">{state.status === 'published' ? '已发布' : state.status === 'in_review' ? '审核中' : '草稿'}</span>
        </div>

        <div className="preview-card__body">
          <h3 className="preview-card__title" data-testid="preview-title">
            {state.title.trim() || '未命名课程'}
          </h3>
          <p className="preview-card__subtitle" data-testid="preview-subtitle">
            {state.subtitle.trim() || '副标题会展示在这里'}
          </p>

          <div className="preview-card__tags">
            {state.tags.length === 0 ? <span className="preview-card__tag-empty">暂无标签</span> : null}
            {state.tags.map((tag) => (
              <span className="preview-card__tag" key={tag.dimension + tag.value}>
                {labelOfTag(tag.dimension, tag.value)}
              </span>
            ))}
          </div>

          <ul className="preview-card__facts">
            <li><span>章节</span><strong>{outlineCount} 章</strong></li>
            <li><span>时长</span><strong>{duration}</strong></li>
            <li><span>交付</span><strong>{DELIVERY_LABEL[state.deliveryMode] ?? '未选择'}</strong></li>
            <li><span>权益</span><strong>{BENEFIT_LABEL[state.benefitMode] ?? '未选择'}</strong></li>
          </ul>

          <div className="preview-card__outcomes">
            <span className="preview-card__outcomes-title">学完你将获得</span>
            {state.outcomes.filter((item) => item.trim().length > 0).slice(0, 3).length === 0 ? (
              <span className="preview-card__empty">尚未填写学习收获</span>
            ) : (
              <ul>
                {state.outcomes.filter((item) => item.trim().length > 0).slice(0, 3).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="preview-card__instructor">
            <span className="preview-card__avatar" aria-hidden="true">{mainName.slice(0, 1) || '讲'}</span>
            <span>
              <strong>{mainName || '待选择主讲'}</strong>
              <em>{mainInstructor ? ROLE_LABEL[mainInstructor.role] : ''}</em>
            </span>
          </div>

          <div className="preview-card__cta">立即学习</div>
        </div>
      </div>

      <div className="preview-pane__hint">
        <span>预览与保存结果同源：字段改动即时同步，保存后刷新保持一致。</span>
      </div>
    </aside>
  );
}

function labelOfTag(dimension: string, value: string): string {
  const dict = dimension === 'track' ? TRACK_LABELS : TOPIC_LABELS;
  return dict[value] ?? value;
}

const TRACK_LABELS: Record<string, string> = { track_new_retail: '新零售', track_saas: '企业服务 SaaS', track_content: '内容与社区', track_manufacturing: '智能制造', track_finance: '金融科技' };
const TOPIC_LABELS: Record<string, string> = { topic_growth: '用户增长', topic_retention: '留存与复购', topic_data: '数据分析', topic_management: '团队管理', topic_service: '客户成功', topic_ai: 'AI 应用' };

export default CoursePreviewCard;
