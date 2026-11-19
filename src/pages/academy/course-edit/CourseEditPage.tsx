import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Input, MessagePlugin, Select, Tag } from 'tdesign-react';
import { ArrowLeftIcon, LockOnIcon, SaveIcon, SendIcon } from 'tdesign-icons-react';
import type {
  CourseFormState,
  CourseStatus,
  Instructor,
  InstructorRole,
  OutlineItem,
  SectionKey,
  ValidationIssue,
} from '../../../types/domain.ts';
import { LIMITS, SECTION_LABEL, SECTION_ORDER, htmlToText, toFormState, toSavePayload } from '../../../domain/form.ts';
import { groupBySection, serverValidate, summarize, validate } from '../../../domain/validation.ts';
import { fetchCourse, newCourseId, saveDraft, submitReview } from '../../../api/courseApi.ts';
import { BENEFIT_MODE_OPTIONS, CATEGORY_OPTIONS, DELIVERY_MODE_OPTIONS, INSTRUCTOR_ROLES, VISIBILITY_OPTIONS } from '../../../mocks/taxonomy.ts';
import { INSTRUCTORS } from '../../../mocks/instructors.ts';
import { SectionCard } from '../../../components/SectionCard.tsx';
import { CoverUploader } from '../../../components/CoverUploader.tsx';
import { RichTextEditor } from '../../../components/RichTextEditor.tsx';
import { OutlineEditor } from '../../../components/OutlineEditor.tsx';
import { InstructorPicker, registerInstructorNames } from '../../../components/InstructorPicker.tsx';
import { TagPicker } from '../../../components/TagPicker.tsx';
import { CoursePreviewCard } from '../../../components/CoursePreviewCard.tsx';
import { LeaveConfirmDialog } from '../../../components/LeaveConfirmDialog.tsx';
import { useCourseEditor } from './useCourseEditor.ts';
import { useLeaveGuard } from '../../../hooks/useLeaveGuard.ts';

registerInstructorNames(INSTRUCTORS);

/** 空表单，新建课程时使用 */
function emptyForm(id: string): CourseFormState {
  return {
    id,
    status: 'draft',
    title: '',
    subtitle: '',
    categoryId: '',
    deliveryMode: '',
    visibility: '',
    benefitMode: '',
    coverUrl: '',
    coverName: '',
    introHtml: '',
    outline: [],
    outcomes: [],
    instructors: [],
    tags: [],
  };
}

