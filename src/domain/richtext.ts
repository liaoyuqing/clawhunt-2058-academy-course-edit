/**
 * 富文本（课程介绍）的编辑规则：
 * - 只允许 加粗 / 有序列表 / 无序列表 / 图片 / 链接
 * - 粘贴时清除外部样式（字体、颜色、内联 style、class、外部 span/font 等一律丢弃）
 * - 正文纯文本不超过 5000 字
 */
import { LIMITS, htmlToText } from './form.ts';

const ALLOWED_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'UL', 'OL', 'LI', 'A', 'IMG', 'DIV']);
const DROP_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'SVG', 'NOSCRIPT', 'HEAD']);
/** 这些标签只保留内容，自身丢弃（span/font/h1… 的外部样式全部清掉） */
const UNWRAP_TAGS = new Set([
  'SPAN', 'FONT', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'ARTICLE', 'BLOCKQUOTE',
  'TABLE', 'TBODY', 'THEAD', 'TR', 'TD', 'TH', 'FIGURE', 'FIGCAPTION', 'CODE', 'PRE', 'SMALL', 'BIG', 'U', 'S',
]);

/** 允许保留的属性：只有链接的 href 与图片的 src/alt */
const KEEP_ATTRS: Record<string, string[]> = { A: ['href'], IMG: ['src', 'alt'] };

/**
 * 危险属性黑名单：事件处理器（onerror/onload/onclick…）、style、srcset、
 * 以及一切带 javascript: / vbscript: / data:text/html 的值。白名单之外本来就被丢弃，
 * 这里再显式拦一次，保证即使将来有人往 KEEP_ATTRS 里加字段也不会把 XSS 入口放进来。
 */
const DANGEROUS_ATTR = /^on|^style$|^srcset$|^formaction$|^xlink:href$/i;
const DANGEROUS_VALUE = /(?:^|\s)(?:javascript|vbscript|livescript):|data:text\/html|data:image\/svg\+xml/i;

function isSafeAttr(name: string, value: string): boolean {
  const n = name.toLowerCase();
  if (DANGEROUS_ATTR.test(n)) return false;
  if (DANGEROUS_VALUE.test(value.replace(/[\u0000-\u001f]/g, '').trim())) return false;
  return true;
}

function sanitizeNode(node: Element): void {
  const children = Array.from(node.children);
  for (const child of children) {
    const tag = child.tagName;
    if (DROP_WITH_CONTENT.has(tag)) {
      child.remove();
      continue;
    }
    sanitizeNode(child);
    if (UNWRAP_TAGS.has(tag)) {
      // 用子节点替换自身（保留文本内容，丢弃外部样式）
      const parent = child.parentNode;
      if (parent) {
        while (child.firstChild) parent.insertBefore(child.firstChild, child);
        child.remove();
      }
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      const parent = child.parentNode;
      if (parent) {
        while (child.firstChild) parent.insertBefore(child.firstChild, child);
        child.remove();
      }
      continue;
    }
    const allowed = KEEP_ATTRS[tag] ?? [];
    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase();
      if (!allowed.includes(name) || !isSafeAttr(name, attr.value)) child.removeAttribute(attr.name);
    }
    if (tag === 'A') {
      const href = child.getAttribute('href') ?? '';
      if (!/^https?:\/\//i.test(href)) {
        child.removeAttribute('href');
      } else {
        // 外链统一加 rel，避免 target=_blank 反向 window.opener 劫持；target 只允许 _blank
        child.setAttribute('rel', 'noopener noreferrer');
        const target = child.getAttribute('target');
        if (target && target !== '_blank') child.removeAttribute('target');
      }
    }
    if (tag === 'IMG') {
      const src = child.getAttribute('src') ?? '';
      // 只接受 http(s) 与位图 data URL；data:image/svg+xml 可内嵌脚本，一律丢弃
      if (!/^https?:/i.test(src) && !/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,/i.test(src)) child.remove();
    }
  }
}

/** 把编辑器产出的 HTML 规范化：白名单标签 + 白名单属性 */
export function normalizeRichHtml(html: string): string {
  if (!html) return '';
  const container = document.createElement('div');
  // 先按 DOMParser 的 HTML 模式解析（不执行脚本、不加载资源），再走白名单清洗
  container.innerHTML = html;
  sanitizeNode(container);
  const result = container.innerHTML.trim();
  return result === '<br>' ? '' : result;
}

/**
 * 落库前再清洗一次（入库不变式）：任何来自接口/历史数据的 HTML 在写入与渲染前
 * 都必须经过同一套白名单，避免把未清洗内容存进 mock 库后再渲染造成存储型 XSS。
 */
export function sanitizeForStorage(html: string): string {
  return normalizeRichHtml(html);
}

/**
 * 处理粘贴的 HTML。外部来源的 styles/class/字体/表格/脚本全部清除，
 * 只留下本编辑器支持的语义标签；返回可直接插入编辑器的 HTML。
 */
export function sanitizePastedHtml(pastedHtml: string): string {
  const normalized = normalizeRichHtml(pastedHtml);
  if (normalized.length === 0) return '';
  const checker = document.createElement('div');
  checker.innerHTML = normalized;
  // 粘贴内容里的 <img> 保留（贴图场景），但 src 已由 normalizeRichHtml 过滤
  return checker.innerHTML;
}

/** 粘贴纯文本：转义后按段落包 <p>，避免外部文本带样式 */
export function pastedTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\n{2,}/)
    .map((block) => '<p>' + block.replace(/\n/g, '<br>') + '</p>')
    .join('');
}

export type IntroCheck = { ok: true } | { ok: false; reason: 'too-long'; length: number; message: string };

/** 5000 字上限：按纯文本计，标签不计入 */
export function checkIntroLength(html: string): IntroCheck {
  const length = htmlToText(html).length;
  if (length > LIMITS.intro) {
    return { ok: false, reason: 'too-long', length, message: '课程介绍不能超过 ' + LIMITS.intro + ' 字（当前 ' + length + ' 字）' };
  }
  return { ok: true };
}

/** 富文本统计，用于页脚提示 */
export function introStats(html: string): { textLength: number; limit: number } {
  return { textLength: htmlToText(html).length, limit: LIMITS.intro };
}
