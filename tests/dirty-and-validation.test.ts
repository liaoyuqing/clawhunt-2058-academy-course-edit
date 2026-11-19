import { describe, expect, it } from 'vitest';
import { C_DRAFT_ID, C_NEW_ID, readCourse } from '../src/mocks/courses.ts';
import { isDirty, toFormState, toSavePayload, htmlToText } from '../src/domain/form.ts';
import { validate, serverValidate, groupBySection, summarize } from '../src/domain/validation.ts';
import { checkCoverFile, computeCropRect, targetCoverSize } from '../src/domain/cover.ts';
import { checkIntroLength, normalizeRichHtml } from '../src/domain/richtext.ts';

describe('脏检查（AC3 的判定函数）', () => {
  it('刚加载时 isDirty 为 false（这就是不弹窗的条件）', () => {
    const record = readCourse(C_DRAFT_ID);
    if (!record) throw new Error('mock 缺失');
    const form = toFormState(record);
    expect(isDirty(form, { ...form })).toBe(false);
  });

  it('改标题后 isDirty 为 true', () => {
    const record = readCourse(C_DRAFT_ID);
    if (!record) throw new Error('mock 缺失');
    const form = toFormState(record);
    expect(isDirty(form, { ...form, title: form.title + '（改）' })).toBe(true);
  });

  it('改任意一个分区都能被识别：介绍 / 大纲 / 收获 / 讲师 / 标签', () => {
    const record = readCourse(C_DRAFT_ID);
    if (!record) throw new Error('mock 缺失');
    const base = toFormState(record);

    expect(isDirty(base, { ...base, introHtml: base.introHtml + '<p>补充</p>' })).toBe(true);
    expect(isDirty(base, { ...base, outline: [...base.outline, { id: 'x', title: '新章节', durationMinutes: 5 }] })).toBe(true);
    expect(isDirty(base, { ...base, outcomes: [...base.outcomes, '新的收获'] })).toBe(true);
    expect(isDirty(base, { ...base, instructors: base.instructors.slice(0, 1) })).toBe(true);
    expect(isDirty(base, { ...base, tags: base.tags.slice(0, 1) })).toBe(true);
    expect(isDirty(base, { ...base, coverUrl: 'data:image/jpeg;base64,xx' })).toBe(true);
  });

  it('只调换大纲顺序也算修改（顺序影响保存结果）', () => {
    const record = readCourse(C_DRAFT_ID);
    if (!record) throw new Error('mock 缺失');
    const base = toFormState(record);
    const swapped = { ...base, outline: [...base.outline].reverse() };
    expect(isDirty(base, swapped)).toBe(true);
    // 保存请求体里的 order 也随之改变
    expect(toSavePayload(base).outline.map((i) => i.title)).not.toEqual(toSavePayload(swapped).outline.map((i) => i.title));
  });

  it('保存后用返回记录重建表单，isDirty 回到 false', () => {
    const record = readCourse(C_DRAFT_ID);
    if (!record) throw new Error('mock 缺失');
    const base = toFormState(record);
    const edited = { ...base, title: '新标题' };
    const payload = toSavePayload(edited);
    // 用请求体还原一次落库记录（与 saveDraft 的映射一致）
    const saved = {
      ...record, ...edited, title: payload.title,
      outline: payload.outline.map((i) => ({ id: i.id, title: i.title, durationMinutes: i.durationMinutes })),
      updatedAt: '2026-11-17T00:00:00+08:00',
    };
    const reloaded = toFormState(saved);
    expect(isDirty(reloaded, { ...reloaded })).toBe(false);
    expect(isDirty(edited, { ...edited })).toBe(false);
  });
});

describe('提交前校验与后端缺失项（AC3 之后的必填校验）', () => {
  it('完整草稿没有前端校验问题', () => {
    const record = readCourse(C_DRAFT_ID);
    if (!record) throw new Error('mock 缺失');
    expect(validate(toFormState(record))).toHaveLength(0);
  });

  it('空课程几乎每个分区都报缺失，且问题按分区归类', () => {
    const record = readCourse(C_NEW_ID);
    if (!record) throw new Error('mock 缺失');
    const issues = validate(toFormState(record));
    expect(issues.length).toBeGreaterThanOrEqual(5);
    const grouped = groupBySection(issues);
    expect(grouped.basic.length).toBeGreaterThanOrEqual(4);
    expect(grouped.intro.length).toBe(1);
    expect(grouped.outline.length).toBe(1);
    expect(grouped.instructors.length).toBe(1);
    expect(grouped.tags.length).toBe(2);
  });

  it('标题超过 40 字被拦下，正好 40 字通过', () => {
    const record = readCourse(C_DRAFT_ID);
    if (!record) throw new Error('mock 缺失');
    const base = toFormState(record);
    expect(validate({ ...base, title: 'W'.repeat(40) }).some((i) => i.field === 'title')).toBe(false);
    expect(validate({ ...base, title: 'W'.repeat(41) }).some((i) => i.field === 'title')).toBe(true);
  });

  it('没有主讲被拦下，有主讲通过', () => {
    const record = readCourse(C_DRAFT_ID);
    if (!record) throw new Error('mock 缺失');
    const base = toFormState(record);
    const none = { ...base, instructors: base.instructors.map((i) => ({ ...i, role: 'assistant' as const })) };
    expect(validate(none).some((i) => i.field === 'instructors.main')).toBe(true);

    const withMain = { ...base, instructors: base.instructors.map((i, index) => ({ ...i, role: index === 0 ? 'main' as const : 'assistant' as const })) };
    expect(validate(withMain).some((i) => i.field === 'instructors.main')).toBe(false);
  });

  it('学习收获超过 8 条被拦下', () => {
    const record = readCourse(C_DRAFT_ID);
    if (!record) throw new Error('mock 缺失');
    const base = toFormState(record);
    const nine = { ...base, outcomes: Array.from({ length: 9 }, (_, i) => '收获 ' + (i + 1)) };
    expect(validate(nine).some((i) => i.field === 'outcomes')).toBe(true);
    const eight = { ...base, outcomes: Array.from({ length: 8 }, (_, i) => '收获 ' + (i + 1)) };
    expect(validate(eight).some((i) => i.field === 'outcomes')).toBe(false);
  });

  it('后端校验与前端校验不同源：副标题为空时后端多返回一条前端没有的缺失项', () => {
    const record = readCourse(C_DRAFT_ID);
    if (!record) throw new Error('mock 缺失');
    const base = { ...toFormState(record), subtitle: '' };
    const front = validate(base);
    const server = serverValidate(base);
    expect(front.some((i) => i.field === 'subtitle')).toBe(false);
    expect(server.some((i) => i.field === 'subtitle')).toBe(true);
    expect(server.length).toBe(front.length + 1);
  });

  it('summarize 按分区汇总数量', () => {
    const text = summarize([
      { section: 'basic', field: 'title', label: '课程标题', message: '必填' },
      { section: 'basic', field: 'coverUrl', label: '课程封面', message: '必传' },
      { section: 'tags', field: 'track', label: '赛道', message: '至少选择 1 个' },
    ]);
    expect(text).toBe('基本信息 2 项、标签 1 项');
  });
});

