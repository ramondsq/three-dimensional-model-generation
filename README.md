# 三维模型生成网页应用

一个端到端的网页应用，可基于文本或图片生成单体 3D 资产，并内置效果评估系统与第三方 API 调用优化。项目包含：

- 前端：React（Vite）用于输入文本/图片、模型预览与反馈
- 后端：Express，接入 3D 生成服务（Meshy），并实现缓存、请求去重与速率限制
- 评估：集成 glTF Validator 与基础启发式规则的自动化评估流水线

本 README 同时包含产品简介与关键设计（问题 1–5），以及安装与使用指南。

## 🎯 目标用户、痛点与用户故事

目标用户：

1) 3D 艺术家与独立游戏开发者
- 痛点：快速产出基础网格；重拓扑与 UV 麻烦；需要从文本/参考图快速迭代想法。
- 用户故事：“作为个人开发者，我希望从一段描述或一张概念图快速产出一个 3D 基础资产，用于关卡搭建，再在 DCC 中精修。”

2) 产品/市场设计师
- 痛点：概念演示需要 3D 物料；3D 技能和时间有限。
- 用户故事：“作为市场设计师，我希望从产品照片生成一个质量‘够用’的 3D 模型，用于交互演示，而不必等待数天。”

3) 研究人员/AI 原型工程师
- 痛点：需要一个简单的试验场快速对比不同模型/供应商并收集结构化反馈。
- 用户故事：“作为 AI 工程师，我希望有标准化流水线来生成资产并自动评分，以便快速迭代。”

## ✅ 功能（含优先级）与本次范围

P0（必须）：
- 文本转 3D、图片转 3D 的提交能力
- 任务生命周期 UI 与状态轮询
- 浏览器内 3D 预览（GLB/GLTF）
- 基础自动评估（glTF Validator + 资产启发式）
- 反馈采集（赞/踩 + 备注）
- API 调用优化：缓存、请求合并/去重、速率限制

P1（可选）：
- Prompt 缓存建议（复用历史相似请求）
- 最近结果画廊
- 模型文件下载

P2（未来）：
- 多视角渲染 + CLIP 相似度评分
- 高级拓扑/UV 检查与水密性估计
- 历史资产语义检索

本版本已实现：
- 全部 P0 与部分 P1（缓存建议、最近结果、下载）

## 🔌 供应商对比与选择

对比对象：

- Meshy：提供 Text-to-3D、Image-to-3D API，质量/速度均衡，REST 接口，输出标准（GLB/GLTF），鉴权与定价清晰。
- Kaedim：2D→3D 能力强，更偏向人工辅助与企业方案。
- 3DFY：Text-to-3D API；质量随类别而异，部分访问可能受限。
- Luma AI：质量与工具优秀；API 与 3D 资产能力不断演进，部分功能偏 Web。

选择：Meshy
- 理由：同时覆盖文本与图片的成熟 REST API、可预期的任务轮询、与 Web 预览兼容的输出格式、上手流程清晰。

说明：Provider 适配层是模块化的；可替换 `server/src/providers/meshy.js` 或新增模块而不改 UI。

## 📏 评估指标与系统设计

自动指标：
- Validator 健康度：glTF-Validator 的错误/警告/信息数量
- 资产存在性：贴图/材质是否存在，图片/材质数量
- 文件指标：文件体积、格式（glb/gltf）

人工指标：
- 用户评分：赞/踩 + 备注

系统设计：
- 任务完成后，后端下载模型并运行 glTF-Validator 生成报告。
- 报告被规范化为简洁评分卡，随任务一并存储。
- 前端在预览旁展示指标并收集用户评分。
- 数据存储于 JSON DB（`storage/db.json`），后续可替换为 SQLite/Postgres。

未来拓展：
- 多视角渲染 + 基于 Prompt/参考图的 CLIP 相似度
- 通过 GLTF 解析获取几何统计（三角面/顶点数）

## ♻️ 降低第三方 API 调用频次

已实现策略：
1) 精确缓存复用：对文本做归一化；对图片计算内容的 SHA-256。命中历史成功任务则直接复用结果。
2) 请求合并：相同参数的并发请求合并为同一任务。
3) 速率限制：进程级限速，避免高频触发供应商限流。

其他思路：
- 语义缓存：用文本/图像嵌入做相似度阈值复用“足够接近”的结果。
- Prompt 引导：输入时提示可复用的缓存结果。
- 分级生成：先快速草模，必要时再触发高质生成。

本版采用：精确缓存 + 合并 + 限速（低风险、立竿见影且 UX 清晰）。

