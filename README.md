# 📄 简历参谋

![License](https://img.shields.io/badge/license-MIT-green) ![React](https://img.shields.io/badge/React-19-61DAFB) ![Express](https://img.shields.io/badge/Express-5-000000) ![LLM](https://img.shields.io/badge/LLM-AI-orange) ![Tests](https://img.shields.io/badge/tests-26%20files-brightgreen)

> 面向求职者的 AI 简历评估工具，贴简历 + 说岗位 → 评分、挑刺、改法、岗位匹配 🎯

## 这是什么？

一个帮你**优化简历、匹配岗位、准备面试**的全流程 AI 工具。不只是打分，而是给出**具体的修改建议**和**可执行的改进方向**。

**适合场景**：
- 🎓 应届生：不知道简历哪里有问题，该怎么改
- 🔄 转行者：想了解目标岗位的匹配度
- 📝 求职者：需要针对性地优化多份简历

## ✨ 功能特性

### 核心功能
- 📊 **简历评估**：十分制评分、一句话结论、三大优点、问题清单、逐条改法
- 🎯 **岗位匹配**：逐条对照 JD，✅/⚠️/❌ 标注 + 匹配度进度条
- 🔑 **ATS 关键词**：红标签展示该补哪些关键词
- 📝 **应届生模式**：不因缺经验扣分，重点看项目/实习/潜力

### 进阶功能
- 🔄 **多岗位对比**：一份简历同时对比多个 JD，按评分排序
- 🎤 **模拟面试**：生成面试题、回答思路、项目深挖题
- 💡 **方向推荐**：不知道投什么？推荐 3-5 个适合的岗位方向
- 📑 **6 套简历模板**：单栏/分栏/时间轴/极简等，支持导出 PDF/Word

### 体验优化
- ⚡ **流式输出**：评估过程实时显示
- 📱 **PWA 支持**：手机"添加到主屏幕"像 App 一样用
- 🌙 **深色模式**：跟随系统 + 手动切换
- 📥 **多格式下载**：报告/简历/面试准备支持 PDF/Word/TXT/MD

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| **前端** | React 19、TypeScript、Vite |
| **后端** | Express 5、better-sqlite3 |
| **AI** | DeepSeek / 智谱 GLM（OpenAI 兼容） |
| **校验** | Zod（结构化简历） |
| **评分** | 词典驱动确定性算法 + AI 双重验证 |

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 LLM_API_KEY

# 3. 启动（前端 5173 + 后端 3001）
npm run dev
```

打开 **http://localhost:5173**，注册账号即可开始使用。

### 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 开发模式（前后端同时启动） |
| `npm test` | 运行测试 |
| `npm run acceptance` | 黑盒验收测试 |
| `npm run build` | 生产构建 |
| `npm run create-admin` | 创建管理员账号 |

## 🏗️ 系统架构

```text
┌──────────────────────────────────────────────────────────────  ┐
│  浏览器 (http://localhost:5173)                                │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  React SPA + PWA                                       │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │     │
│  │  │ 评估   │ │ 多岗对比│ │ 模拟面试│ │ 简历模板│          │  │
│  │  └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘          │     │
│  │      └──────────┴──────────┴──────────┘                │    │
│  │                    │ SSE 流式响应                       │   │
│  └────────────────────┼───────────────────────────────────┘    │
│                       │ /api/*                                 │
├───────────────────────┼──────────────────────────────────────  ┤
│                       ▼                                        │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Express Server (http://localhost:3001)               │     │
│  │  ┌─────────────────────────────────────────────────┐ │      │
│  │  │  Auth (JWT) → Rate Limit → Routes               │ │      │
│  │  └─────────────────────────────────────────────────┘ │      │
│  │                                                      │      │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │       │
│  │  │ /evaluate│ │/compare  │ │/interview│ │/resume  │ │       │
│  │  │ 简历评估  │ │ 多岗对比 │ │ 模拟面试  │ │ 模板管理│ │     │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ │       │
│  │       └────────────┴────────────┴────────────┘       │      │
│  │                      │                               │      │
│  │  ┌───────────────────▼───────────────────────────┐   │      │
│  │  │  核心引擎                                      │   │     │
│  │  │  ┌─────────────┐  ┌────────────┐  ┌─────────┐ │   │      │
│  │  │  │ Scoring     │  │ LLM Client │  │ Zod     │ │   │      │
│  │  │  │ 词典评分引擎 │  │ DeepSeek / │  │ 简历结构│ │   │     │
│  │  │  │ (确定性)     │  │ 智谱 GLM   │  │ 校验    │ │   │     │
│  │  │  └─────────────┘  └─────┬──────┘  └─────────┘ │   │      │
│  │  └─────────────────────────┼─────────────────────┘   │      │
│  │                            │                          │     │
│  │  ┌─────────────────────────▼─────────────────────┐   │      │
│  │  │  better-sqlite3                               │   │      │
│  │  │  users │ resumes │ reports │ history          │   │      │
│  │  └───────────────────────────────────────────────┘   │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                │
│  ┌──────────────────────┐                                      │
│  │  LLM API             │ ◄── 智谱 GLM / DeepSeek              │
│  │  (OpenAI 兼容接口)    │                                     │
│  └──────────────────────┘                                      │
└──────────────────────────────────────────────────────────────  ┘
```

## 📁 目录结构

```
resume-evaluator/
├── server/                # 后端
│   ├── core/              # 核心逻辑        
│   ├── scoring/           # 评分引擎        
│   ├── llm/               # LLM 接口        
│   ├── routes/            # API 路由        
│   └── __tests__/         # 测试（20+ 文件）
├── src/                   # 前端            
│   ├── pages/             # 页面组件        
│   ├── components/        # UI 组件         
│   └── lib/               # 工具库          
├── shared/                # 前后端共享类型  
├── scripts/               # 验收脚本        
└── docs/                  # 项目文档        
```

## 🧪 测试

```bash
npm test              # 单元测试（26 个测试文件）
npm run acceptance    # 黑盒验收（真实 HTTP 请求）
```

## 📄 许可证

[MIT License](LICENSE) © y0u41

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 LLM_API_KEY

# 3. 开发模式（前端 5173 + 后端 3001）
npm run dev
```

浏览器打开 http://localhost:5173

### 生产模式

```bash
npm run build   # 构建前端到 dist/
npm start       # 后端同时服务前端，访问 http://127.0.0.1:3001
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LLM_PROVIDER` | `deepseek` | 当前使用的提供商：`deepseek` 或 `bigmodel` |
| `DEEPSEEK_API_KEY` | — | DeepSeek 密钥 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | DeepSeek 接口地址 |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | DeepSeek 模型 |
| `BIGMODEL_API_KEY` | — | 智谱 BigModel 密钥 |
| `BIGMODEL_BASE_URL` | `https://open.bigmodel.cn/api/paas/v4` | BigModel 接口地址 |
| `BIGMODEL_MODEL` | `glm-4.7-flash` | BigModel 模型 |
| `LLM_TIMEOUT_MS` | `120000` | LLM 请求超时（毫秒） |
| `LLM_STREAM_IDLE_MS` | `45000` | 流式响应无数据的停滞超时（毫秒），超时自动回退非流式 |
| `JD_EXTRACT` | `true` | 链接抓取后是否用 LLM 智能提取岗位重点信息（`false` 则返回清洗后的原文） |
| `PORT` | `3001` | 后端端口 |
| `HOST` | `127.0.0.1` | 监听地址（默认仅本机，安全） |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | 允许的跨域来源（逗号分隔） |
| `DB_PATH` | `server/data/app.db` | SQLite 数据库路径（测试用 `:memory:`；旧版路径 `data/app.db` 见 DEPLOY.md 9.1） |
| `AUTH_SECRET` | （生产必填） | 登录令牌签名密钥，随机长字符串；不设则每次重启失效 |
| `AUTH_TOKEN_TTL` | `7d` | 登录态有效期 |
| `COOKIE_SECURE` | `false` | Cookie 是否仅走 HTTPS（对外部署启用 HTTPS 后设为 `true`） |
| `DAILY_LIMIT` | `30` | 每人每日评估次数上限 |
| `REGISTRATION_OPEN` | `true` | 是否开放注册（`false` 则关闭注册入口） |
| `LLM_MAX_RETRIES` | `2` | 失败自动重试次数（限流 / 5xx / 超时） |
| `CACHE_ENABLED` | `true` | 相同输入是否走结果缓存 |
| `CACHE_TTL_HOURS` | `24` | 缓存有效期（小时） |
| `MAX_CONCURRENCY` | `5` | 同时进行的评估数上限，超出排队 |
| `MAX_QUEUE` | `50` | 排队队列上限 |
| `LOG_REQUESTS` | `true` | 是否输出请求日志 |

## 部署上线

完整步骤见 **[DEPLOY.md](./DEPLOY.md)**（Ubuntu + pm2 + Caddy 自动 HTTPS）。
关键三步：`npm run build` → `pm2 start ecosystem.config.cjs` → Caddy 反代到 `127.0.0.1:3001`。

## 切换模型提供商

支持任意 OpenAI 兼容服务。内置 DeepSeek 与智谱 BigModel，切换只需改 `LLM_PROVIDER`：

```env
# 用 DeepSeek
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxx

# 或用智谱 BigModel
LLM_PROVIDER=bigmodel
BIGMODEL_API_KEY=xxx
BIGMODEL_MODEL=glm-4.7-flash
```

**智谱 BigModel**（[文档](https://docs.bigmodel.cn/cn/guide/develop/openai/introduction)）
- 接口地址：`https://open.bigmodel.cn/api/paas/v4`
- 模型：`glm-5.3`（旗舰）、`glm-4.6`、`glm-4.7-flash`（免费）、`glm-4.5-flash`（免费）
- ⚠️ 其 `temperature` 区间为 (0,1)，不支持 0（本项目已适配）

**接入其它服务**：设 `LLM_PROVIDER=<名字>`，再配置 `<名字>_API_KEY` / `<名字>_BASE_URL` / `<名字>_MODEL`（前缀大写）。

**界面切换**：评估页与「编辑简历」面板会出现「模型」下拉框，**按提供商分组**，可对每次评估自由选择具体模型，选择会记住。`LLM_PROVIDER` 仅作为默认值。

**自定义可选模型**：用 `<PROVIDER>_MODELS=id1,id2` 覆盖内置目录，例如：

```env
BIGMODEL_MODELS=glm-4.7-flash,glm-4.6,glm-5.3
DEEPSEEK_MODELS=deepseek-v4-flash,deepseek-v4-pro
```

> 提示：大模型（`glm-4.6` / `glm-5.3`）较慢，完整评估可能需 1~2 分钟，可调大 `LLM_TIMEOUT_MS`；免费模型（`*-flash`）偶发 `429 访问量过大`，稍等重试即可。

## 常用脚本

```bash
npm run dev        # 开发（前后端一起）
npm run build      # 构建前端
npm start          # 生产运行
npm test           # 运行单元测试
npm run acceptance # 黑盒端到端验收（真实 HTTP + 临时库，无需 LLM Key）
npm run typecheck  # TypeScript 类型检查
npm run create-admin -- <用户名> <密码>   # 创建/重置管理员账号
```

## 管理员账号

管理员用**用户名**登录（普通用户用邮箱注册）。创建或重置：

```bash
npm run create-admin -- yu yourpassword
```

- 登录入口支持「邮箱 / 账号」，管理员填用户名即可
- 登录后顶栏出现「用户管理」，可查看所有用户及当日用量
- 管理员同样受每日额度限制

## 安全说明（重要）

1. **API Key**：`.env` 已在 `.gitignore` 中，切勿提交。若密钥曾泄露，请立即到控制台**吊销并重建**。
2. **仅本机访问**：默认只监听 `127.0.0.1`。对外部署时设置 `HOST=0.0.0.0`，务必配合**反向代理 + HTTPS**，并设置 `COOKIE_SECURE=true`、`AUTH_SECRET`、`CORS_ORIGINS`。
3. **鉴权**：除注册/登录外，所有接口都要求登录；数据按 `user_id` 严格隔离；登录接口有独立限流防暴力破解。
4. **SSRF 防护**：链接抓取接口会拒绝内网 / 回环 / 链路本地地址，并校验重定向目标。
5. **数据隐私**：`data/` 目录（含简历隐私）已被忽略，不会进入版本库。
6. **速率限制**：评估 / 抓取 / 解析接口有限流，另有每人每日额度，防止 API 额度被刷。
7. **首个注册用户**会继承升级前遗留的本地历史数据。

## 已知限制

- 扫描版 PDF（图片型）无法提取文字，需手动粘贴
- 动态渲染（SPA）或需登录的招聘网页，服务器拿不到正文，会回退为原始文本或提示手动复制
- 链接提取会额外调用一次 LLM 做信息抽取；可设置 `JD_EXTRACT=false` 关闭，关闭后返回清洗过的网页原文
- PDF 导出为图片式渲染（文字不可选中），如需可编辑请下载 Word
- 报告结构化依赖模型遵循固定格式，格式偏差时前端会降级为纯文本展示
- "同一个人"以简历首个非空行（通常为姓名）识别，重名会合并

## 目录结构

```
server/           后端
  index.js        服务入口（安全中间件、限流、请求日志、静态服务）
  core/           领域与基础服务
    db.js         SQLite 初始化与迁移（users / evaluations / downloads / usage_log）
    auth.js       密码加密、JWT、登录/管理员中间件
    quota.js      每人每日额度    queue.js  评估并发队列
    store.js      评估保存 + 每人保留 12 条 + 缓存查询    person.js  人物标识提取
    models.js     模型目录（提供商与可选模型）
  llm/            llm.js（LLM 调用）/ prompt.js（人设与提示词）
  routes/         auth / evaluate / parse / fetch / admin / account / downloads 路由
                  （evaluate 内含 evaluate / compare / followup / interview / directions）
  scoring/        确定性评分引擎（词典驱动）
  http/           响应信封 + 错误码    jobs/  定时任务（注销清理）    scripts/  create-admin
src/              前端
  pages/          Login / Home / Result / History / Admin / Builder / Compare
                  Interview / Directions / Privacy / TaskRunner
  components/     FileUpload / UrlFetch / UserBar / ModelSelect / Logo / ThemeToggle
                  Nav / AccountDangerZone / TaskDock
  lib/            api / auth / tasks
    ui/           toast / theme / models
    resume/       resumeTemplate / resumeSchema / sample
    report/       report / download
shared/           结构化简历 Schema（前后端共用）
public/           PWA（manifest / sw.js / 图标）
docs/             文档（需求 / 产品 / 技术 / 实现 / 错误码 / ADR）
docs/features/    按功能分类的模块文档（评估 / 模板 / 对比 / 面试 / 推荐 / 历史）
deploy/           Caddyfile
ecosystem.config.cjs  pm2 配置
DEPLOY.md         部署指南
```

## 许可

本项目采用 **MIT License**，见 [LICENSE](./LICENSE)。文档、模板与代码可自由使用、修改与分发（保留版权声明）。

> 开源提示：`.env`、`data/`、`node_modules/`、`dist/` 均已在 `.gitignore` 中，请勿提交密钥或真实简历数据。

