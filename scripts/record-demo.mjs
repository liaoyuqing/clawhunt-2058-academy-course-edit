import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * 录屏脚本：用 Playwright 的 video 录制，把四条 AC 的操作各录一段 webm。
 * 最终由 README 指向这些文件；如果运行环境没有 vp8/vp9 编码器，
 * 脚本会退化为"逐帧截图序列"（docs/screenshots 下已有），不影响验收。
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5199';
const OUT = path.resolve('docs/recording');
const DRAFT = BASE + '/academy/courses/crs_2058_draft/edit';
const PUBLISHED = BASE + '/academy/courses/crs_2058_published/edit';

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();

async function record(name, viewport, run) {
  const dir = path.join(OUT, name);
  await mkdir(dir, { recursive: true });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    locale: 'zh-CN',
    recordVideo: { dir, size: viewport },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  try {
    await run(page);
  } finally {
    await context.close();
  }
  process.stdout.write('RECORDED ' + name + '\n');
}

async function openEditor(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-section="basic"]');
  await page.waitForTimeout(700);
}

// AC1：拖拽排序 → 保存 → 刷新后顺序仍在
await record('ac1-drag-sort', { width: 1440, height: 900 }, async (page) => {
  await openEditor(page, DRAFT);
  const outline = page.locator('[data-section="outline"]');
  await outline.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  const handle = page.locator('[data-testid="outline-handle-ol_1"]');
  const box = await handle.boundingBox();
  if (!box) throw new Error('手柄不可见');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.waitForTimeout(400);
  await page.mouse.down();
  for (let step = 1; step <= 3; step += 1) {
    await page.mouse.move(x, y + 56 * step, { steps: 8 });
    await page.waitForTimeout(600);
  }
  await page.mouse.up();
  await page.waitForTimeout(900);
  await page.locator('[data-testid="save-draft"]').click();
  await page.waitForTimeout(1400);
  await page.locator('[data-testid="evidence-bar"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1600);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-section="basic"]');
  await outline.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2200);
});

// AC2：停用讲师不可选
await record('ac2-disabled-instructor', { width: 1440, height: 900 }, async (page) => {
  await openEditor(page, DRAFT);
  await page.locator('[data-section="instructors"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page.locator('[data-testid="instructor-toggle"]').click();
  await page.waitForTimeout(1000);
  const disabled = page.locator('[data-testid="instructor-option-ins_9004"]');
  await disabled.hover();
  await page.waitForTimeout(1200);
  try {
    await disabled.click({ timeout: 2000 });
  } catch {
    await disabled.click({ force: true });
  }
  await page.waitForTimeout(1600);
  const active = page.locator('[data-testid="instructor-option-ins_9002"]');
  await active.hover();
  await page.waitForTimeout(700);
  await active.click();
  await page.waitForTimeout(1800);
});

// AC3：未保存离开确认
await record('ac3-unsaved-leave', { width: 1440, height: 900 }, async (page) => {
  await openEditor(page, DRAFT);
  await page.waitForTimeout(600);
  await page.locator('[data-testid="input-title"] input').click();
  await page.locator('[data-testid="input-title"] input').fill('改过但未保存的课程标题');
  await page.waitForTimeout(900);
  await page.locator('[data-testid="back-link"]').click();
  await page.waitForTimeout(1600);
  await page.locator('[data-testid="leave-stay"]').click();
  await page.waitForTimeout(1400);
  await page.locator('[data-testid="back-link"]').click();
  await page.waitForTimeout(1400);
  await page.locator('[data-testid="leave-confirm"]').click();
  await page.waitForTimeout(1800);
});

// AC4：published 只读
await record('ac4-published-readonly', { width: 1440, height: 900 }, async (page) => {
  await openEditor(page, PUBLISHED);
  await page.waitForTimeout(1400);
  for (const key of ['intro', 'outline', 'instructors', 'tags']) {
    await page.locator('[data-section="' + key + '"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
  }
  await page.locator('[data-testid="save-draft"]').scrollIntoViewIfNeeded();
  await page.locator('[data-testid="readonly-banner"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1800);
});

await browser.close();
await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({
  recordedAt: new Date().toISOString(),
  base: BASE,
  clips: ['ac1-drag-sort', 'ac2-disabled-instructor', 'ac3-unsaved-leave', 'ac4-published-readonly'],
  note: '每段一段 webm，由 Playwright recordVideo 生成；配套逐帧截图见 docs/screenshots。',
}, null, 2), 'utf8');
process.stdout.write('ALL RECORDINGS DONE\n');