## 🏗️ 架构

- 前端：React（Vite），使用 `<model-viewer>` 预览 GLB/GLTF。页面：主页（表单）、任务视图（状态/预览/指标/反馈）、最近。
- 后端：Express + Provider 适配（Meshy）。提供生成、轮询、指标、反馈、缓存查询等接口。文件存于 `storage/models`，元数据存 `storage/db.json`。

## 🚀 快速开始

前置条件：
- Node.js 18+
- Meshy API Key

安装步骤：
1) 创建环境文件
   - 复制 `server/.env.example` 为 `server/.env`，并设置 `MESHY_API_KEY`。
2) 安装依赖
3) 本地开发模式启动前后端

如果你没有付费 Meshy 计划、遇到 402 Payment Required，可在 `server/.env` 设置 `PROVIDER=mock` 使用本地 Mock Provider（生成最小 glTF 以驱动预览与评估），继续开发调试。

在仓库根目录执行：

```powershell
# 1) 安装根目录 + server + web 依赖
npm install
cd server; npm install; cd ..
cd web; npm install; cd ..

# 2) 分别启动后端与前端（两个终端）
npm --prefix server run dev
npm --prefix web run dev
```

打开 Vite 输出的前端地址（通常 http://localhost:5173），后端默认 http://localhost:5001。

## 🔧 配置

- 后端环境（`server/.env`）：
  - `PORT=5001`
  - `MESHY_API_BASE_TEXT=https://api.meshy.ai/openapi/v2`
  - `MESHY_API_BASE_IMAGE=https://api.meshy.ai/openapi/v1`
  - `MESHY_API_KEY=your_api_key_here`
  - `MESHY_MODE=preview`（可选：preview | refine）
  - 可选调参：
    - `MESHY_ART_STYLE=realistic | sculpture`
    - `MESHY_AI_MODEL=meshy-4 | meshy-5 | latest`
    - `MESHY_TOPOLOGY=triangle | quad`
    - `MESHY_TARGET_POLYCOUNT=30000`
    - `MESHY_SHOULD_REMESH=true | false`
  - Image 专属：
    - `MESHY_SYMMETRY_MODE=off|auto|on`
    - `MESHY_SHOULD_TEXTURE=true|false`
    - `MESHY_ENABLE_PBR=true|false`
    - `MESHY_IS_A_T_POSE=true|false`
    - `MESHY_MODERATION=true|false`
    - `MESHY_USE_TEXTURE_PROMPT=true|false`（若为 true，会用前端 prompt 作为 texture_prompt）
  - `PUBLIC_BASE_URL=http://localhost:5001`（用于响应中的绝对文件 URL）
  - `RATE_LIMIT_RPS=2`（进程级限速）
  - `PROVIDER=meshy`（设为 `mock` 可不调用外部 API 开发）

## 📡 后端 API 概览

- POST `/api/generate/text` { prompt: string }
  - 返回：{ jobId, cached: boolean }
- POST `/api/generate/image` multipart/form-data：image（文件）、prompt（可选）
  - 返回：{ jobId, cached: boolean }
- GET `/api/jobs/:id`
  - 返回任务状态/结果/评估指标
- GET `/api/metrics/:id`
- POST `/api/feedback` { jobId, rating: 1|-1, notes?: string }
- GET `/api/cache/lookup?prompt=...`
- GET `/api/recent`

## 📦 输出产物

- 模型文件：`storage/models/{jobId}.{glb|gltf}`（若为 glTF 且外链贴图，会同时产出贴图文件）
- 任务记录：`storage/db.json`

## 🧪 质量校验

- 构建：前端由 Vite 编译；后端 Express 正常启动
- Lint/类型检查：为简化 MVP 暂未提供，可后续加入 ESLint/TS
- 单元测试：MVP 暂未覆盖；建议后续做接口级集成测试

## 📋 需求覆盖说明

- (1) 用户/痛点/用户故事；功能与优先级；本次范围：已完成
- (2) 供应商选择与对比：已完成（Meshy 与其他方案，对比理由）
- (3) 评估指标与系统描述：已完成；基于 validator 的自动评估
- (4) 评估系统设计：已完成；自动 + 人工闭环；存储与 UI 已打通
- (5) API 调用优化：已完成；缓存、合并、速率限制；并描述后续思路
  
---

如需切换 Provider 或加入语义缓存/CLIP 评分，请告诉我，我会扩展后端模块与 UI。

## 🎥 演示视频



https://github.com/user-attachments/assets/b0926a0f-52db-4d58-8413-0e479c93c75c

