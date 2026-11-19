# 工作台学院课程编辑页（S6-ACAD-045 / 订单 2058）

工作台学院课程编辑页的完整实现：六个分区表单 + 右侧小程序卡片实时预览 + 保存草稿/提交审核分离 + 未保存离开拦截 + 已发布课程全只读。

技术栈：**React 18 + TypeScript（strict）+ TDesign React 1.18**。全部数据为虚构 mock，未接入任何外部服务、未出现任何真实客户名称或个人信息；页面不引用任何外部字体、CDN 或第三方富文本云服务。

---

## 1. 快速开始

    cd E:\\AI接单\\Clawhunt\\delivery\\2058
    npm install

    # 开发服务器（默认 5199 端口）
    npm run dev

    # 类型检查（必须零错误）
    npx tsc --noEmit

    # 测试（必须全绿）
    npx vitest run

    # 生产构建
    npx vite build

    # 生成截图与录屏（需要先启动静态服务器）
    node scripts/serve-dist.mjs &
    node scripts/capture-screens.mjs     # 30 张截图 → docs/screenshots/
    node scripts/record-demo.mjs         # 4 段录屏 → docs/recording/

截图与录屏都跑在 http://127.0.0.1:5199 （scripts/serve-dist.mjs 提供 dist 静态服务 + SPA 回退），因为 mock 库放在 localStorage，必须走 http 源才能跨刷新保持。

### 入口路径

| 路由 | 状态 | 用途 |
| --- | --- | --- |
| /academy/courses/crs_2058_draft/edit | 草稿（数据完整） | 拖拽排序、保存、离开拦截的主演示 |
| /academy/courses/crs_2058_published/edit | 已发布 | 验证全字段只读与「需下架后修改」 |
| /academy/courses/crs_2058_new/edit | 新建（全空） | 验证提交前校验与后端缺失项列表 |

---

## 2. 界面结构

页面分左右两栏：左侧是六个分区（01 基本信息 / 02 课程介绍 / 03 课程大纲 / 04 学习收获 / 05 讲师 / 06 标签），右侧是 sticky 的小程序课程卡片实时预览。

顶部工具条固定，从左到右是「返回课程列表 / 页面标题 + 状态标签 + 未保存提示 / 保存草稿 / 提交审核」。页面底部有一行取证条，实时显示「基线章节顺序、当前表单章节顺序、课程介绍字数、拖动步数」，用于验收时肉眼核对顺序是否真的落库。

六个分区各自带 data-section 属性（basic、intro、outline、outcomes、instructors、tags），截图脚本按它逐个滚动截取，单测也按它定位分区边界。

---

## 3. 逐条复现 AC1–AC4

### AC1：课程大纲可拖拽排序，保存后顺序正确

**复现步骤**

1. 打开 /academy/courses/crs_2058_draft/edit，滚到「03 课程大纲」。
2. 按住第一条（开营：增长模型的六个动作）左侧的拖拽手柄，向下拖动 3 行到第 4 位，松开。
3. 观察：拖动过程中行内顺序实时变化，拖动行有蓝色描边 + 阴影；底部「当前表单章节顺序」同步变化，而「基线章节顺序」保持不变（说明是待保存的差异）。
4. 点右上角「保存草稿」。
5. 观察：出现「草稿已保存：5 个章节，顺序已落库」；「基线章节顺序」更新为拖拽后的顺序；未保存提示变为「所有修改已保存」。
6. 刷新页面。
7. 观察：章节顺序仍然是拖拽后的顺序。

**具体断言**（tests/outline.test.ts、tests/page-ac1-ac3.test.tsx）

- moveOutlineItem(items, 0, 2) 后标题序列为 ['B','C','A','D'] —— 把第 1 条拖到第 3 位，其余整体前移。
- 拖最后一条到第一位得到 ['C','A','B']。
- 原地拖动（from === to）不改变顺序。
- 越界下标被钳制：moveOutlineItem(items, 0, 99) 得到 ['B','C','A']，不抛错。
- 纯函数：拖动前后原数组的 JSON 序列化结果完全一致。
- 保存请求体里 outline[].order 严格等于 [0,1,2,3,4]，且 outline[3].title 等于拖动前的第 1 条。
- 后端按 order 排序还原出的标题序列，与拖拽后的 DOM 顺序逐项相等。
- 页面级：真实鼠标事件（mouseDown → mouseMove ×3 → mouseUp）后 DOM 顺序变化；点「保存草稿」后 readApiLog() 里 PUT 请求体的 outline 顺序与 DOM 一致；data-dirty 属性从 true 变回 false；重新挂载（模拟刷新）后顺序不变。

**边界枚举**

