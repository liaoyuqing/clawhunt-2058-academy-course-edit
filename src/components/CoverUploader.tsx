import { useRef, useState } from 'react';
import { Button, MessagePlugin } from 'tdesign-react';
import { DeleteIcon, ImageIcon } from 'tdesign-icons-react';
import { checkCoverFile, computeCropRect, targetCoverSize } from '../domain/cover.ts';

export interface CoverUploaderProps {
  coverUrl: string;
  coverName: string;
  disabled: boolean;
  onChange: (patch: { coverUrl: string; coverName: string }) => void;
}

/**
 * 封面上传：选图 → 校验类型与 5MB 上限 → canvas 居中裁剪为 16:9 → 转 dataURL 存表单。
 * 全部本地处理，不请求任何外部服务。
 */
export function CoverUploader({ coverUrl, coverName, disabled, onChange }: CoverUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handlePick = () => {
    if (disabled || busy) return;
    inputRef.current?.click();
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const check = checkCoverFile({ name: file.name, size: file.size, type: file.type });
    if (!check.ok) {
      MessagePlugin.error(check.message);
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await cropToDataUrl(file);
      onChange({ coverUrl: dataUrl, coverName: file.name });
      MessagePlugin.success('封面已裁剪为 16:9');
    } catch (error) {
      // 图片解码失败（损坏文件或非图片内容）时保持原封面不变
      MessagePlugin.error('封面处理失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="cover-uploader" data-testid="cover-uploader">
      <div className={'cover-uploader__frame' + (coverUrl ? ' is-filled' : '')} data-ratio="16:9">
        {coverUrl ? (
          <img src={coverUrl} alt="课程封面（16:9）" className="cover-uploader__img" />
        ) : (
          <div className="cover-uploader__empty">
            <ImageIcon size="28px" />
            <span>16:9 · 5MB 以内</span>
          </div>
        )}
        <span className="cover-uploader__badge">16:9</span>
      </div>

      <div className="cover-uploader__actions">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="cover-uploader__input"
          data-testid="cover-input"
          disabled={disabled}
          onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
        />
        <Button size="small" variant="outline" onClick={handlePick} disabled={disabled || busy} data-testid="cover-pick">
          {coverUrl ? '重新上传' : '上传封面'}
        </Button>
        {coverUrl ? (
          <Button
            size="small"
            variant="text"
            theme="danger"
            disabled={disabled}
            onClick={() => onChange({ coverUrl: '', coverName: '' })}
            data-testid="cover-remove"
          >
            <DeleteIcon /> 移除
          </Button>
        ) : null}
        <span className="cover-uploader__name">{coverName || '未选择文件'}</span>
      </div>
    </div>
  );
}

/** 读取图片 → 居中裁剪 16:9 → 输出 dataURL（长边 1280） */
async function cropToDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const rect = computeCropRect(image.width, image.height);
    if (!rect) throw new Error('图片尺寸不合法');
    const target = targetCoverSize();
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('当前浏览器不支持 canvas');
    ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, target.width, target.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片无法解码'));
    image.src = src;
  });
}

export default CoverUploader;
