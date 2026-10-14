# 技术设计

## 技术栈
- React 19 + TypeScript + Vite（构建到 `dist/`，生产由 Express 静态托管）
- 原生 CSS（`src/App.css`，无 UI 框架、**未使用 Tailwind**）
- react-router-dom 7（SPA 路由）
- Express 5（Node 20 LTS）
- better-sqlite3（WAL 模式，单文件、同步 API、零运维）
- jsonwebtoken + cookie-parser（JWT 存 httpOnly Cookie）
- Zod 4（结构化简历 Schema，`shared/` 前后端共用）
- LLM：智谱 GLM / DeepSeek，OpenAI 兼容接口，全部在服务端调用
- 文件解析：pdfjs-dist（阅读顺序重建）/ pdf-parse / mammoth / word-extractor / 视觉模型 OCR
- 网页抓取：cheerio（服务端解析正文）
- 导出：jspdf + html2canvas（PDF，图片式）+ docx（Word）
- 测试：vitest（26 个文件 / 160 个用例）；进程守护 pm2；反代 Caddy（可选，自动 HTTPS）

## 数据结构
- 数据库：SQLite，路径 `server/data/app.db`（`DB_PATH` 可覆盖，测试用 `:memory:`）
- users：id、email（唯一）、username（管理员登录名，唯一可空）、role（`user` / `admin`）、password_hash（scrypt 加盐）、plan（`free` / `pro`）、plan_expires_at（NULL = 永久）、deleted_at、purge_after、created_at
- evaluations：id、user_id、resume、job_title、job_description、job_url、score、report、objective_json（客观分 JSON）、candidate_type（`general` / `student`）、person_key、person_name、cache_key、revision（乐观并发）、favorite、share_token、share_hide_contact、share_hide_name、share_include_resume、share_expires_at、created_at
- quota_counters：主键（user_id、day、kind），kind = `total` / `premium` / `ocr` → count（分层额度计数）
- usage_log：（user_id、day）→ count（旧计数字段，已迁移进 quota_counters）
- downloads：id、user_id、kind（`report` / `resume`）、title、format、created_at
- jd_keywords：hash（JD 文本哈希，主键）、keywords、job_title、hits、created_at、updated_at
- guest_trials：（ip、day）→ count（游客试用计数）
- events：id、user_id、name、meta、created_at（最小埋点）
- feedback：id、user_id、kind、rating、content、context、created_at
- llm_usage：id、user_id、feature、model、prompt_tokens、completion_tokens、total_tokens、created_at（成本看板）
- pro_requests：id、user_id、note、pay_email、status（`pending` / `approved` / `rejected`）、created_at、handled_at
- 索引：evaluations(person_key)、evaluations(user_id)、evaluations(user_id, cache_key)、evaluations(share_token) 唯一（WHERE NOT NULL）、users(username) 唯一（WHERE NOT NULL）、downloads(user_id)、events(name, created_at)、llm_usage(feature, created_at)、feedback(kind, created_at)、pro_requests(status, id)
- 迁移：`db.js` 的 `MIGRATIONS` 数组（v1–v13），启动时按 `PRAGMA user_version` 顺序回放；**只能往尾部追加**，新增列用 `columnExists()` 守卫，老库平滑升级
- 隔离：所有业务表带 `user_id`；注销时用 `PRAGMA table_info` 自动发现含 `user_id` 的表并清空
- 前端本地存储（LocalStorage）：任务元数据 `resume_tasks_v1`、模型选择 `llm_model`、主题 `theme`、简历草稿与多版本 `resume_builder_draft` / `resume_builder_versions`、投票 `fb_<id>`、预警关闭标记

## API 调用
- LLM：OpenAI 兼容 Chat Completions（智谱 GLM / DeepSeek），服务端发起
- 流式输出：`stream: true`，逐 chunk 解析 `delta.content`，经 SSE 下发给前端
- API Key 存放在服务端环境变量（`<PROVIDER>_API_KEY` / `_BASE_URL` / `_MODEL`），**不下发前端**
- 关闭推理模型思考链：对 DeepSeek 默认注入 `thinking: { type: "disabled" }`（`LLM_THINKING=enabled` 可恢复），避免思维链耗尽 `max_tokens` 导致正文为空
- 超时与重试：总超时 `LLM_TIMEOUT_MS`；流式另有停滞超时 `LLM_STREAM_IDLE_MS`，无数据即**回退非流式**；`LLM_MAX_RETRIES` 对限流 / 5xx / 超时重试
- 温度适配：智谱 `temperature` 区间为 (0,1)，不支持 0（已适配）
- OCR：`ocrImage()` 以 `image_url` 调视觉模型，`temperature: 0`，图片型 PDF 最多 5 页
- JD 关键词抽取：`extractJdKeywords()` 结果按 JD 哈希缓存（`jd_keywords`），失败回退内置词典
- 用量记录：每次调用后写 `llm_usage`（token），供成本看板与额度校准
- 接口列表（入站 HTTP）：
  - 认证：`POST /api/auth/register`、`/login`、`/logout`、`GET /api/auth/me`
  - 评估：`POST /api/evaluate`（SSE）、`/compare`、`/followup`、`/interview`、`/directions`
  - 记录：`GET /api/evaluations`、`GET|PUT|DELETE /api/evaluations/:id`、`PUT /api/evaluations/:id/favorite`
  - 分享：`POST|DELETE /api/evaluations/:id/share`、`GET /api/share/:token`（免登录）
  - 解析与抓取：`POST /api/parse-file`、`POST /api/fetch-url`、`GET /api/models`、`POST /api/resume/validate`
  - 账号：`GET /api/account/status`、`POST /api/account/delete`、`/cancel-delete`
  - 额度与 PRO：`GET /api/quota`、`GET /api/pro/plan`、`GET|POST /api/pro/request`
  - 导出记录：`GET|POST /api/downloads`
  - 埋点与反馈：`POST /api/events`、`POST /api/feedback`
  - 游客：`POST /api/guest/evaluate`、`GET /api/guest/quota`（免登录）
  - 关键词库：`GET /api/keywords`、`/keywords/:slug`（免登录）
  - 管理员：`GET /api/admin/users`、`POST /api/admin/users/:id/plan`、`GET|POST /api/admin/pro-requests(/:id)`、`GET /api/admin/events`、`/parse-health`、`/guest-experiment`、`/usage`、`/usage-distribution`、`/feedback`
  - 健康检查：`GET /api/health`