describe('封面 16:9 与 5MB 限制', () => {
  it('超过 5MB 被拒绝，正好 5MB 通过', () => {
    const ok = checkCoverFile({ name: 'a.png', size: 5 * 1024 * 1024, type: 'image/png' });
    expect(ok.ok).toBe(true);
    const tooBig = checkCoverFile({ name: 'a.png', size: 5 * 1024 * 1024 + 1, type: 'image/png' });
    expect(tooBig.ok).toBe(false);
  });

  it('非图片类型被拒绝', () => {
    const result = checkCoverFile({ name: 'a.pdf', size: 1000, type: 'application/pdf' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('bad-type');
  });

  it('横图居中裁剪为 16:9：宽度被裁掉，高度不变', () => {
    const rect = computeCropRect(1920, 800);
    expect(rect).not.toBeNull();
    if (!rect) return;
    expect(rect.sh).toBe(800);
    expect(rect.sw).toBe(Math.round(800 * 16 / 9));
    expect(rect.sx).toBe(Math.round((1920 - rect.sw) / 2));
    expect(rect.sw / rect.sh).toBeCloseTo(16 / 9, 2);
  });

  it('竖图居中裁剪为 16:9：高度被裁掉，宽度不变', () => {
    const rect = computeCropRect(800, 1920);
    if (!rect) return;
    expect(rect.sw).toBe(800);
    expect(rect.sh).toBe(Math.round(800 / (16 / 9)));
    expect(rect.sw / rect.sh).toBeCloseTo(16 / 9, 1);
  });

  it('非法尺寸返回 null', () => {
    expect(computeCropRect(0, 100)).toBeNull();
    expect(computeCropRect(Number.NaN, 100)).toBeNull();
  });

  it('输出尺寸是 16:9 且长边 1280', () => {
    const size = targetCoverSize();
    expect(size.width).toBe(1280);
    expect(size.height).toBe(720);
  });
});

describe('富文本 5000 字上限与外部样式清除', () => {
  it('纯文本计数字数，标签不计数', () => {
    expect(htmlToText('<p> abc </p>').trim()).toBe('abc');
    const html = '<p>' + 'a'.repeat(5000) + '</p>';
    expect(checkIntroLength(html).ok).toBe(true);
  });

  it('超过 5000 字被拒绝并给出当前字数', () => {
    const html = '<p>' + 'a'.repeat(5001) + '</p>';
    const result = checkIntroLength(html);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.length).toBe(5001);
      expect(result.message).toContain('5001');
    }
  });

  it('normalizeRichHtml 清除 style / class / font / 表格，只保留语义标签', () => {
    const dirty = '<div style="color:red" class="x"><span style="font-family:Arial"><strong>加粗</strong></span>' +
      '<table><tr><td>单元格</td></tr></table><script>alert(1)</script><p>段落</p></div>';
    const clean = normalizeRichHtml(dirty);
    expect(clean).not.toContain('style=');
    expect(clean).not.toContain('class=');
    expect(clean).not.toContain('<span');
    expect(clean).not.toContain('<table');
    expect(clean).not.toContain('<script');
    expect(clean).toContain('<strong>加粗</strong>');
    expect(clean).toContain('<p>段落</p>');
  });

  it('保留 https 链接与图片，去掉 javascript: 协议', () => {
    const clean = normalizeRichHtml(
      '<p><a href="https://example.com/a" onclick="x()">链</a></p>' +
      '<p><a href="javascript:alert(1)">坏链</a></p>' +
      '<p><img src="https://example.com/a.png" onerror="x()" /></p>' +
      '<p><img src="javascript:alert(1)" /></p>',
    );
    expect(clean).toContain('href="https://example.com/a"');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('src="https://example.com/a.png"');
    expect(clean).not.toContain('onerror');
  });
});