| 场景 | 期望 |
| --- | --- |
| 拖到列表最上方 | 成为第 1 条，其余后移 |
| 拖到列表最下方 | 成为最后一条 |
| 位移不足半行（< 28px） | 不重排，避免抖动 |
| 拖到超出列表边界 | 钳制到首/尾，不越界 |
| 松开鼠标后继续移动 | 不再改变顺序 |
| 一次拖动跨越 3 行 | 连续重排 3 次，落点由「起点 + 总位移」决定，不累积漂移 |
| 只有 1 条大纲时删除 | 拦截并提示「至少保留 1 个大纲条目」 |
| 已发布状态 | 拖拽手柄 aria-disabled="true"、tabindex="-1"，完全不可拖 |

**无障碍等价操作**：每个条目还提供上移/下移按钮（outline-up-<id> / outline-down-<id>）和大纲标题输入框上的 Alt+↑ / Alt+↓，键盘用户与触屏用户可以完成同样的排序，走同一个 moveOutlineItem。

**证据**

- 截图：docs/screenshots/11-ac1-before-drag.png → 12-ac1-drag-frame-1..3.png（拖动过程中三帧，逐帧顺序变化）→ 13-ac1-after-drag.png → 14-ac1-saved-order.png（保存后基线顺序）→ 15-ac1-after-reload.png（刷新后顺序仍在）
- 机器可读证据：docs/screenshots/ac1-order-evidence.json（before / dragFrames×3 / after / savedOrderText，含 orderChanged: true、firstTitleMovedToFourth: true）、ac1-reload-evidence.json（persistsAcrossReload: true）
- 录屏：docs/recording/ac1-drag-sort/

---

### 富文本安全（课程介绍，AC1 分区②的约束）

课程介绍允许粗体/列表/图片/链接，且要求“粘贴时清除外部样式”，因此清洗器必须同时是安全边界：

- 白名单标签：P / BR / STRONG / B / EM / I / UL / OL / LI / A / IMG / DIV；SPAN、FONT、H1–H6、TABLE 等只解包保留文字，SCRIPT / STYLE / IFRAME / OBJECT / SVG / META / LINK 整块丢弃。
- 白名单属性：仅 A 的 href、IMG 的 src 与 alt。其余属性（含 onclick/onerror/onload 等事件处理器、style、srcset、formaction）一律移除。
- 协议白名单：href 只接受 http(s)；src 只接受 http(s) 与位图 data URL（png/jpeg/gif/webp）；javascript:、vbscript:、data:text/html、data:image/svg+xml 全部拒绝（含大小写混淆与控制字符插空绕过）。
- 外链补 rel=noopener noreferrer；target 只允许 _blank。
- 入库不变式：saveDraft 写入 mock 库前再调用一次 sanitizeForStorage，与粘贴路径同源，避免“先存后渲染”的存储型 XSS。

`tests/richtext-security.test.ts` 用 11 组恶意/正常负载逐条断言清洗结果不含事件处理器与可执行协议，并含一条反向验证：把清洗函数替换成恒等函数后断言必然失败（证明用例不是恒绿）。

### AC2：已停用的讲师不可选

**复现步骤**

1. 打开草稿课程，滚到「05 讲师」。
2. 点「浏览讲师库」展开列表。
3. 观察：讲师库共 5 位，其中「何叙白」「顾南枝」两位置灰、带斜纹底纹、名字后跟「已停用」标签，且整行 aria-disabled="true"、data-selectable="false"。
4. 点击「何叙白」。
5. 观察：不进入下方已选列表，只弹出一句「何叙白的账号已停用，不可选择」；已选人数保持不变。
6. 作为对照，点击可选讲师「陆行舟」。
7. 观察：立即加入已选列表，并按上方「新添加的讲师角色」按钮当前选中的角色（默认联合主讲）落库。

**具体断言**（tests/instructors.test.ts、tests/page-ac2-ac4.test.tsx）

- mock 讲师库里 INSTRUCTORS 恰好有 2 位 status === 'disabled'。
- isInstructorSelectable 只对 status === 'active' 返回 true。
- addInstructor([], disabled) 返回 {ok:false, reason:'disabled'}，且传入的已选数组长度仍为 0（不是"加进去再回滚"）。
- 两位停用讲师分别尝试加入，已选列表长度始终为 0。
- selectableInstructors(INSTRUCTORS) 过滤后恰好 3 位，全部为 active，且不含 ins_9004。
- 页面级：instructor-option-ins_9004 渲染存在、data-instructor-status="disabled"、data-selectable="false"、aria-disabled="true"，带可见的「已停用」徽标；点击后 instructor-remove-ins_9004 不存在于已选列表。
- 对照组：instructor-option-ins_9002（active）点击后 instructor-remove-ins_9002 出现，证明上面的"没加进去"不是整体坏掉。

