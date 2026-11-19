import { useCallback, useEffect, useRef } from 'react';
import { MessagePlugin } from 'tdesign-react';
import { LinkIcon, ImageIcon } from 'tdesign-icons-react';
import { checkIntroLength, normalizeRichHtml, pastedTextToHtml, sanitizePastedHtml } from '../domain/richtext.ts';

export interface RichTextEditorProps {
  value: string;
  disabled: boolean;
  onChange: (html: string) => void;
  /** 用于测试与取证：最近一次粘贴是否被清洗 */
  onPasteSanitized?: (detail: { before: string; after: string }) => void;
}

/**
 * 课程介绍富文本编辑器。
 * 使用 contentEditable + document.execCommand，不引入任何第三方富文本云服务。
 * 粘贴走 onPaste：先 preventDefault 拿到 HTML，清除外部样式后再手工插入，
 * 因此外部文档的字体、颜色、class、表格样式都不会进入正文。
 */
export function RichTextEditor({ value, disabled, onChange, onPasteSanitized }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastValue = useRef(value);

  // 外部值变化（如重新加载、只读切换）时才覆写 DOM，避免每次输入都重置光标
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (lastValue.current !== value) {
      if (node.innerHTML !== value) node.innerHTML = value;
      lastValue.current = value;
    }
  }, [value]);

  useEffect(() => {
    const node = ref.current;
    if (node && node.innerHTML !== value) node.innerHTML = value;
    // 仅首挂载同步一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    const html = normalizeRichHtml(node.innerHTML);
    lastValue.current = html;
    const check = checkIntroLength(html);
    if (!check.ok) MessagePlugin.warning(check.message);
    onChange(html);
  }, [onChange]);

  const exec = (command: string, arg?: string) => {
    if (disabled) return;
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const insertLink = () => {
    if (disabled) return;
    const href = window.prompt('链接地址（需以 http:// 或 https:// 开头）', 'https://example.com/');
    if (!href) return;
    if (!/^https?:\/\//i.test(href)) {
      MessagePlugin.warning('链接必须以 http:// 或 https:// 开头');
      return;
    }
    exec('createLink', href);
  };

  const insertImage = () => {
    if (disabled) return;
    const src = window.prompt('图片地址（需以 http:// 或 https:// 开头）');
    if (!src) return;
    if (!/^https?:\/\//i.test(src)) {
      MessagePlugin.warning('图片地址必须以 http:// 或 https:// 开头');
      return;
    }
    exec('insertImage', src);
  };

  /** 粘贴：清除外部样式。HTML 走白名单清洗，纯文本按段落包 <p> */
  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled) return;
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    const sanitized = html ? sanitizePastedHtml(html) : pastedTextToHtml(text);
    if (html && onPasteSanitized) onPasteSanitized({ before: html, after: sanitized });
    ref.current?.focus();
    document.execCommand('insertHTML', false, sanitized);
    emit();
  };

  return (
    <div className={'richtext' + (disabled ? ' is-readonly' : '')}>
      <div className="richtext__toolbar" role="toolbar" aria-label="课程介绍格式工具栏">
        <button type="button" className="richtext__btn" disabled={disabled} onClick={() => exec('bold')} title="加粗" data-command="bold">
          <strong>B</strong>
        </button>
        <button type="button" className="richtext__btn" disabled={disabled} onClick={() => exec('insertUnorderedList')} title="无序列表" data-command="insertUnorderedList">
          • 列表
        </button>
        <button type="button" className="richtext__btn" disabled={disabled} onClick={() => exec('insertOrderedList')} title="有序列表" data-command="insertOrderedList">
          1. 列表
        </button>
        <button type="button" className="richtext__btn" disabled={disabled} onClick={insertImage} title="插入图片" data-command="insertImage">
          <ImageIcon /> 图片
        </button>
        <button type="button" className="richtext__btn" disabled={disabled} onClick={insertLink} title="插入链接" data-command="createLink">
          <LinkIcon /> 链接
        </button>
        <span className="richtext__hint">粘贴时自动清除外部样式</span>
      </div>
      <div
        ref={ref}
        className="richtext__area"
        data-testid="intro-editor"
        role="textbox"
        aria-multiline="true"
        aria-label="课程介绍正文"
        aria-readonly={disabled}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onPaste={handlePaste}
      />
    </div>
  );
}

export default RichTextEditor;
