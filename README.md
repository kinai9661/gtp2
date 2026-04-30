# 🎨 AI 灵感创作工坊 (AI Image Generation Workspace)

![Version](https://img.shields.io/badge/version-v6.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Cloudflare_Workers-orange.svg)
![Frontend](https://img.shields.io/badge/frontend-Alpine.js_%7C_Tailwind_CSS-38bdf8.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

**AI 灵感创作工坊** 是一个极简、高性能的 AI 绘画 Web 应用。本项目将完整的响应式前端应用与 API 代理路由打包成了一个单一的 **Cloudflare Worker** 脚本。

**无需部署服务器，无需配置数据库**，只需将其粘贴到 Cloudflare，即可拥有一个支持多级触感反馈、虚拟列表渲染、任务持久化的私有 AI 绘画工作站！

---

## ✨ 核心特性

* ⚡️ **极致轻量 & 零运维**：整个项目只有一个纯代码文件，直接部署在 Cloudflare Workers 边缘节点。
* 🚀 **DOM 性能优化**：针对 1000+ 图片的画廊场景，采用了虚拟列表渲染（Virtual List）与懒加载，滚动丝滑不卡顿。
* 💾 **纯本地隐私存储**：集成 IndexedDB 本地数据库。你的生成记录、图片数据均保存在本地浏览器中，彻底保护隐私（断网亦可查看历史）。
* 🎨 **现代化 UI/UX 设计**：
    * 基于 Tailwind CSS 的玻璃拟态（Glassmorphism）设计。
    * 自研弹簧动画引擎（Spring Animation），点击、切换丝滑自然。
    * 移动端专属优化：支持原生级别的 Haptics 多级触感反馈（震动）。
    * 支持 Light / Dark 暗黑模式无缝切换。
* 💡 **内置灵感图库**：预置高品质 Prompt 库（涵盖动漫、摄影、3D、海报等），配合多节点 CDN 智能容灾加速，一键垫图生成。
* 🧰 **强大的工作流功能**：
    * 后台任务队列处理与进度条显示（支持失败重试）。
    * 支持图生图（参考图垫图）上传。
    * 图片批量操作（批量下载 ZIP、批量删除）。
    * 高清灯箱（Lightbox）查看器，支持鼠标滚轮缩放与拖拽。

## 📸 界面预览

<img width="1908" height="890" alt="53a53e3ddfc665d0e1d867ae8efd86da" src="https://github.com/user-attachments/assets/ef5b929f-08fa-47ec-81e3-62b0c05a8596" />


<div align="center">
  <img src="https://via.placeholder.com/800x450/0f172a/38bdf8?text=Desktop+Preview" width="80%" alt="桌面端预览">
  <br>
  <img src="https://via.placeholder.com/300x600/0f172a/38bdf8?text=Mobile+Preview" width="30%" alt="移动端预览">
</div>

## 🛠️ 技术栈

* **运行环境**: [Cloudflare Workers](https://workers.cloudflare.com/)
* **前端框架**: [Alpine.js](https://alpinejs.dev/) (轻量级响应式)
* **样式框架**: [Tailwind CSS](https://tailwindcss.com/) (CDN 引入)
* **本地存储**: IndexedDB / LocalStorage
* **其他依赖**: JSZip (ZIP 批量打包) / FontAwesome (图标库)

## 🚀 快速部署指南

只需 3 分钟，即可免费拥有你的私人 AI 画廊：

1.  **注册 / 登录 Cloudflare**
    进入 [Cloudflare 控制台](https://dash.cloudflare.com/)，在左侧导航栏选择 **Workers & Pages**。
2.  **创建 Worker**
    点击 **Create application** -> 选择 **Create Worker** -> 随意命名（例如 `ai-gallery`） -> 点击 Deploy。
3.  **编辑代码**
    部署成功后，点击 **Edit code**。将本项目中的源码全部复制，粘贴并覆盖默认的 Worker 代码。
4.  **配置 API (关键步骤)**
    在代码块的顶部（第 6-10 行），修改为你自己的 AI 绘画接口参数：
    ```javascript
    const API_BASE = "[https://your-api-url.com](https://your-api-url.com)"; // 你的中转/官方 API 基础地址
    const API_KEYS = [
        "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" // 你的 API Key
    ];
    const MODEL_NAME = "gpt-image-2"; // 你要调用的绘图模型名称
    ```
5.  **保存并部署**
    点击右上角的 **Save and deploy**，打开 Worker 分配的域名即可开始创作！

## ⚠️ 重要注意事项

* **数据安全提醒**：本项目秉持绝对隐私原则，**未连接任何外部云端数据库**。您的所有生成记录和高清图片均缓存在 **当前浏览器的 IndexedDB 中**。
* 🚨 **如果清理了浏览器缓存、使用了无痕模式、或重装系统，您的历史图片将永久丢失！** 遇到喜欢的作品请务必及时点击下载保存至本地。
* **免费额度**：代码默认自带的 API Token 为演示及限时体验使用，若要长期稳定使用，请务必替换为您自己的 API Token。

## 🤝 贡献与反馈

欢迎提交 Issue 和 Pull Request！如果你觉得这个项目对你有帮助，请给个 ⭐ Star 支持一下！