**边界枚举**

| 场景 | 期望 |
| --- | --- |
| 停用讲师出现在列表中 | 是（可被搜索到，便于管理员识别账号状态） |
| 停用讲师被点击 | 拒绝加入，仅提示 |
| 强制触发点击（绕过 aria） | 仍然不加入已选列表 |
| 可选讲师重复点击 | 拒绝并提示「已在课程中」，不产生重复行 |
| 至少 1 名主讲 | 无主讲时提交被校验拦截；「设为主讲」保证主讲唯一，其余自动降级为联合主讲 |

**证据**

- 截图：08-ac2-instructor-picker.png（列表展开，两项停用以斜纹置灰）、09-ac2-disabled-click-rejected.png（强制点击后已选列表未变）、10-ac2-active-selectable.png（可选讲师点击后成功加入）
- 机器可读证据：ac2-evidence.json（selectedCountBeforeClick: 2 / selectedCountAfterClick: 2 / disabledEntryAbsentFromSelected: true / clickRejectedByPlaywrightActionability: true）、ac2-control-evidence.json（entryAddedToSelected: true）
- 录屏：docs/recording/ac2-disabled-instructor/

clickRejectedByPlaywrightActionability: true 是额外证据：Playwright 的常规 click() 会因为 aria-disabled="true" 直接拒绝执行，脚本只能退化为 force: true 才能触发，而即使强制触发，已选列表也没有变化。

---

### AC3：有未保存修改时离开页面会弹窗确认

**复现步骤**

1. 打开草稿课程，什么都不改，直接点左上角「返回课程列表」。
2. 观察：直接离开，不弹窗（没有未保存修改是允许离开的前提）。
3. 回到编辑页，把「课程标题」改成任意不同的值。
4. 观察：标题下方「有未保存的修改」出现，data-dirty="true"，预览卡片标题同步变化。
5. 再点「返回课程列表」。
6. 观察：弹出「有未保存的修改」对话框，路由仍停在编辑页，URL 没有变化。
7. 点「留下继续编辑」。
8. 观察：弹窗关闭，仍停留在编辑页，刚才的修改仍然在输入框里。
9. 再点「返回课程列表」，这次点「放弃修改并离开」。
10. 观察：跳转到 /academy/courses 列表页。

**具体断言**（tests/dirty-and-validation.test.ts、tests/page-ac1-ac3.test.tsx）

- isDirty(form, {...form}) 为 false（刚加载时的基线）。
- 分别修改标题、课程介绍、大纲（含仅换顺序）、学习收获、讲师、标签、封面，isDirty 全部返回 true。
- 只调换大纲顺序也算修改：isDirty 为 true，且 toSavePayload 的 outline 标题序列确实不同。
- 保存后用返回记录重建表单，isDirty 回到 false。
- 页面级（未修改分支）：点返回后 leave-dialog 不存在，router.state.location.pathname 变为 /academy/courses，列表页渲染出来。
- 页面级（已修改分支）：点返回后 leave-dialog 出现，文案含「尚未保存」，pathname 仍是编辑页。
- 页面级（留下分支）：点「留下继续编辑」后弹窗消失、路径不变、输入框值仍含刚才的修改。
- 页面级（放弃分支）：点「放弃修改并离开」后 pathname 变为 /academy/courses，编辑页从 DOM 中消失。
- 页面级（保存后）：保存草稿再点返回，不弹窗直接离开。
- 页面级（原生拦截）：未修改时 beforeunload 事件 defaultPrevented === false；改为 dirty 后再次派发 beforeunload，defaultPrevented === true。

**边界枚举**

| 场景 | 期望 |
| --- | --- |
| 无未保存修改 | 不弹窗，直接离开 |
| 改了标题/副标题/任一下拉 | 弹窗 |
| 只改了课程介绍正文 | 弹窗 |
| 只调换了章节顺序 | 弹窗 |
| 只增删了学习收获 / 讲师 / 标签 | 弹窗 |
| 上传封面后 | 弹窗 |
| 保存草稿后 | 脏状态清除，不再弹窗 |
| 弹窗打开时按 Esc / 点遮罩 | 不关闭（必须显式选择），避免误判 |
| 刷新 / 关闭标签页 | 触发浏览器原生 beforeunload 确认 |

实现上用的是 react-router 的 useBlocker（所以必须用 createBrowserRouter 这类数据路由，BrowserRouter + Routes 拦不住），配合 beforeunload 覆盖刷新与关标签页。

**证据**

