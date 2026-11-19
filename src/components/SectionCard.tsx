import type { ReactNode } from 'react';
import type { SectionKey, ValidationIssue } from '../types/domain.ts';

export interface SectionCardProps {
  sectionKey: SectionKey;
  index: number;
  title: string;
  description?: string;
  /** 分区内的校验问题，直接列在分区底部 */
  issues?: ValidationIssue[];
  /** 分区右上角的补充信息（如字数统计） */
  extra?: ReactNode;
  children: ReactNode;
}

/**
 * 六个分区共用的卡片外壳。每个分区都带 data-section 属性，
 * 截图脚本按它 scrollIntoView + 截图，单测也按它定位分区边界。
 */
export function SectionCard({ sectionKey, index, title, description, issues = [], extra, children }: SectionCardProps) {
  return (
    <section className="section-card" data-section={sectionKey} id={'section-' + sectionKey} aria-labelledby={'section-title-' + sectionKey}>
      <header className="section-card__head">
        <div className="section-card__heading">
          <span className="section-card__index" aria-hidden="true">{String(index).padStart(2, '0')}</span>
          <div>
            <h2 className="section-card__title" id={'section-title-' + sectionKey}>{title}</h2>
            {description ? <p className="section-card__desc">{description}</p> : null}
          </div>
        </div>
        {extra ? <div className="section-card__extra">{extra}</div> : null}
      </header>

      <div className="section-card__body">{children}</div>

      {issues.length > 0 ? (
        <ul className="section-card__issues" data-testid={'issues-' + sectionKey}>
          {issues.map((issue) => (
            <li key={issue.field + issue.message}>
              <span className="dot" aria-hidden="true" />
              <strong>{issue.label}</strong>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default SectionCard;
