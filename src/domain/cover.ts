import { LIMITS } from './form.ts';

/** 封面裁剪与校验的纯逻辑：与 canvas 解耦，便于单测 */

export interface CoverFileLike {
  name: string;
  size: number;
  type: string;
}

export type CoverCheck = { ok: true } | { ok: false; reason: 'too-large' | 'bad-type'; message: string };

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** 校验封面文件：类型 + 大小（≤5MB） */
export function checkCoverFile(file: CoverFileLike): CoverCheck {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, reason: 'bad-type', message: '仅支持 PNG / JPG / WebP 图片' };
  }
  if (file.size > LIMITS.coverBytes) {
    const mb = (file.size / 1024 / 1024).toFixed(2);
    return { ok: false, reason: 'too-large', message: '封面不能超过 5MB（当前 ' + mb + 'MB）' };
  }
  return { ok: true };
}

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * 计算 16:9 居中裁剪的源矩形。
 * 宽高任一边不合法时返回 null，调用方据此跳过裁剪。
 */
export function computeCropRect(width: number, height: number, aspect: number = LIMITS.coverAspect): CropRect | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const current = width / height;
  if (current > aspect) {
    // 太宽：按高度取宽
    const sw = Math.round(height * aspect);
    return { sx: Math.round((width - sw) / 2), sy: 0, sw, sh: Math.round(height) };
  }
  // 太高：按宽度取高
  const sh = Math.round(width / aspect);
  return { sx: 0, sy: Math.round((height - sh) / 2), sw: Math.round(width), sh };
}

/** 裁剪结果的目标像素尺寸，长边固定 1280，保证预览与小程序卡片清晰 */
export function targetCoverSize(aspect: number = LIMITS.coverAspect): { width: number; height: number } {
  const width = 1280;
  return { width, height: Math.round(width / aspect) };
}