- 截图：16-ac3-dirty-indicator.png（改动后的脏提示）、17-ac3-leave-dialog.png（弹窗，遮罩后仍可见编辑页）、18-ac3-stayed-on-page.png（点「留下」后仍在编辑页、修改仍在）、19-ac3-left-to-list.png（点「放弃」后到列表页）
- 机器可读证据：ac3-evidence.json（dialogVisible: true、urlStillOnEditPage: true、dialogText 全文）、ac3-stay-evidence.json（stayedOnPage: true、titleStillDirty: true）、ac3-leave-evidence.json（navigatedAway: true、finalUrl）
- 录屏：docs/recording/ac3-unsaved-leave/

---

### AC4：已发布课程全部只读，并提示「需下架后修改」

**复现步骤**

1. 打开 /academy/courses/crs_2058_published/edit。
2. 观察：顶部标题旁状态标签为绿色「已发布」，标题下方显示「只读模式」；正文最上方出现橙色提示条「课程已发布，全部内容只读。需下架后修改：请先在课程列表点「下架」，状态回到草稿后再进入本页编辑。」
3. 逐项尝试编辑六个分区（详见下方边界枚举表）。
4. 观察：右上角「保存草稿」与「提交审核」都是禁用态。

**具体断言**（tests/page-ac2-ac4.test.tsx）

- readonly-banner 存在且文案包含「需下架后修改」；data-readonly="true"、data-course-status="published"。
- input-title / input-subtitle 的内层 input 均 disabled === true（TDesign 把 data-testid 挂在包装 div 上，断言必须向下取真实控件）。
- 四个下拉的底层 input 全部 disabled。
- intro-editor 的 contenteditable === 'false'、aria-readonly === 'true'；.richtext__btn 数量 > 0 且全部 disabled。
- [data-drag-handle] 数量 > 0，全部 aria-disabled="true" 且 tabindex="-1"。
- 所有 outline-remove-*、outline-title-* 的 input 均禁用。
- 所有 outcome-input-* 禁用，outcome-add 禁用。
- instructor-search 禁用，所有 instructor-remove-* 禁用，所有 .instructor-selected__select 禁用。
- 所有 .tag-picker__chip 的 aria-disabled === 'true'；点击一个未选中的 chip 后，tag-count-track 文案不变。
- save-draft 与 submit-review 均处于 t-is-disabled。
- 对照组：草稿课程没有提示条，input-title 可用，intro-editor 的 contenteditable === 'true'，save-draft 可用。

**边界枚举**

| 分区 | 只读覆盖点 |
| --- | --- |
| 基本信息 | 标题、副标题、类别、交付方式、可见范围、权益方式、封面上传/移除 |
| 课程介绍 | 正文不可编辑、加粗/列表/图片/链接工具栏全禁 |
| 课程大纲 | 拖拽、标题、时长、上移、下移、删除、添加章节 |
| 学习收获 | 每条输入、删除、添加 |
| 讲师 | 搜索、浏览讲师库、角色切换、设为主讲、排序、移除 |
| 标签 | 所有 chip 不可点选（已选与未选均 aria-disabled=true） |
| 全局 | 保存草稿、提交审核 |

**证据**

- 截图：20-ac4-readonly-banner.png（整页含提示条）、20b-ac4-readonly-banner-clip.png（提示条特写）、21-ac4-published-full.png（整页长图）、22-ac4-instructors-readonly.png（讲师分区只读）、23-ac4-tags-readonly.png（标签分区只读）
- 机器可读证据：ac4-evidence.json（8 个布尔位全部符合预期：titleInputDisabled、introEditable: "false"、saveDraftDisabled、submitDisabled、tagChipsAllDisabled、dragHandlesAllDisabled、outlineTitleInputsDisabled、outcomeInputsDisabled 均为期望值 true / "false"）
- 录屏：docs/recording/ac4-published-readonly/

---

## 4. 六个分区与右侧预览

| # | 分区 | 关键规则 |
| --- | --- | --- |
| 01 | 基本信息 | 标题必填、≤40 字并实时计数；副标题；类别 / 交付方式 / 可见范围 / 权益方式四个下拉必选；封面必传，选图后 canvas 居中裁剪成 16:9、长边 1280、单张 ≤5MB，只接受 PNG/JPG/WebP |
| 02 | 课程介绍 | 富文本，支持加粗 / 无序列表 / 有序列表 / 图片 / 链接；正文纯文本 ≤5000 字；粘贴时自动清除外部样式（字体、颜色、class、表格、脚本全部丢弃，只保留白名单标签） |
| 03 | 课程大纲 | 每条含标题 + 时长（分钟，1–600）；可拖拽排序，另有上移/下移与 Alt+↑/↓；至少 1 条；拖拽顺序在保存时写成 order |
| 04 | 学习收获 | 最多 8 条，超过后「添加」按钮变为「已达 8 条上限」并禁用 |
| 05 | 讲师 | 从讲师库搜索选择；角色为主讲 / 联合主讲 / 助教；可调整顺序；至少 1 名主讲；已停用讲师不可选 |
| 06 | 标签 | 只能从赛道与兴趣话题两个字典中点选，不支持自由输入；每个维度最多 3 个，达到上限后该维度其余项置灰 |