export function CourseEditPage() {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isNew = !params.id;
  const courseId = params.id ?? newCourseId();

  const [initial, setInitial] = useState<CourseFormState | null>(null);
  const [status, setStatus] = useState<CourseStatus>('draft');
  const [serverIssues, setServerIssues] = useState<ValidationIssue[]>([]);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>('');
  const [savedOrder, setSavedOrder] = useState<string[]>([]);
  const [dragSteps, setDragSteps] = useState<number>(0);
  const [pasteEvidence, setPasteEvidence] = useState<{ before: number; after: number; removed: string[] } | null>(null);
  const outlineSeq = useRef(0);

  useEffect(() => {
    let alive = true;
    setInitial(null);
    void (async () => {
      try {
        const record = isNew ? null : await fetchCourse(courseId);
        if (!alive) return;
        const form = record ? toFormState(record) : emptyForm(courseId);
        setInitial(form);
        setStatus(record ? record.status : 'draft');
        setSavedOrder((record?.outline ?? []).map((item: OutlineItem) => item.title));
      } catch (error) {
        if (!alive) return;
        MessagePlugin.error(error instanceof Error ? error.message : '课程加载失败');
      }
    })();
    return () => { alive = false; };
  }, [courseId, isNew]);

  // 加载完成前给一个稳定的占位，避免 hooks 顺序随 loading 变化
  const editor = useCourseEditor(initial ?? emptyForm(courseId));
  const syncedRef = useRef<string | null>(null);

  // 课程加载完成后把表单基线同步进来：reducer 的初值只取一次，
  // 不做这一步的话编辑器会停留在空占位表单上（脏检查也会一直为 false）。
  useEffect(() => {
    if (!initial) return;
    const key = initial.id + '|' + initial.status;
    if (syncedRef.current === key) return;
    syncedRef.current = key;
    editor.reset(initial);
  }, [initial, editor]);

  const readonly = status === 'published';
  const dirty = editor.dirty;
  const guard = useLeaveGuard(dirty);

  const frontIssues = useMemo(() => (submitAttempted ? validate(editor.state) : []), [submitAttempted, editor.state]);
  const visibleIssues = useMemo(() => {
    const merged = [...frontIssues];
    for (const item of serverIssues) {
      if (!merged.some((existing) => existing.section === item.section && existing.field === item.field)) {
        merged.push(item);
      }
    }
    return merged;
  }, [frontIssues, serverIssues]);
  const issuesBySection = useMemo(() => groupBySection(visibleIssues), [visibleIssues]);

  const handleSave = useCallback(async () => {
    if (readonly) {
      MessagePlugin.warning('课程已发布，需下架后才能修改');
      return;
    }
    setSaving(true);
    try {
      const payload = toSavePayload(editor.state);
      const saved = await saveDraft(payload);
      editor.reset(toFormState(saved));
      setLastSavedAt(saved.updatedAt);
      setSavedOrder(payload.outline.map((item) => item.title));
      setSubmitAttempted(false);
      setServerIssues([]);
      MessagePlugin.success('草稿已保存：' + payload.outline.length + ' 个章节，顺序已落库');
    } catch (error) {
      MessagePlugin.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }, [editor, readonly]);

  const handleSubmit = useCallback(async () => {
    if (readonly) {
      MessagePlugin.warning('课程已发布，需下架后才能提交审核');
      return;
    }
    setSubmitAttempted(true);
    const front = validate(editor.state);
    const payload = toSavePayload(editor.state);
    const server = serverValidate(editor.state);
    setSubmitting(true);
    try {
      // 先保存草稿，确保后端拿到的是当前表单内容
      if (front.length === 0) {
        const saved = await saveDraft(payload);
        editor.reset(toFormState(saved));
        setSavedOrder(payload.outline.map((item) => item.title));
      }
      const result = await submitReview(payload, server);
      setServerIssues(result.missing);
      if (result.ok) {
        setStatus('in_review');
        MessagePlugin.success('已提交审核（审核单号 ' + (result.reviewId ?? '') + '）');
      } else {
        MessagePlugin.error('提交被拦截：后端返回 ' + result.missing.length + ' 个缺失项');
      }
    } catch (error) {
      MessagePlugin.error(error instanceof Error ? error.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  }, [editor, readonly]);

  const handleAddOutline = useCallback(() => {
    if (readonly) return;
    outlineSeq.current += 1;
    editor.addOutline('ol_new_' + String(outlineSeq.current).padStart(2, '0'));
  }, [editor, readonly]);

  const handleAddInstructor = useCallback((instructor: Instructor, role: (typeof INSTRUCTOR_ROLES)[number]['value']) => {
    if (readonly) return;
    if (instructor.status === 'disabled') return;
    editor.addInstructor(instructor, role);
  }, [editor, readonly]);

  const handleDragStep = useCallback(() => setDragSteps((v) => v + 1), []);

  const handlePasteEvidence = useCallback((detail: { before: string; after: string }) => {
    const strip = (html: string) => html.replace(/<[^>]*>/g, '');
    setPasteEvidence({
      before: detail.before.length,
      after: detail.after.length,
      removed: [
        'style',
        'class',
        'font',
        'color',
        'table',
        'script',
      ].filter((token) => detail.before.toLowerCase().includes(token) && !detail.after.toLowerCase().includes(token)),
    });
    void strip;
  }, []);

  if (initial === null) {
    return (
      <div className="edit-page edit-page--loading" data-testid="course-edit-loading">
        <span>正在加载课程…</span>
      </div>
    );
  }

  const introLength = htmlToText(editor.state.introHtml).length;

  return (
    <div className="edit-page" data-testid="course-edit-page" data-course-status={status} data-dirty={dirty ? 'true' : 'false'} data-readonly={readonly ? 'true' : 'false'}>
      <header className="edit-page__bar">
        <button type="button" className="edit-page__back" data-testid="back-link" onClick={() => navigate('/academy/courses')}>
          <ArrowLeftIcon /> 返回课程列表
        </button>

        <div className="edit-page__identity">
          <h1 className="edit-page__title" data-testid="page-title">
            {isNew ? '新建课程' : '编辑课程'}
            <Tag theme={status === 'published' ? 'success' : status === 'in_review' ? 'warning' : 'default'} variant="light" size="small">
              {status === 'published' ? '已发布' : status === 'in_review' ? '审核中' : '草稿'}
            </Tag>
          </h1>
          <span className="edit-page__meta" data-testid="dirty-indicator">
            {readonly ? '只读模式' : dirty ? '有未保存的修改' : '所有修改已保存'}
            {lastSavedAt ? ' · 最近保存 ' + new Date(lastSavedAt).toLocaleTimeString('zh-CN') : ''}
          </span>
        </div>

        <div className="edit-page__actions">
          <Button variant="outline" disabled={readonly || saving} loading={saving} onClick={() => void handleSave()} data-testid="save-draft">
            <SaveIcon /> 保存草稿
          </Button>
          <Button theme="primary" disabled={readonly || submitting} loading={submitting} onClick={() => void handleSubmit()} data-testid="submit-review">
            <SendIcon /> 提交审核
          </Button>
        </div>
      </header>

      {readonly ? (
        <div className="edit-page__banner" data-testid="readonly-banner" role="status">
          <LockOnIcon />
          <span>
            <strong>课程已发布，全部内容只读。</strong>
            需下架后修改：请先在课程列表点「下架」，状态回到草稿后再进入本页编辑。
          </span>
        </div>
      ) : null}

      {visibleIssues.length > 0 ? (
        <div className="edit-page__issues" data-testid="issue-summary" role="alert">
          <Alert
            theme="error"
            title={'提交前需处理 ' + visibleIssues.length + ' 项：' + summarize(visibleIssues)}
            message={
              <ul className="edit-page__issue-list">
                {visibleIssues.map((issue) => (
                  <li key={issue.section + issue.field} data-issue-section={issue.section}>
                    <a href={'#section-' + issue.section}>[{SECTION_LABEL[issue.section]}] {issue.label}：{issue.message}</a>
                  </li>
                ))}
              </ul>
            }
          />
          <p className="edit-page__issue-src">
            其中前端校验 {frontIssues.length} 项；后端返回的缺失项 {serverIssues.length} 项
            {serverIssues.length > 0 ? '（已原样列出，含前端未拦截的服务端规则）' : ''}。
          </p>
        </div>
      ) : null}

      <div className="edit-page__layout">
        <div className="edit-page__form">
          {SECTION_ORDER.map((key, index) => (
            <SectionBlock
              key={key}
              sectionKey={key}
              index={index + 1}
              readonly={readonly}
              editor={editor}
              issues={issuesBySection[key]}
              introLength={introLength}
              onAddOutline={handleAddOutline}
              onAddInstructor={handleAddInstructor}
              onPasteEvidence={handlePasteEvidence}
              onDragStep={handleDragStep}
            />
          ))}

          <footer className="edit-page__foot">
            <div className="edit-page__foot-row">
              <span data-testid="foot-status">{dirty ? '有未保存的修改' : '无未保存修改'}</span>
              <span data-testid="foot-drag-steps">拖动重排次数 {dragSteps}</span>
              {pasteEvidence ? (
                <span data-testid="foot-paste">粘贴已清洗：{pasteEvidence.before} → {pasteEvidence.after} 字符</span>
              ) : null}
            </div>
          </footer>
        </div>

        <CoursePreviewCard state={editor.state} />
      </div>

      <div className="edit-page__evidence" data-testid="evidence-bar" aria-label="取证信息">
        <span>当前基线章节顺序：<code data-testid="saved-order">{savedOrder.join(' | ') || '（空）'}</code></span>
        <span>当前表单章节顺序：<code data-testid="current-order">{editor.state.outline.map((item) => item.title).join(' | ') || '（空）'}</code></span>
        <span>课程介绍 {introLength} / {LIMITS.intro} 字</span>
        <span>大纲拖动步数 {dragSteps}</span>
      </div>

      {guard.blocked ? (
        <LeaveConfirmDialog
          visible
          onStay={() => guard.reset()}
          onLeave={() => guard.proceed()}
        />
      ) : null}
    </div>
  );
}

interface SectionBlockProps {
  sectionKey: SectionKey;
  index: number;
  readonly: boolean;
  editor: ReturnType<typeof useCourseEditor>;
  issues: ValidationIssue[];
  introLength: number;
  onAddOutline: () => void;
  onAddInstructor: (instructor: Instructor, role: InstructorRole) => void;
  onPasteEvidence: (detail: { before: string; after: string }) => void;
  onDragStep: () => void;
}

/**
 * 单个分区。必须定义在模块作用域：
 * 如果写成 CourseEditPage 内部的函数组件，每次父组件重渲染都会产生新的组件类型，
 * React 会卸载重建整棵子树，拖拽 hook 的拖动状态随之丢失（连续拖动只生效第一步），
 * 输入框也会反复失焦。
 */
function SectionBlock(props: SectionBlockProps) {
  const { sectionKey, index, readonly: ro, editor: ed, issues, introLength } = props;

  if (sectionKey === 'basic') {
    return (
      <SectionCard
        sectionKey="basic" index={index} title="基本信息" issues={issues}
        description="标题最多 40 字；封面会居中裁剪为 16:9，单张不超过 5MB。"
        extra={<span className="section-card__counter">{ed.state.title.length} / {LIMITS.title} 字</span>}
      >
        <div className="form-grid">
          <label className="form-row form-row--full">
            <span className="form-row__label">课程标题<em>*</em></span>
            <Input
              value={ed.state.title}
              disabled={ro}
              maxlength={LIMITS.title}
              placeholder="不超过 40 字的课程标题"
              data-testid="input-title"
              onChange={(value) => ed.patchBasic({ title: String(value) })}
            />
            <span className="form-row__hint">已输入 {ed.state.title.length} 字，上限 {LIMITS.title} 字</span>
          </label>

          <label className="form-row form-row--full">
            <span className="form-row__label">副标题</span>
            <Input
              value={ed.state.subtitle}
              disabled={ro}
              maxlength={60}
              placeholder="一句话说明课程价值，会展示在小程序卡片上"
              data-testid="input-subtitle"
              onChange={(value) => ed.patchBasic({ subtitle: String(value) })}
            />
          </label>

          <label className="form-row">
            <span className="form-row__label">类别<em>*</em></span>
            <div className="form-row__control" data-testid="select-category"><Select
              value={ed.state.categoryId}
              disabled={ro}
              options={CATEGORY_OPTIONS}
              placeholder="请选择类别"
              onChange={(value) => ed.patchBasic({ categoryId: String(value ?? '') })}
            />
            </div>
          </label>

          <label className="form-row">
            <span className="form-row__label">交付方式<em>*</em></span>
            <div className="form-row__control" data-testid="select-delivery"><Select
              value={ed.state.deliveryMode}
              disabled={ro}
              options={DELIVERY_MODE_OPTIONS}
              placeholder="请选择交付方式"
              onChange={(value) => ed.patchBasic({ deliveryMode: String(value ?? '') as CourseFormState['deliveryMode'] })}
            />
            </div>
          </label>

          <label className="form-row">
            <span className="form-row__label">可见范围<em>*</em></span>
            <div className="form-row__control" data-testid="select-visibility"><Select
              value={ed.state.visibility}
              disabled={ro}
              options={VISIBILITY_OPTIONS}
              placeholder="请选择可见范围"
              onChange={(value) => ed.patchBasic({ visibility: String(value ?? '') as CourseFormState['visibility'] })}
            />
            </div>
          </label>

          <label className="form-row">
            <span className="form-row__label">权益方式<em>*</em></span>
            <div className="form-row__control" data-testid="select-benefit"><Select
              value={ed.state.benefitMode}
              disabled={ro}
              options={BENEFIT_MODE_OPTIONS}
              placeholder="请选择权益方式"
              onChange={(value) => ed.patchBasic({ benefitMode: String(value ?? '') as CourseFormState['benefitMode'] })}
            />
            </div>
          </label>

          <div className="form-row form-row--full">
            <span className="form-row__label">课程封面<em>*</em></span>
            <CoverUploader
              coverUrl={ed.state.coverUrl}
              coverName={ed.state.coverName}
              disabled={ro}
              onChange={(patch) => ed.patchBasic(patch)}
            />
          </div>
        </div>
      </SectionCard>
    );
  }

  if (sectionKey === 'intro') {
    return (
      <SectionCard
        sectionKey="intro" index={index} title="课程介绍" issues={issues}
        description="支持加粗、列表、图片与链接；粘贴时会自动清除外部样式，正文不超过 5000 字。"
        extra={<span className={'section-card__counter' + (introLength > LIMITS.intro ? ' is-over' : '')}>{introLength} / {LIMITS.intro} 字</span>}
      >
        <RichTextEditor
          value={ed.state.introHtml}
          disabled={ro}
          onChange={ed.setIntro}
          onPasteSanitized={props.onPasteEvidence}
        />
      </SectionCard>
    );
  }

  if (sectionKey === 'outline') {
    return (
      <SectionCard
        sectionKey="outline" index={index} title="课程大纲" issues={issues}
        description="可拖拽排序：按住左侧手柄上下拖动，顺序会在保存后落库；也可用上移/下移按钮。"
        extra={<Tag variant="light" size="small" theme="primary">拖拽排序</Tag>}
      >
        <OutlineEditor
          items={ed.state.outline}
          disabled={ro}
          onMove={ed.moveOutline}
          onAdd={props.onAddOutline}
          onPatch={ed.patchOutline}
          onRemove={ed.removeOutline}
          onDragStep={props.onDragStep}
        />
      </SectionCard>
    );
  }

  if (sectionKey === 'outcomes') {
    return (
      <SectionCard
        sectionKey="outcomes" index={index} title="学习收获" issues={issues}
        description="最多 8 条，建议每条一句话、以动词开头。"
        extra={<span className="section-card__counter">{ed.state.outcomes.length} / {LIMITS.outcomes} 条</span>}
      >
        <ul className="outcome-list" data-testid="outcome-list">
          {ed.state.outcomes.map((item, i) => (
            <li className="outcome-list__row" key={i} data-outcome-index={i}>
              <span className="outcome-list__seq">{i + 1}</span>
              <Input
                value={item}
                disabled={ro}
                maxlength={60}
                placeholder="例如：搭出一张适合自己业务的增长模型图"
                data-testid={'outcome-input-' + i}
                onChange={(value) => ed.patchOutcome(i, String(value))}
              />
              <Button
                size="small" variant="text" theme="danger" disabled={ro}
                data-testid={'outcome-remove-' + i}
                onClick={() => ed.removeOutcome(i)}
              >
                删除
              </Button>
            </li>
          ))}
        </ul>
        <Button
          size="small" variant="outline"
          disabled={ro || ed.state.outcomes.length >= LIMITS.outcomes}
          data-testid="outcome-add"
          onClick={ed.addOutcome}
        >
          {ed.state.outcomes.length >= LIMITS.outcomes ? '已达 8 条上限' : '添加一条收获'}
        </Button>
      </SectionCard>
    );
  }

  if (sectionKey === 'instructors') {
    return (
      <SectionCard
        sectionKey="instructors" index={index} title="讲师" issues={issues}
        description="从讲师库搜索选择，设置角色与顺序；至少 1 名主讲。已停用的讲师不可选择。"
        extra={<span className="section-card__counter">{ed.state.instructors.length} 人</span>}
      >
        <InstructorPicker
          selected={ed.state.instructors}
          disabled={ro}
          onAdd={props.onAddInstructor}
          onRemove={ed.removeInstructor}
          onRoleChange={ed.setInstructorRole}
          onPromote={ed.promoteInstructor}
          onMove={ed.moveInstructor}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      sectionKey="tags" index={index} title="标签" issues={issues}
      description="从赛道与兴趣话题字典中选择，每个维度最多 3 个，不支持自由输入。"
      extra={<span className="section-card__counter">{ed.state.tags.length} 个</span>}
    >
      <TagPicker tags={ed.state.tags} disabled={ro} onToggle={ed.toggleTag} />
    </SectionCard>
  );
}

export default CourseEditPage;