- 响应约定：所有 JSON 经统一信封 `{ code, message, requestId, ... }`（SSE 不走信封，事件为 `chunk` / `queued` / `progress` / `error` / `done`）
- 网关：`API_PREFIXES` 白名单，未知 `/api` 前缀直接 404（1004），避免被鉴权中间件误判为 401
- 路由挂载顺序：游客 / 分享 / 关键词库 / PRO **必须先于** 含全局 `requireAuth` 的 evaluateRoutes

## 鉴权与安全
- 密码：scrypt 加盐哈希存储，不存明文
- 登录态：JWT 写入 httpOnly Cookie，`AUTH_SECRET` 签名，`AUTH_TOKEN_TTL`（默认 7 天）控制有效期
- 中间件：`requireAuth`（除注册/登录/游客/分享/关键词库外全部接口）、`requireAdmin`
- 限流：全局 120/min；评估 / 追问 / 抓取 / 解析 30/min；认证 20/min；游客 10/min
- SSRF 防护：链接抓取拒绝内网 / 回环 / 链路本地地址，逐跳校验重定向（≤5 跳），15s 超时
- 安全响应头：helmet + CSP（`script-src 'self'`，允许内联样式，`img-src data: blob:`），关闭 upgrade-insecure-requests 与 COEP/COOP/CORP
- 内联脚本禁令：首屏主题脚本外置为 `public/theme-init.js`；构建产物不加 `crossorigin`
- 错误处理：500 不向客户端泄露内部错误细节
- TRUST_PROXY 默认 0（直连，不信任 `X-Forwarded-For`），反代后必须显式设 1

## 并发、缓存与额度
- 并发队列（`core/queue.js`）：`MAX_CONCURRENCY`（默认 5）同时执行，超出进等待队列 `MAX_QUEUE`（默认 50），满则拒绝并回报排队位置
- 结果缓存（`core/store.js`）：`computeCacheKey(resume, jobTitle, jd, override)`，命中且未过期直接返回（`CACHE_TTL_HOURS` 默认 24）
- 额度（`core/quota.js` + `core/plans.js`）：免费 100 / PRO 500 次每天，高级模型与 OCR 单独计数，管理员不限不计数
- 先扣后退：`withQuota()` 为唯一计费入口，失败自动 `refundQuota`，不出现「失败了次数却少了」；`/compare` 为逐岗成功才扣
- PRO 有效期：`normalizePlan(user)` 为唯一判定入口，过期即时回落 free（无需定时任务）
- 失败回退：流式停滞 → 非流式；失败不保存空报告
- 优雅停机：SIGTERM/SIGINT → 停止接新任务 → 等活跃任务（≤35s）→ WAL checkpoint → 退出（pm2 `kill_timeout: 40000`）
- 定时任务：注销到期清理（启动 + 每 6h）、每日在线备份到 `backups/app-YYYY-MM-DD.db`（保留 7 份）
- 请求日志：`LOG_REQUESTS` 输出 requestId / 方法 / 路径 / 状态 / 耗时

## 提示词与报告契约
- `llm/prompt.js`：资深招聘官人设 + 评分规则 + **固定 9 节输出格式**（`【】` 小节 + `|` 三段对照行）；追问 / 面试 / 方向各一套提示词
- 报告即产品契约：`prompt.js` 的小节名与 `src/lib/report/report.ts` 的 `KNOWN_SECTIONS` 必须同步；未识别小节会被并入上一节（降级为纯文本时记 `report_parse_fallback`）
- 硬约束：必须引用简历原话作证据，禁止编造用户未写过的经历 / 数字 / 证书
- 确定性客观分（`server/scoring/`）：词典驱动，`matchRate = Σ(命中权重)/Σ(总权重)` + 四维评分（完整性 / 关键词覆盖 / 格式规范 / 量化成果）+ ATS 结构检查，与 LLM 报告并存互补