右侧预览卡片按小程序课程卡片的字段顺序渲染：封面（16:9）、状态角标、标题、副标题、标签、章节数 / 总时长 / 交付方式 / 权益方式、前 3 条学习收获、主讲头像与姓名、CTA 按钮。所有字段直接读自当前表单状态，改一处即时反映。

### 保存草稿 vs 提交审核

- 保存草稿：不跑校验，直接 PUT /academy/courses/:id/draft 落库，成功提示会带上章节数与「顺序已落库」。
- 提交审核：先跑前端校验；有错时把问题按分区列在页面顶部，并锚点到对应分区；前端通过后再调 POST .../submit-review，后端返回的缺失项会原样追加到同一张列表里，并在下方注明「其中前端校验 N 项；后端返回的缺失项 M 项」。

mock 的 serverValidate 刻意与前端不同源：前端不拦副标题为空，而后端会多返回一条「副标题：服务端要求填写」，所以「后端缺失项能被展示出来」是可观测的，不是伪造的。新建课程点「提交审核」可以看到 12 项缺失（前端 11 + 后端 1）。

---

## 5. 目录结构

    2058/
    ├─ src/
    │  ├─ api/courseApi.ts              接口层（mock 实现 + 每个函数标注的 fetch 对接点）
    │  ├─ components/
    │  │  ├─ SectionCard.tsx            分区卡片外壳（data-section 锚点）
    │  │  ├─ CoverUploader.tsx          封面上传 + canvas 16:9 裁剪
    │  │  ├─ RichTextEditor.tsx         contentEditable 富文本 + 粘贴清洗
    │  │  ├─ OutlineEditor.tsx          大纲拖拽排序
    │  │  ├─ useMouseSort.ts            拖拽 hook（固定行高换算位移）
    │  │  ├─ InstructorPicker.tsx       讲师库搜索选择（停用不可选）
    │  │  ├─ TagPicker.tsx              字典标签选择（每维度 ≤3）
    │  │  ├─ CoursePreviewCard.tsx      右侧小程序卡片预览
    │  │  └─ LeaveConfirmDialog.tsx     未保存离开确认
    │  ├─ domain/                       纯逻辑，UI 与单测共用同一份判定
    │  │  ├─ form.ts                    LIMITS / toFormState / toSavePayload / isDirty
    │  │  ├─ outline.ts                 大纲不可变排序操作
    │  │  ├─ instructors.ts             讲师可选性与角色/顺序
    │  │  ├─ tags.ts                    标签计数与上限
    │  │  ├─ validation.ts              前端校验 + 后端校验 + 分组
    │  │  ├─ cover.ts                   封面类型/大小校验与裁剪矩形
    │  │  └─ richtext.ts                富文本白名单清洗与字数
    │  ├─ hooks/useLeaveGuard.ts        useBlocker + beforeunload
    │  ├─ mocks/                        虚构数据（课程/讲师/字典/封面 SVG）
    │  ├─ pages/academy/course-edit/    CourseEditPage、CourseListPage、useCourseEditor
    │  ├─ styles/app.css                全站样式（系统字体栈，无外部资源）
    │  ├─ routes.tsx                    数据路由
    │  └─ main.tsx
    ├─ tests/                           88 个测试，8 个文件
    ├─ scripts/
    │  ├─ serve-dist.mjs                截图/录屏用静态服务器
    │  ├─ capture-screens.mjs           30 张截图 + 机器可读证据 JSON
    │  └─ record-demo.mjs               4 段录屏
    ├─ docs/
    │  ├─ screenshots/                  截图 + evidence JSON + manifest
    │  ├─ recording/                    录屏 webm
    │  └─ checks/                       tsc / vitest / build 输出留存
    └─ README.md

---

## 6. 检查结果

全部输出留存于 docs/checks/：

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | npx tsc --noEmit | 0 错误 → docs/checks/tsc.log |
| 单元/组件测试 | npx vitest run | 8 个文件 / 88 个测试全部通过 → docs/checks/vitest.log |
| 生产构建 | npx vite build | 成功 → docs/checks/build.log |

