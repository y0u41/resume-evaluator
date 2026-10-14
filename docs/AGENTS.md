# 简历参谋开发指令

## 项目概述
简历参谋（resume-evaluator）：面向求职者（尤其应届生）的简历评估工具，贴简历 + 岗位 → 结构化评分报告 + 改法 + 岗位匹配，覆盖「评估 → 多岗对比 → 改简历 → 面试准备」闭环。

形态：单仓库；前端 React 19 + TypeScript + Vite，后端 Express 5 + better-sqlite3，LLM 走 OpenAI 兼容接口（DeepSeek / 智谱 GLM）。代码注释与产品文案用中文，提交信息用中文。生产为腾讯云 Ubuntu 24.04 + Node 20 + pm2，代码在 `/opt/git/resume-evaluator`，进程名 `resume-evaluator`，线上 `http://<服务器公网IP>:3001`。

## 开发规范
- 完成任何改动后必须运行 `npm run typecheck` + `npm test`；改到前端构建相关再跑 `npm run build`
- 常用命令：`npm run dev`（前端 5173 + 后端 3001）、`npm run build`、`npm start`（Express 托管 `dist/`）、`npm test`、`npm run acceptance`（黑盒端到端验收：真实 HTTP + 临时库，无需 LLM Key）、`npm run typecheck`、`npm run create-admin -- <用户名> <密码>`
- 目录职责：`server/`（core 领域服务 / llm 调用与提示词 / routes / scoring 客观分 / http 信封 / jobs 定时 / seo）｜`src/`（pages / components / lib：api·auth·tasks·report·resume·ui）｜`shared/` 结构化简历 Schema（前后端共用）｜`docs/` 文档 + adr + features｜`deploy/` 部署模板
- 鉴权：除注册 / 登录 / 游客 / 分享 / 关键词库外，所有 `/api/*` 需登录（`requireAuth`）；管理员接口额外 `requireAdmin`；数据按 `user_id` 隔离
- 改数据库表结构的唯一方式：往 `server/core/db.js` 的 `MIGRATIONS` **尾部**追加 `{ v: 上一个 v + 1, up }`；**不要修改历史迁移**（已上线的库不会重放），新增列用 `columnExists()` 守卫，数组外不写裸 `CREATE TABLE` / `ALTER TABLE`；迁移同步执行，不要 async（见 `__tests__/migrations.test.js`）
- 新增 API 前缀必须同步 `server/index.js` 的 `API_PREFIXES`，否则被网关拦成 404（1004）而非预期错误
- 路由挂载顺序：`guest` / `share` / `keywords` / `pro` 必须在含全局 `requireAuth` 的 `evaluateRoutes` **之前**，否则被拦成 401
- 报告格式即产品契约：`server/llm/prompt.js` 的 `【】` 小节与 `|` 对照行必须与 `src/lib/report/report.ts` 的解析逻辑同步，改一处要同步另一处
- 结构化简历契约：`shared/resumeSchema.js` 是单一事实来源，改字段同步 `resumeSchema.d.ts` 与 `src/lib/resume/resumeSchema.ts`；写严读宽、未知字段丢弃
- 更新评估记录必须走 `revision` 乐观并发，冲突返回 409 + `details.currentRevision`，不得绕过检查直接 UPDATE
- 额度「先扣后用」，失败必须退还：新增任何 `consumeQuota` 调用点都要配对退还逻辑（`finally` 覆盖提前 return，或幂等 `refundQuota` / `refundOnce()`；管理员跳过、不退成负数），并在 `server/__tests__/quota.test.js` 覆盖
- 任何写 `users.plan` 的代码都必须同时写 `plan_expires_at`（未过期 = 顺延，周期 `PRO_PERIOD_MONTHS` 默认 1）；套餐判定只走 `server/core/plans.js` 的 `normalizePlan`（`getUserFromToken` 会懒落库，过期 PRO 自动改回 free）
- 统一响应信封：所有 JSON 经 `server/http/envelope.js` 包裹（`code/message/requestId`，错误保留 `error`），新增业务错误用 `docs/error-codes.md` 里的码
- CSP 为 `script-src 'self'`，**禁止内联 `<script>`**；需要首屏脚本时用 `public/theme-init.js` 这类外置文件
- 不要给构建产物加 `crossorigin`（生产白屏的历史原因），`vite.config.ts` 的 `remove-crossorigin` 插件勿删
- 原生 / 重型依赖必须动态 `import()`（`pdf-parse`、`mammoth`、`word-extractor`、`pdfjs`），否则服务器启动可能段错误
- Node 版本用 20 LTS（`better-sqlite3` 在更高版本可能编译失败）
- 新增 LLM 调用务必带上 `...thinkingParam(baseUrl)`（默认关闭推理模型思考链），并区分 `delta.content` 与 `delta.reasoning_content`
- 新增数据库表必须能被 purge 测试分类：含 `user_id` → 自动清理；否则显式登记进 `NON_USER_TABLES` 白名单
- 前端用 `dangerouslySetInnerHTML` 渲染用户内容前必须转义（见 `resumeTemplate.ts` 的 `escapeHtml` / `safePhoto`，照片白名单仅 `data:image/*`）
- 简历模板 CSS 只加在 `App.css` 的 `.rtpl-*` 作用域下，不得用 `@page` / `body` 等全局样式（预览与 PDF 共用同一份 HTML）
- 测试：新增业务逻辑补对应单测，可用 `DB_PATH=:memory:` 隔离；真实文件解析（尤其图片型 PDF / 图片）改动后建议用真实样本手工验证一次