## 前端设计
- 路由：`/login`、`/privacy`、`/share/:token` 公开；`/`、`/result/:id`、`/result/task/:taskId`、`/history`、`/builder`、`/compare`、`/interview`、`/directions`、`/pro`、`/admin` 由 `Protected` 包裹
- 状态：4 个 Context（Auth / Toast / Task），无 Redux
- 鉴权：启动时 `GET /api/auth/me` 恢复会话；接口 401 自动跳登录页
- 流式接收：`src/lib/api.ts` 的 `postStream()` 读取 SSE 并分发 chunk / queued / progress / done
- 后台任务：`lib/tasks.tsx` 的 `TaskProvider` 位于路由之上，长任务切换页面不中断、可并行；`TaskDock` 悬浮展示，完成后跳结果页
- 报告渲染：`report.ts` 解析 9 节 → 分卡片渲染；匹配对照识别 ✅/⚠️/❌ 并算匹配度；`reportToHtml` 生成导出用 HTML
- 简历模板：6 套视觉模板 × 3 种内容顺序，受限 Mustache 渲染（默认 HTML 转义），照片白名单仅 `data:image/*`；模板 CSS 限定在 `.rtpl-*` 作用域
- 导出：PDF 走 html2canvas + jspdf（图片式，760px 版心），Word 走 docx，另支持 TXT / Markdown
- PWA：`manifest.webmanifest` + `sw.js`；深色模式由外置 `theme-init.js` 首屏设定
- SEO 页例外：`/keywords`、`/keywords/:slug`、`/robots.txt`、`/sitemap.xml` 由服务端渲染，前端入口必须用原生 `<a>`

## 部署
- 结构：用户 →（Caddy :443，可选自动 HTTPS）→ Node/Express :3001 → SQLite（`server/data/app.db`），pm2 守护 + 开机自启
- 流程：`git pull && npm ci && npm run build && pm2 restart resume-evaluator`
- 开发模式：前端 Vite 5173 + 后端 3001，`/api` 代理；生产模式：同源部署，无 CORS
- 静态缓存：`/assets/`（带哈希）长缓存，`index.html` 不缓存；分享页响应带 `X-Robots-Tag: noindex`
- Caddy 注意：SSE 不得压缩 / 缓冲（`flush_interval -1`），并传真实 `X-Forwarded-For`（配 `TRUST_PROXY=1`）
- 备案：国内服务器需 ICP 备案，未备案只能用 `IP:端口`（无 HTTPS）；香港服务器免备案

## 关键技术决策
- SQLite 而非 Postgres：零运维、单文件易备份；换取并发上限（中小规模足够）
- 同源生产部署：规避 CORS；代价是前端须先 build
- 报告用固定文本格式（`【】` + `|`）而非全量 JSON：模型易遵循；代价是格式偏差需前端降级（ADR-0007）
- 确定性评分引擎与 LLM 并存：可复现、可解释、零外部依赖；代价是与 LLM 判断可能不一致（ADR-0001）
- 结构化简历 Schema（Zod）为单一事实来源：契约明确、校验集中（ADR-0002）
- 统一响应信封（中间件拦截）：一处生效、向后兼容（ADR-0003）
- 成功后计费 + 失败自动退还：`withQuota` 唯一入口（ADR-0008）
- 注销 7 天冷静期：可撤销 + 到期物理删除（ADR-0004）
- 乐观并发（`revision`）：冲突返回 409 + `currentRevision`（ADR-0006）
- 后台任务 Provider 位于路由之上：切页不中断；代价是内存态，刷新后客户端不再续跑（服务端跑完落库）
- 延迟加载原生库（pdf-parse / mammoth / word-extractor / pdfjs）：避免启动段错误；代价是首次解析略慢
- 外部 theme-init.js：适配严格 CSP；代价是多一个静态文件

## 规模触发器
- 以下是保守的**迁移触发信号**，未触发前不提前优化
- SQLite：日评估 > 500 次，或需部署第二实例 → Postgres（约 2–3 天）
- 内存队列：部署第二实例，或排队等待成常态（均值 > 10 分钟）→ Redis + BullMQ（约 2 天）
- 游客 IP 限流 / A/B 分桶：部署第二实例 → Redis 计数器（约 1 天）
- events / llm_usage 聚合变慢：admin 页加载 > 2s → 预聚合日表（SQLite 内即可，约半天）

## 已知技术债
- PDF 导出为图片式（文字不可选中），可研究可编辑 PDF 方案
- 报告解析依赖模型遵循文本格式，可评估结构化输出（JSON Schema）
- 缓存键与人物识别是轻量实现，重名 / 相似简历可能误合并
- PDF 阅读顺序按 y/x 单栏重建，复杂双栏版面可再做列切分
- 后台任务元数据在客户端 `localStorage`，刷新后客户端不续跑（服务端会跑完并落库）
- 尚未接入真实支付网关，PRO 走「提交申请 → 管理员批准」人工流程
- 无 HTTPS（受备案限制），可换香港服务器或补备案