tests/setup.ts 把 mock 接口的模拟延迟归零（`setMockLatency(0)`），页面用例用 `waitForSaved()` 等待 `data-dirty` 变回 false 而不是等固定次数的 tick——详见下一节「测试稳定性」。

测试分布：

| 文件 | 数量 | 覆盖 |
| --- | --- | --- |
| tests/outline.test.ts | 10 | AC1 排序算法、越界钳制、不可变、order 落库与还原 |
| tests/instructors.test.ts | 11 | AC2 停用不可选、重复拒绝、主讲唯一、顺序归一 |
| tests/tags.test.ts | 10 | 每维度 ≤3、维度独立计数、取消后可再选、字典封闭 |
| tests/dirty-and-validation.test.ts | 22 | AC3 脏检查全覆盖、提交校验、封面 16:9/5MB、富文本 5000 字上限 |
| tests/use-mouse-sort.test.tsx | 5 | 拖拽 hook：连续跨行、向上拖动、半行阈值、边界钳制、释放后失效 |
| tests/page-ac1-ac3.test.tsx | 10 | AC1 拖拽+保存+刷新持久化；AC3 四个分支 + beforeunload |
| tests/page-ac2-ac4.test.tsx | 12 | AC2 三条含对照组；AC4 八条只读覆盖 + 草稿对照 |
| tests/richtext-security.test.ts | 8 | 富文本清洗：11 组恶意/正常负载、事件处理器与可执行协议、外链 rel、入库不变式 + 恒等函数反向验证 |

### 6.1 测试稳定性（第二批返修的核心修复）

第一批交付（commit 53260e65）在评审环境里 80 例中有 2 例失败，本机 Windows 上却稳定全绿。根因与时序有关，不是功能缺失：

- 旧用例用 `flush(10)` 等「点保存 → 保存完成」，实现是跑 10 次 `await new Promise(r => setTimeout(r, 0))`。
- `setTimeout(0)` 的最小间隔依平台而定：Windows 约 15ms（10 次≈150ms，盖住 mock 的 30ms 延迟）；Linux 容器约 1ms（10 次≈10-30ms）。
- 于是在更快/更拥挤的评审环境里，断言会读到「保存请求还没返回」的中间态，`data-dirty` 仍是 `true`，两条保存相关用例失败。

修复（4 处）：

1. `src/api/courseApi.ts`：mock 延迟由常量改为可设置（`setMockLatency` / `getMockLatency`），默认仍 30ms，页面运行行为不变。
2. `tests/setup.ts`：测试环境把 mock 延迟归零，断言不再依赖 tick 次数。
3. `tests/helpers.tsx`：新增 `waitForSaved()`（等 `data-dirty` 变回 `false`，即可观测结果）与 `waitForApiCall()`（等真实取证日志出现指定方法）。
4. `tests/page-ac1-ac3.test.tsx`：3 处 `flush(10)` 换成 `await waitForSaved()`。

验证（全部写入 docs/checks/vitest.log）：

| 场景 | 结果 |
| --- | --- |
| 在 53260e65 上把 mock 延迟提到 200ms（等价于机器更慢） | 复现出**恰好 2 条失败**，与评审反馈一致 |
| 修复后全量 `npx vitest run` | 8 文件 / 88 例全绿，EXIT=0 |
| 慢机器回归：`AUDIT_MOCK_LATENCY=100/200/300/500` | 4 档全部 88 例全绿 |
| CPU 饥饿回归：8 个忙等进程抢 CPU | 88 例全绿 |
| 反向验证：把 AC2「恰好 2 位停用讲师」改成 3 | 该文件 1 例失败、EXIT=1；复原后 11 例全绿 |

复现命令（从零，不改本仓库）：

```bash
git clone https://github.com/liaoyuqing/clawhunt-2058-academy-course-edit r && cd r
git fetch origin 53260e651375076c7a19a7708d5ce2ffac3fb6b5 && git checkout FETCH_HEAD
npm ci
sed -i "s/const LATENCY_MS = 30;/const LATENCY_MS = 200;/" src/api/courseApi.ts
npx vitest run    # 预期：2 failed | 78 passed
```

---

## 7. 截图清单

docs/screenshots/ 共 30 张 PNG（1440×900 视口，2× DPR 拍摄，交付时统一压到宽 800、48 色调色板以控制仓库体积；整页长图另行标注）：