## 功能要求
- 用户：邮箱注册 / 登录（JWT + httpOnly Cookie，默认 7 天）、管理员用用户名登录、个人中心、注销（7 天冷静期、可撤销、到期物理删除账号与全部数据）
- 游客试用：免登录按 IP 试用（`GUEST_LIMIT` 默认 3 次，A/B 可 5）、结果打码预览、不落库；`guest_trial` 埋点须在关键词抽取**之前**记录
- 评估：简历全文 + 应聘岗位（必填）、岗位 JD（选填）→ 固定 9 节报告（总分 / 一句话结论 / 岗位匹配对照 / 三大优点 / 问题清单 / 逐条改法 / AI 修改建议 / 关键词补齐 / 可继续增强的方向），SSE 流式输出；缺简历或岗位先追问补齐
- 岗位匹配对照：逐条列出 JD 要求，✅ / ⚠️ / ❌ 标注 + 匹配度进度条
- 客观评分（算法）：词典驱动的确定性引擎，四维评分 + `matchRate`；关键词**优先由 LLM 从 JD 抽取**（`extractJdKeywords` + `jd_keywords` 哈希缓存），失败回退内置词典；匹配算法本身不发网络请求
- ATS 可解析性检测：`server/scoring/ats.js`（姓名首行 / 联系方式 / 邮箱 / 板块标题 / 日期格式 / 要点符号），随 `objective.ats` 返回；改动同步 `server/__tests__/scoring.test.js`
- 应届生模式、继续追问、修改重评（乐观并发）
- 录入方式：粘贴；上传 PDF / DOCX / DOC / TXT / MD（≤10MB）；图片与图片型 PDF 走视觉模型 OCR（≤5 页，未配置视觉模型返回明确错误）；岗位链接抓取并智能提取岗位重点（**SSRF 防护必须保留**）
- PDF 文本按坐标重建「视觉阅读顺序」（修正设计型 PDF 乱序，`server/core/pdfText.js`）；改动同步 `server/__tests__/pdfText.test.js`
- 简历 Builder：6 套视觉模板（单栏经典 / 左右分栏 / 简洁单栏 / 时间轴 / 黑色极简线条 / 蓝色左右分栏）× 3 种内容顺序、证件照、多版本管理、导出 PDF / Word / TXT / Markdown
- 多岗位对比（2–4 岗，逐岗成功才扣费）、模拟面试、岗位方向推荐（3–5 个方向）
- 历史记录：同一人（`person_key`）最多保留 30 条，清理时跳过 `favorite=1` 与最高分；结果页展示 `previousScore` / `scoreDelta` 改进轨迹；下载历史保留最近 100 条
- 分享报告：`GET /api/share/:token` 免登录只读、带水印、可选隐藏联系方式与隐藏姓名；**简历原文默认不分享**（需显式 `includeResume`）；token 默认 30 天过期（`SHARE_TTL_DAYS`）；分享页与接口均带 `X-Robots-Tag: noindex`
- 额度与套餐：免费 100 / PRO 500 次每天，高级模型与 OCR 单独计数；管理员不受限、不计数；免费档默认走免费模型（GLM-Flash）。计数在 `quota_counters(user_id, day, kind)`（`total` / `premium` / `ocr`），入口 `consumeQuota(user, { isPremium, isOcr })`
- 额度预警：`GET /api/quota` + 顶部预警条（用量 ≥80%），阈值取服务端 `warnAt`，前端不得写死；**任何「升级 / 开通 / 额度」文案都必须能落到 `/pro`**
- 升级 PRO：`/pro` 页（套餐对比 + ¥9.9 + 收款码 / 外链 + 付款邮箱表单）→ 管理员批准即开通；支付配置走 `PRO_PAY_QR` / `PRO_PAY_URL` / `PRO_PAY_NOTE`
- 岗位关键词库：`jd_keywords` 沉淀 → 归类清洗聚合 → 服务端渲染 `/keywords`、`/keywords/:slug`、`robots.txt`、`sitemap.xml`（前端入口必须用原生 `<a>`）；冷启动未达门槛的页面 `noindex` 且不进 sitemap
- 埋点与运营：`server/core/events.js` 的 `EVENT_NAMES` 白名单事件（`register` / `first_evaluate` / `report_read` / `followup` / `download` / `return_7d` / `guest_trial` / `register_from_guest` / `report_parse*`，非白名单静默忽略）、结果页反馈与投票（`feedback` 表 + `POST /api/feedback`）、成本看板（`llm_usage` 表 + `usage.js` 的 `withUsageContext` 采集 token）
- 后台任务：评估 / 多岗对比 / 模拟面试 / 岗位推荐在应用级后台运行（切换页面不中断、可并行），结果全部落库；客户端只持久化任务元数据
- 体验：PWA（可添加到主屏幕）、深色模式、多模型切换（按提供商分组、选择记忆）、悬浮任务栏

