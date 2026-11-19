import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5199';
const OUT = path.resolve('docs/screenshots');
const DRAFT = BASE + '/academy/courses/crs_2058_draft/edit';
const PUBLISHED = BASE + '/academy/courses/crs_2058_published/edit';

const VIEWPORT = { width: 1440, height: 900 };
const DPR = 2;

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DPR, locale: 'zh-CN' });
const page = await context.newPage();
page.setDefaultTimeout(20000);

const shots = [];
async function shot(name, opts = {}) {
  const file = path.join(OUT, name + '.png');
  await page.screenshot({ path: file, ...opts });
  shots.push(name + '.png');
  process.stdout.write('SHOT ' + name + '.png\n');
}

async function openEditor(url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-section="basic"]');
  await page.waitForTimeout(400);
}

/** 把某个分区滚动到视口顶部并截图该分区卡片本身 */
async function shotSection(key, name) {
  const el = page.locator('[data-section="' + key + '"]');
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await el.screenshot({ path: path.join(OUT, name + '.png') });
  shots.push(name + '.png');
  process.stdout.write('SHOT ' + name + '.png (section ' + key + ')\n');
}

// ---------- 1. 概览与六个分区 ----------
await openEditor(DRAFT);
// 关掉右侧滚动干扰：先截整页
await shot('00-full-page', { fullPage: true });

const sections = [
  ['basic', '01-basic'],
  ['intro', '02-intro'],
  ['outline', '03-outline'],
  ['outcomes', '04-outcomes'],
  ['instructors', '05-instructors'],
  ['tags', '06-tags'],
];
for (const [key, name] of sections) await shotSection(key, name);

// 右侧预览卡片单独一张
const preview = page.locator('[data-testid="preview-card"]');
await preview.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await shot('07-preview-card', { clip: await preview.boundingBox() ?? undefined });