| 文件 | 内容 |
| --- | --- |
| 00-full-page.png | 编辑页整页长图（六个分区 + 右侧预览 + 取证条） |
| 01-basic.png | 01 基本信息分区 |
| 02-intro.png | 02 课程介绍分区（富文本工具栏） |
| 03-outline.png | 03 课程大纲分区（拖拽手柄 + 时长，拖拽前基线状态） |
| 04-outcomes.png | 04 学习收获分区 |
| 05-instructors.png | 05 讲师分区（已选列表 + 角色） |
| 06-tags.png | 06 标签分区（两维度计数） |
| 07-preview-card.png | 右侧小程序预览卡片 |
| 08-ac2-instructor-picker.png | AC2 讲师库展开，两项停用置灰带「已停用」 |
| 09-ac2-disabled-click-rejected.png | AC2 强制点击停用讲师后，已选列表未变 |
| 10-ac2-active-selectable.png | AC2 对照组：可选讲师点击后成功加入 |
| 11-ac1-before-drag.png | AC1 拖动前：鼠标已悬停第 1 条手柄（手柄高亮，与 03 明确不同） |
| 12-ac1-drag-frame-1.png | AC1 拖动第 1 帧（首条下移 1 行） |
| 12-ac1-drag-frame-2.png | AC1 拖动第 2 帧（下移 2 行） |
| 12-ac1-drag-frame-3.png | AC1 拖动第 3 帧（下移 3 行） |
| 13-ac1-after-drag.png | AC1 松开后的大纲顺序 |
| 14-ac1-saved-order.png | AC1 保存后基线顺序与当前顺序一致 |
| 15-ac1-after-reload.png | AC1 刷新后顺序仍保持 |
| 16-ac3-dirty-indicator.png | AC3 改动后的未保存提示 |
| 17-ac3-leave-dialog.png | AC3 离开确认弹窗（路由仍停在编辑页） |
| 18-ac3-stayed-on-page.png | AC3 点「留下继续编辑」后修改仍在 |
| 19-ac3-left-to-list.png | AC3 点「放弃修改并离开」后到列表页 |
| 20-ac4-readonly-banner.png | AC4 已发布整页 + 只读提示条 |
| 20b-ac4-readonly-banner-clip.png | AC4「需下架后修改」提示条特写 |
| 21-ac4-published-full.png | AC4 已发布整页长图 |
| 22-ac4-instructors-readonly.png | AC4 讲师分区只读 |
| 23-ac4-tags-readonly.png | AC4 标签分区只读 |
| 25-ac4-outline-readonly.png | AC4 大纲分区只读特写（标题/时长不可编辑、增删与手柄全部禁用） |
| 26-ac4-outcomes-readonly.png | AC4 学习收获分区只读特写 |
| 24-validation-issue-summary.png | 附加：提交前校验汇总（前端 11 项 + 后端 1 项） |

配套机器可读证据（11 份）：ac1-before.json、ac1-order-evidence.json、ac1-reload-evidence.json、ac2-evidence.json、ac2-control-evidence.json、ac3-evidence.json、ac3-stay-evidence.json、ac3-leave-evidence.json、ac4-evidence.json、ac4-outline-outcomes-evidence.json、validation-evidence.json，外加 manifest.json（含每张图的字节数与 sha256，duplicateHashes 为空）。index.txt 是 AC → 文件 → 说明 的三段式映射表。

## 8. 录屏清单

docs/recording/ 每段一个子目录，内含 Playwright 录制的 webm（统一命名 page.webm）：

| 目录 | 内容 |
| --- | --- |
| ac1-drag-sort/ | 按住手柄拖到第 4 位 → 保存草稿 → 刷新 → 顺序仍在（文件名 page.webm） |
| ac2-disabled-instructor/ | 展开讲师库 → 悬停并点击停用讲师被拒 → 点击可选讲师成功加入 |
| ac3-unsaved-leave/ | 改标题 → 点返回弹窗 → 留下继续编辑 → 再返回放弃并离开 |
| ac4-published-readonly/ | 已发布课程逐分区滚动，展示全字段禁用与提示条 |

---

## 9. 实现说明与设计取舍

为什么用数据路由（createBrowserRouter）：useBlocker 只在数据路由下能拦截住真实跳转（含浏览器前进后退）；BrowserRouter + Routes 的组合拦不住。测试里用 createMemoryRouter 复用同一份路由表，保证单测走的是和生产一致的导航路径。

为什么拖拽用固定行高换算，而不读 getBoundingClientRect：jsdom 里所有 rect 都是 0，读 rect 会让拖拽行为只能在真实浏览器里验证。改成「位移 ÷ 固定行高（56px）= 跨越行数」后，jsdom 与真实浏览器的排序结果完全一致，AC1 可以用真实鼠标事件做页面级断言，而不只是靠截图肉眼确认。位移始终相对按下点换算，中途回头再前进不会累积漂移。

