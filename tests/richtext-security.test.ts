import { describe, expect, it } from 'vitest';
import { normalizeRichHtml, sanitizeForStorage, sanitizePastedHtml, pastedTextToHtml } from '../src/domain/richtext.ts';

/**
 * 富文本清洗的安全回归：粘贴与入库两条路径都必须挡住存储型 XSS。
 * 每条用例先构造一段恶意 HTML，再断言清洗后既不含事件处理器，也不保留可执行协议。
 */
const PAYLOADS = [
  '<img src=x onerror=alert(1)>',
  '<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" onload=alert(1)>',
  '<a href="javascript:alert(1)">点我</a>',
  '<a href="JaVaScRiPt:alert(1)">大小写混淆</a>',
  '<a href="java\u0000script:alert(1)">空字符绕过</a>',
  '<p style="background:url(javascript:alert(1))">带样式</p>',
  '<p onclick="alert(1)">事件属性</p>',
  '<img srcset="javascript:alert(1)">',
  '<iframe src="https://evil.example"></iframe>',
  '<svg><script>alert(1)</script></svg>',
  '<p>正常文字<b>加粗</b><a href="https://example.com/x">链接</a></p>',
];

function assertSafe(html: string): void {
  expect(html).not.toMatch(/on[a-z]+\s*=/i);
  expect(html).not.toMatch(/javascript:/i);
  expect(html).not.toMatch(/vbscript:/i);
  expect(html).not.toMatch(/<script/i);
  expect(html).not.toMatch(/<iframe/i);
  expect(html).not.toMatch(/<svg/i);
  expect(html).not.toMatch(/srcset/i);
}

describe('富文本清洗：粘贴路径', () => {
  it('11 组恶意/正常负载逐条清洗后都不含事件处理器与可执行协议', () => {
    for (const payload of PAYLOADS) {
      assertSafe(sanitizePastedHtml(payload));
    }
  });

  it('onerror 图片被丢弃或去掉事件属性，且不会保留 data:image/svg+xml', () => {
    const out = normalizeRichHtml('<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" onload=alert(1)>');
    expect(out).not.toMatch(/onload/i);
    expect(out).not.toMatch(/svg\+xml/i);
  });

  it('javascript: 链接被去掉 href，但正文文字保留（不吞内容）', () => {
    const out = normalizeRichHtml('<a href="javascript:alert(1)">点我</a>');
    expect(out).not.toMatch(/javascript:/i);
    expect(out).toContain('点我');
  });

  it('合法外链保留 href 并补 rel=noopener noreferrer（正向对照，防一律拒绝）', () => {
    const out = normalizeRichHtml('<a href="https://example.com/a" target="_blank">文档</a>');
    expect(out).toContain('href="https://example.com/a"');
    expect(out).toContain('noopener');
  });

  it('data:image/png 位图允许保留，data:text/html 一律丢弃', () => {
    const png = normalizeRichHtml('<img src="data:image/png;base64,iVBORw0KGgo=">');
    expect(png).toContain('data:image/png');
    const html = normalizeRichHtml('<img src="data:text/html;base64,PHNjcmlwdD4=">');
    expect(html).not.toMatch(/data:text\/html/i);
  });

  it('纯文本粘贴会转义尖括号，不会被当成标签解析', () => {
    const out = pastedTextToHtml('<img src=x onerror=alert(1)>');
    expect(out).not.toMatch(/<img/i);
    expect(out).toContain('&lt;img');
  });
});

describe('富文本清洗：入库不变式', () => {
  it('sanitizeForStorage 与粘贴清洗同源，同一负载结果一致', () => {
    for (const payload of PAYLOADS) {
      expect(sanitizeForStorage(payload)).toBe(sanitizePastedHtml(payload));
    }
  });

  it('反向验证：把清洗函数换成恒等函数（直接返回入参），下面这条断言必然失败', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const passthrough = (html: string): string => html;
    expect(() => assertSafe(passthrough(evil))).toThrow();
    assertSafe(sanitizeForStorage(evil));
  });
});