## 注意事项
- **安全红线**：绝不硬编码 / 提交 API Key 或密码；不提交 `.env`、`data/`、`backups/`、`public/pay-qr*`
- 未经明确指示，**不要执行 `git commit` / `git push`**
- 不改动 `AUTH_SECRET`、限流、SSRF 防护等安全逻辑，除非任务明确要求
- `TRUST_PROXY` 默认 0（直连，不信任 `X-Forwarded-For`）；部署在反向代理后必须显式设 1，否则游客限流按代理 IP 串味
- `COOKIE_SECURE` 与协议匹配：HTTP 部署用 `false`，启用 HTTPS 后改 `true`
- Caddy 不要对 SSE 压缩（会缓冲导致评估流"卡住"，见 `deploy/Caddyfile`）
- 静态资源策略：`/assets/` 长缓存、`index.html` 不缓存；500 不向客户端泄露内部错误
- 游客关键词与注册路径必须一致：用同一 `getJdKeywords(jd, signal, { isStudent })`、同一 override，不得硬编码 `isStudent: false`
- 客户端断开后服务端**不中止 LLM**（写出走 `safeWrite`）；流式空结果必须回退非流式，且**绝不落空报告**
- 并发与排队：`MAX_CONCURRENCY`（默认 5）同时执行，超出进 `MAX_QUEUE`（默认 50）等待，满则拒绝并向客户端回报排队位置
- 报告解析降级率（ADR-0007）：看 `report_parse` / `report_parse_fallback` 与 `server/core/parseHealth.js`；触发条件为「样本 ≥200 且降级率 >5%」，改阈值需同步 ADR
- 免费额度是数据驱动的：用 `usageDistribution`（只统计免费档）调 `FREE_DAILY_LIMIT`，样本 < `USAGE_DIST_MIN_SAMPLE`（默认 100 用户×天）时不要改；两套建议值里**优先用目标法**（`USAGE_TARGET_WARN_PCT` 默认 10），启发式 `P90×1.5` 实测可能 0% 触发；预警比例 `QUOTA_WARN_RATIO` 默认 0.8
- 岗位关键词库冷启动门槛：分类需 `jdCount ≥ KEYWORDS_MIN_JD`(5) 且关键词数 `≥ KEYWORDS_MIN_KEYWORDS`(10) 才 `publishable`，全站需 `totalJds ≥ KEYWORDS_MIN_TOTAL_JD`(20) 才 `siteReady`；绝对链接用 `SITE_URL`
- 游客 A/B 单组样本阈值 `GUEST_AB_MIN_SAMPLE`（默认 100），低于它返回 `enoughSamples=false` 并提示「样本量不足，仅供参考」
- 推理模型思考链可用 `LLM_THINKING=enabled` 恢复；成本单价可用 `LLM_PRICE_JSON` 覆盖；LLM 超时 `LLM_TIMEOUT_MS`、流式停滞 `LLM_STREAM_IDLE_MS`
- 游客转化实验：`GUEST_AB_LIMITS` / `GUEST_AB_PREVIEW` 按 IP 稳定分桶；后台卡片必须保留两条免责声明（`localStorage` 归因漏计、双因素交互污染）
- 「同一个人」以简历首个非空行（通常为姓名）识别，重名会合并
- 数据落位：现役库是 `server/data/app.db`（旧 `data/app.db` 为历史遗留）；备份在 `backups/app-YYYY-MM-DD.db`，保留 7 份、含隐私，服务器上应 `chmod 700`
- 定时任务：注销到期清理（启动 + 每 6h）、`startPurgeJob` 同时清理过期 `guest_trials`（2 天）与 `jd_keywords`（90 天）、每日在线备份
- `pdfjs-dist` 依赖 `Promise.withResolvers`，已在 `core/pdfText.js` 加 Node 20 兼容 polyfill，勿删
- 成本告警：昨日估算成本超 `DAILY_COST_ALERT_YUAN` 时启动日志告警，明细看 `/admin` 成本看板
- 上线流程：`git pull && npm ci && npm run build && pm2 restart resume-evaluator`；详细步骤见 `DEPLOY.md`
- 文档同步：改功能后同步 `docs/`（PRD / Tech_Design / features / ADR），改阈值同步对应 ADR