为什么把 SectionBlock 定义在模块作用域：如果写成 CourseEditPage 内部的函数组件，每次父组件重渲染都会产生新的组件类型，React 会卸载重建整棵子树 —— 拖拽 hook 的拖动状态丢失（表现为"连续拖动只生效第一步"），输入框也会反复失焦。这是调试过程中实际踩到的坑。

为什么 mock 库放在 localStorage：保存草稿后刷新页面，章节顺序仍然正确，这是 AC1 的可观测证据之一，比只在内存 state 里保留更接近真实。截图脚本因此走 http:// 静态服务而不是 file://。

为什么封面用内联 SVG data URL：订单要求页面不引用任何外部资源，而截图里封面必须真实可见。data URL 同时满足"零外部请求"和"演示可见"。

为什么讲师可选性、标签上限、脏检查都收敛到 src/domain/ 的纯函数：UI 与单测共用同一份判定，避免"测试里禁用、页面上还能点"的两套逻辑。比如讲师是否可选只由 isSelectable/selectableInstructors 决定，页面和 tests/instructors.test.ts 断言的是同一个函数。

接口对接点：src/api/courseApi.ts 里每个函数都在 JSDoc 标注了对应的方法与路径（GET /academy/courses/:id、PUT /academy/courses/:id/draft、POST /academy/courses/:id/submit-review、GET /instructor-library?keyword=），当前 USE_MOCK = true 走 localStorage，替换为真实 fetch 时只需改这一个文件。

---

## 10. 安全与合规

- 无外部请求：字体用系统字体栈（-apple-system / PingFang SC / Microsoft YaHei），图标来自本地安装的 tdesign-icons-react 包，富文本用浏览器原生 contentEditable + execCommand，不接任何第三方富文本云服务，没有 Google Fonts、外部 CDN 或统计脚本。
- 粘贴清洗：白名单标签（P/BR/STRONG/B/EM/I/UL/OL/LI/A/IMG/DIV）+ 白名单属性（仅 A.href、IMG.src/alt）；script/style/iframe/table/span/font 等一律丢弃；href 必须 http(s)，javascript: 与内联事件处理器被移除。有对应单测。
- 数据虚构：课程、讲师、机构名全部为虚构（「示例科技」「示例研究院」），不含任何真实客户名称或个人信息。
- 上传限制：封面只接受 PNG/JPG/WebP，≤5MB，在客户端完成裁剪，不上传到任何服务器。

---

## 11. 提交流水（本次交付实际执行记录）

| 步骤 | 结果 |
| --- | --- |
| 类型检查 | npx tsc --noEmit 退出码 0，零错误（docs/checks/tsc.log，末行含 EXIT=0） |
| 单元/组件测试 | 8 files / 88 tests 全绿（docs/checks/vitest.log，含 Test Files 与 Tests 汇总行） |
| 生产构建 | vite build 成功，3933 modules（docs/checks/build.log） |
| 无外部引用审计 | src 内仅出现 http(s) 协议前缀与 data URL SVG，无外链资源（docs/checks/no-external-refs.log） |
| 预检 | POST /api/v1/problems/2058/solution/precheck 返回 defective checks 为空；LLM critic 因上游不可用返回 error，平台注明 this is NOT a fail |
| 正式提交 | POST /api/v1/problems/2058/solution → status=submitted，latest_delivery_version=1 |
| 平台自动预检 | delivery_check.status=checked，4 条验收标准全部 matched；relevance/substance/feasibility matched |

预检与提交的原始响应属于内部档案（含平台侧评分数与工具提示），按规范不随交付物发布：它们留在交付方本地目录，本仓库只保留上面这张复核表。评审要复现任何一条，直接用第 1、3 节的命令与本仓库文件即可，不依赖这些内部响应。

## 12. 仓库卫生

- 令牌：scripts/ 下两个预检脚本原先内联了 API 令牌，现已改为从环境变量 CPH_KEY 读取（脚本首行注释说明）。仓库中不再有任何令牌、密钥或私有地址。
- 内部档案：早期误提交的预检/提交载荷、订单原始 JSON 与交付正文草稿已从工作区移出，并加入 .gitignore；当前分支的文件列表中不含这些内容。
- 体积：截图与录屏已按评审可读性二次压缩，仓库工作区总共约 1.6MB（截图 30 张 800 宽 48 色调色板共约 720KB，四段录屏 640 宽 6fps 共约 290KB），便于平台抓取与评审快速拉取；仓库不含任何二进制大对象遗留。
- 历史：早期提交里曾出现上述文件，已通过重写历史移除；当前 main 分支的每个可达提交都不含令牌与内部载荷。若需逐条核对，可执行 git log -S 令牌前缀 --all 与 git log -S submit_result --all，两者在当前历史中均无结果。
