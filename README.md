# Culinary AI · 智能私厨

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6-646cff.svg)](https://vitejs.dev)
[![GitHub Pages](https://img.shields.io/badge/Deployed-GitHub%20Pages-222.svg)](https://yifenqian1990-wq.github.io/culinary-ai/)

AI 驱动的私人厨房助手：记录你的菜谱、AI 规划一周饮食、一键生成采购清单，数据只存在你的浏览器本地。

🌐 **在线体验：https://yifenqian1990-wq.github.io/culinary-ai/**

## ✨ 功能特性

- 📖 **菜库**：记录、编辑、归档你的私房菜谱，支持分类与搜索
- 🗓️ **饮食计划**：AI 根据你的菜库和口味偏好规划每日/每周菜单
- 🛒 **采购清单**：根据计划一键生成采购清单，买菜不再漏
- 🤖 **AI 菜谱助手**：Gemini 驱动的烹饪问答、菜谱灵感
- 🔌 **多模型渠道**：支持自定义 OpenAI 兼容接口（如本地 Ollama）
- 💾 **数据自主**：Dexie（IndexedDB）本地存储，支持数据导入/导出备份
- 🔑 **多 Key 管理**：API Key 本地管理，一键切换

## 🚀 快速开始（本地运行）

```bash
git clone https://github.com/yifenqian1990-wq/Culinary-AI.git
cd culinary-ai
npm install
npm run dev        # http://localhost:3000
```

构建生产包：

```bash
npm run build      # 产物在 dist/，任意静态服务器即可托管
```

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 6 |
| 样式 | Tailwind CSS（CDN）|
| AI 能力 | @google/genai、OpenAI 兼容接口 |
| 本地数据库 | Dexie（IndexedDB）|
| 部署 | GitHub Pages（自动） |

## 📦 部署

本仓库已配置 GitHub Actions，推送到 `main` 分支后自动构建并发布到 GitHub Pages，无需手动操作。

想部署到自己的账号：Fork 本仓库 → Settings → Pages → Source 选择 `GitHub Actions`，推送即生效。

## ❓ FAQ

**Q: 需要 API Key 吗？**
A: AI 功能（饮食规划、菜谱问答）需要。在设置里填入 Gemini API Key 或自定义接口地址，Key 只保存在你的浏览器本地。

**Q: 不填 Key 能用吗？**
A: 能。菜库记录、手动排计划、采购清单这些核心功能完全离线可用。

**Q: 菜谱数据会上传吗？**
A: 不会。全部存在浏览器 IndexedDB 里，可通过数据管理导出备份。

**Q: 换电脑/清浏览器数据会丢菜谱吗？**
A: 会。记得定期在"设置 → 数据管理"里导出备份。

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证开源。