// ---------- 2. AC2：停用讲师不可选 ----------
await openEditor(DRAFT);
await page.locator('[data-testid="instructor-toggle"]').click();
await page.waitForTimeout(300);
await page.locator('[data-testid="instructor-option-ins_9004"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
const picker = page.locator('[data-section="instructors"]');
await picker.screenshot({ path: path.join(OUT, '08-ac2-instructor-picker.png') });
shots.push('08-ac2-instructor-picker.png');
process.stdout.write('SHOT 08-ac2-instructor-picker.png\n');

// 点停用讲师，并记录"点击后已选列表未变"的证据
const beforeSelected = await page.locator('[data-instructor-entry]').count();
// Playwright 的常规 click 会因为 aria-disabled=true 直接拒绝执行（这本身就是证据）。
// 为了验证"即使强制触发也不会加入已选列表"，这里用 force 绕过可用性检查。
let clickRejectedByAria = false;
try {
  await page.locator('[data-testid="instructor-option-ins_9004"]').click({ timeout: 3000 });
} catch {
  clickRejectedByAria = true;
  await page.locator('[data-testid="instructor-option-ins_9004"]').click({ force: true });
}
await page.waitForTimeout(500);
const afterSelected = await page.locator('[data-instructor-entry]').count();
const stillAbsent = (await page.locator('[data-testid="instructor-remove-ins_9004"]').count()) === 0;
await picker.screenshot({ path: path.join(OUT, '09-ac2-disabled-click-rejected.png') });
shots.push('09-ac2-disabled-click-rejected.png');
process.stdout.write('SHOT 09-ac2-disabled-click-rejected.png\n');
await writeFile(path.join(OUT, 'ac2-evidence.json'), JSON.stringify({
  disabledInstructorId: 'ins_9004',
  clickRejectedByPlaywrightActionability: clickRejectedByAria,
  disabledInstructorStatus: await page.locator('[data-testid="instructor-option-ins_9004"]').getAttribute('data-instructor-status'),
  selectableAttr: await page.locator('[data-testid="instructor-option-ins_9004"]').getAttribute('data-selectable'),
  selectedCountBeforeClick: beforeSelected,
  selectedCountAfterClick: afterSelected,
  disabledEntryAbsentFromSelected: stillAbsent,
}, null, 2), 'utf8');

// 再点一个可选讲师作对照
await page.locator('[data-testid="instructor-option-ins_9002"]').click();
await page.waitForTimeout(500);
const activeAdded = (await page.locator('[data-testid="instructor-remove-ins_9002"]').count()) === 1;
await picker.screenshot({ path: path.join(OUT, '10-ac2-active-selectable.png') });
shots.push('10-ac2-active-selectable.png');
process.stdout.write('SHOT 10-ac2-active-selectable.png\n');
await writeFile(path.join(OUT, 'ac2-control-evidence.json'), JSON.stringify({
  activeInstructorId: 'ins_9002',
  entryAddedToSelected: activeAdded,
  selectedCount: await page.locator('[data-instructor-entry]').count(),
}, null, 2), 'utf8');

// ---------- 3. AC1：拖拽排序（真实鼠标拖动 + 逐帧序列） ----------
await openEditor(DRAFT);
const ORDER = () => page.$$eval('[data-outline-row]', (rows) =>
  rows.map((row) => row.querySelector('[data-testid^="outline-title-"] input')?.value ?? ''),
);
const beforeOrder = await ORDER();
await writeFile(path.join('docs', 'screenshots', 'ac1-before.json'), JSON.stringify(beforeOrder, null, 2), 'utf8');

const outlineCard = page.locator('[data-section="outline"]');
await outlineCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
// 与 03-outline.png 明确区分：先把鼠标移到第 1 条手柄上，截图中手柄处于 hover 高亮态（准备拖拽）
await page.locator('[data-testid="outline-handle-ol_1"]').hover();
await page.waitForTimeout(250);
await outlineCard.screenshot({ path: path.join(OUT, '11-ac1-before-drag.png') });
shots.push('11-ac1-before-drag.png');
process.stdout.write('SHOT 11-ac1-before-drag.png\n');

const handle = page.locator('[data-testid="outline-handle-ol_1"]');
const box = await handle.boundingBox();
if (!box) throw new Error('拖拽手柄不可见');
const startX = box.x + box.width / 2;
const startY = box.y + box.height / 2;
const ROW = 56;

await page.mouse.move(startX, startY);
await page.mouse.down();
const frames = [];
for (let step = 1; step <= 3; step += 1) {
  await page.mouse.move(startX, startY + ROW * step, { steps: 6 });
  await page.waitForTimeout(180);
  const name = '12-ac1-drag-frame-' + step;
  await outlineCard.screenshot({ path: path.join(OUT, name + '.png') });
  shots.push(name + '.png');
  frames.push(await ORDER());
  process.stdout.write('SHOT ' + name + '.png -> ' + JSON.stringify(frames[frames.length - 1]) + '\n');
}
await page.mouse.up();
await page.waitForTimeout(300);
const afterOrder = await ORDER();
await outlineCard.screenshot({ path: path.join(OUT, '13-ac1-after-drag.png') });
shots.push('13-ac1-after-drag.png');
process.stdout.write('SHOT 13-ac1-after-drag.png\n');

// 保存草稿，验证 order 落库
await page.locator('[data-testid="save-draft"]').click();
await page.waitForTimeout(900);
await page.locator('[data-testid="evidence-bar"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(250);
const savedOrderText = await page.locator('[data-testid="saved-order"]').textContent();
await shot('14-ac1-saved-order');
await writeFile(path.join('docs', 'screenshots', 'ac1-order-evidence.json'), JSON.stringify({
  before: beforeOrder,
  dragFrames: frames,
  after: afterOrder,
  savedOrderText,
  orderChanged: JSON.stringify(beforeOrder) !== JSON.stringify(afterOrder),
  firstTitleMovedToFourth: afterOrder[3] === beforeOrder[0],
}, null, 2), 'utf8');

// 刷新后顺序仍在（真实落库证据）
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('[data-section="basic"]');
await page.waitForTimeout(400);
const afterReload = await ORDER();
await outlineCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(250);
await outlineCard.screenshot({ path: path.join(OUT, '15-ac1-after-reload.png') });
shots.push('15-ac1-after-reload.png');
process.stdout.write('SHOT 15-ac1-after-reload.png\n');
await writeFile(path.join('docs', 'screenshots', 'ac1-reload-evidence.json'), JSON.stringify({
  afterDrag: afterOrder,
  afterReload,
  persistsAcrossReload: JSON.stringify(afterOrder) === JSON.stringify(afterReload),
}, null, 2), 'utf8');

// ---------- 4. AC3：未保存离开确认 ----------
await openEditor(DRAFT);
await page.locator('[data-testid="input-title"] input').fill('改过但未保存的课程标题');
await page.waitForTimeout(400);
await shot('16-ac3-dirty-indicator', { fullPage: false });
await page.locator('[data-testid="back-link"]').click();
await page.waitForTimeout(600);
const dialogVisible = (await page.locator('[data-testid="leave-dialog"]').count()) === 1;
await shot('17-ac3-leave-dialog');
await writeFile(path.join('docs', 'screenshots', 'ac3-evidence.json'), JSON.stringify({
  dialogVisible,
  urlStillOnEditPage: page.url().includes('/edit'),
  dialogText: await page.locator('[data-testid="leave-dialog"]').textContent(),
}, null, 2), 'utf8');

// 点「留下继续编辑」，确认留在页面且修改仍在
await page.locator('[data-testid="leave-stay"]').click();
await page.waitForTimeout(500);
const stayedOnPage = page.url().includes('/edit');
const titleStillDirty = (await page.locator('[data-testid="input-title"] input').inputValue()) === '改过但未保存的课程标题';
await shot('18-ac3-stayed-on-page');
await writeFile(path.join('docs', 'screenshots', 'ac3-stay-evidence.json'), JSON.stringify({
  stayedOnPage,
  titleStillDirty,
}, null, 2), 'utf8');

// 再触发一次，这次点「放弃修改并离开」
await page.locator('[data-testid="back-link"]').click();
await page.waitForTimeout(500);
await page.locator('[data-testid="leave-confirm"]').click();
await page.waitForTimeout(700);
const navigatedAway = page.url().endsWith('/academy/courses');
await shot('19-ac3-left-to-list');
await writeFile(path.join('docs', 'screenshots', 'ac3-leave-evidence.json'), JSON.stringify({
  navigatedAway,
  finalUrl: page.url(),
}, null, 2), 'utf8');

// ---------- 5. AC4：published 只读 ----------
await openEditor(PUBLISHED);
await shot('20-ac4-readonly-banner');
const banner = page.locator('[data-testid="readonly-banner"]');
await banner.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await banner.screenshot({ path: path.join(OUT, '20b-ac4-readonly-banner-clip.png') });
shots.push('20b-ac4-readonly-banner-clip.png');
process.stdout.write('SHOT 20b-ac4-readonly-banner-clip.png\n');

const disabledFacts = {
  titleInputDisabled: await page.locator('[data-testid="input-title"] input').isDisabled(),
  introEditable: await page.locator('[data-testid="intro-editor"]').getAttribute('contenteditable'),
  saveDraftDisabled: (await page.locator('[data-testid="save-draft"]').getAttribute('class'))?.includes('t-is-disabled') ?? false,
  submitDisabled: (await page.locator('[data-testid="submit-review"]').getAttribute('class'))?.includes('t-is-disabled') ?? false,
  tagChipsAllDisabled: await page.$$eval('.tag-picker__chip', (chips) => chips.every((c) => c.getAttribute('aria-disabled') === 'true')),
  dragHandlesAllDisabled: await page.$$eval('[data-drag-handle]', (hs) => hs.every((h) => h.getAttribute('aria-disabled') === 'true')),
  outlineTitleInputsDisabled: await page.$$eval('[data-testid^="outline-title-"] input', (els) => els.every((e) => e.disabled)),
  outcomeInputsDisabled: await page.$$eval('[data-testid^="outcome-input-"] input', (els) => els.every((e) => e.disabled)),
};

// published 页面整页截图
await shot('21-ac4-published-full', { fullPage: true });
await page.locator('[data-section="instructors"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await page.locator('[data-section="instructors"]').screenshot({ path: path.join(OUT, '22-ac4-instructors-readonly.png') });
shots.push('22-ac4-instructors-readonly.png');
await page.locator('[data-section="tags"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await page.locator('[data-section="tags"]').screenshot({ path: path.join(OUT, '23-ac4-tags-readonly.png') });
shots.push('23-ac4-tags-readonly.png');
process.stdout.write('SHOT 22/23 readonly sections\n');

// 补两张分区级只读特写：大纲与学习收获（整页长图缩放后灰化辨识度低）
await page.locator('[data-section="outline"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(250);
await page.locator('[data-section="outline"]').screenshot({ path: path.join(OUT, '25-ac4-outline-readonly.png') });
shots.push('25-ac4-outline-readonly.png');
process.stdout.write('SHOT 25-ac4-outline-readonly.png\n');
await page.locator('[data-section="outcomes"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(250);
await page.locator('[data-section="outcomes"]').screenshot({ path: path.join(OUT, '26-ac4-outcomes-readonly.png') });
shots.push('26-ac4-outcomes-readonly.png');
process.stdout.write('SHOT 26-ac4-outcomes-readonly.png\n');
const outlineReadonlyFacts = {
  outlineTitleInputsDisabled: await page.$$eval('[data-testid^="outline-title-"] input', (els) => els.every((e) => e.disabled)),
  outlineDurationInputsDisabled: await page.$$eval('[data-testid^="outline-duration-"] input', (els) => els.every((e) => e.disabled)),
  outcomeInputsDisabled: await page.$$eval('[data-testid^="outcome-input-"] input', (els) => els.every((e) => e.disabled)),
  addOutlineDisabled: (await page.locator('[data-testid="outline-add"]').getAttribute('class'))?.includes('t-is-disabled') ?? null,
};
await writeFile(path.join('docs', 'screenshots', 'ac4-outline-outcomes-evidence.json'), JSON.stringify(outlineReadonlyFacts, null, 2), 'utf8');

await writeFile(path.join('docs', 'screenshots', 'ac4-evidence.json'), JSON.stringify(disabledFacts, null, 2), 'utf8');

// ---------- 6. 提交前校验弹窗（附加演示） ----------
await openEditor(BASE + '/academy/courses/crs_2058_new/edit');
await page.locator('[data-testid="submit-review"]').click();
await page.waitForTimeout(900);
await shot('24-validation-issue-summary');
await writeFile(path.join('docs', 'screenshots', 'validation-evidence.json'), JSON.stringify({
  issueCount: await page.locator('.edit-page__issue-list li').count(),
  serverOnlyIncluded: (await page.locator('.edit-page__issue-src').textContent()) ?? '',
}, null, 2), 'utf8');

// ---------- 收尾 ----------
// manifest 带尺寸与 sha256，便于评审核对"非空、非重复"
const crypto = await import('node:crypto');
const stat = await import('node:fs/promises');
const files = [];
for (const name of shots) {
  const file = path.join(OUT, name);
  const buf = await stat.readFile(file);
  const st = await stat.stat(file);
  files.push({ name, bytes: st.size, sha256: crypto.createHash('sha256').update(buf).digest('hex') });
}
const dup = files.filter((f, i) => files.findIndex((g) => g.sha256 === f.sha256) !== i).map((f) => f.name);
await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({ capturedAt: new Date().toISOString(), base: BASE, viewport: VIEWPORT, deviceScaleFactor: DPR, count: files.length, duplicateHashes: dup, files }, null, 2), 'utf8');

// index.txt 改成 AC → 文件 → 说明 的映射表（评审不必再去猜文件名对应哪条验收）
const INDEX = [
  ['AC1', '01-basic.png', '分区①基本信息（标题 40 字计数、封面 16:9 预览）'],
  ['AC1', '02-intro.png', '分区②课程介绍（富文本工具栏、5000 字计数）'],
  ['AC1', '03-outline.png', '分区③课程大纲（拖拽前基线顺序）'],
  ['AC1', '04-outcomes.png', '分区④学习收获（8 条上限）'],
  ['AC1', '05-instructors.png', '分区⑤讲师（已选列表、角色、顺序）'],
  ['AC1', '06-tags.png', '分区⑥标签（赛道/兴趣话题，每维 3 个）'],
  ['AC1', '07-preview-card.png', '右侧小程序课程卡片实时预览'],
  ['AC1', '00-full-page.png', '整页长图（六分区同屏）'],
  ['AC1', '11-ac1-before-drag.png', '拖拽前：鼠标悬停第 1 条手柄（hover 高亮，与 03 明确区分）'],
  ['AC1', '12-ac1-drag-frame-1.png', '拖拽第 1 帧：第 1 条越过第 2 条'],
  ['AC1', '12-ac1-drag-frame-2.png', '拖拽第 2 帧：继续下移'],
  ['AC1', '12-ac1-drag-frame-3.png', '拖拽第 3 帧：落位前'],
  ['AC1', '13-ac1-after-drag.png', '松手后新顺序'],
  ['AC1', '14-ac1-saved-order.png', '保存草稿后取证条显示落库顺序'],
  ['AC1', '15-ac1-after-reload.png', '刷新后顺序与保存结果一致'],
  ['AC2', '08-ac2-instructor-picker.png', '讲师库展开：两位停用讲师置灰带「已停用」'],
  ['AC2', '09-ac2-disabled-click-rejected.png', '强制点击停用讲师：已选列表未变'],
  ['AC2', '10-ac2-active-selectable.png', '对照组：可选讲师点击后成功加入'],
  ['AC3', '16-ac3-dirty-indicator.png', '标题被修改后出现未保存标记'],
  ['AC3', '17-ac3-leave-dialog.png', '点返回：确认弹窗出现且 URL 仍在 /edit'],
  ['AC3', '18-ac3-stayed-on-page.png', '点「留下继续编辑」：仍在页面且修改保留'],
  ['AC3', '19-ac3-left-to-list.png', '点「放弃修改并离开」：落到课程列表'],
  ['AC4', '20-ac4-readonly-banner.png', 'published 进入：顶部「需下架后修改」提示条'],
  ['AC4', '20b-ac4-readonly-banner-clip.png', '提示条特写'],
  ['AC4', '21-ac4-published-full.png', '整页长图：全部控件灰化'],
  ['AC4', '22-ac4-instructors-readonly.png', '分区⑤讲师只读特写'],
  ['AC4', '23-ac4-tags-readonly.png', '分区⑥标签只读特写'],
  ['AC4', '25-ac4-outline-readonly.png', '分区③大纲只读特写（标题/时长不可编辑、手柄禁用）'],
  ['AC4', '26-ac4-outcomes-readonly.png', '分区④学习收获只读特写'],
  ['附加', '24-validation-issue-summary.png', '提交审核前置校验：前端问题 + 后端返回缺失项同表展示'],
];
const head = '# AC → 截图 → 说明（评审按此表逐条核对）\n';
await writeFile(path.join(OUT, 'index.txt'), head + INDEX.map((r) => r.join(' | ')).join('\n') + '\n', 'utf8');
if (dup.length > 0) process.stdout.write('DUPLICATE HASHES ' + JSON.stringify(dup) + '\n');
process.stdout.write('TOTAL ' + shots.length + ' screenshots\n');
await browser.close();
