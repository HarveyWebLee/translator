# 英文网页翻译助手（Chrome 扩展）

识别当前浏览器标签页是否为**英文网站**，由用户选择是否通过 **DeepSeek 大模型**翻译为**简体中文**。

## 功能

- **语言检测**：结合 `html[lang]`、页面可见文本的拉丁字母/汉字比例，判断是否为英文页
- **用户确认**：检测到英文后顶部显示提示条，用户点击「翻译为中文」后才开始翻译
- **DeepSeek 翻译**：在 Service Worker 中调用 `https://api.deepseek.com/chat/completions`（OpenAI 兼容接口）
- **弹出窗口**：查看当前页状态、手动翻译、开关「自动提示」
- **选项页**：配置 API Key、模型（`deepseek-chat` / `deepseek-v4-flash` 等）

## 安装（开发者模式）

1. 打开 Chrome / Edge：`chrome://extensions` 或 `edge://extensions`
2. 开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**，选择本项目根目录 `translator`
4. 打开 [DeepSeek 控制台](https://platform.deepseek.com/api_keys) 申请 API Key
5. 配置 API Key（二选一）：
   - 右键扩展图标 → **选项** → 填入并保存
   - 或在项目根目录创建 `config.local.json`（可复制 `config.local.json.example`），扩展会自动导入  
     **注意：`.env` 文件不会被浏览器扩展读取**
6. 在扩展管理页点击 **重新加载** 后，再打开英文网页测试
7. 访问英文网站（如 [https://www.bbc.com](https://www.bbc.com)），应出现顶部提示条

## 产品文档

| 文档                                         | 说明                                   |
| -------------------------------------------- | -------------------------------------- |
| [docs/需求功能文档.md](docs/需求功能文档.md) | 功能需求、用户场景、验收标准           |
| [docs/技术实现文档.md](docs/技术实现文档.md) | 架构设计、目录明细、数据流、后续路线图 |

## 项目结构

```
translator/
├── manifest.json              # Manifest V3
├── docs/                      # 需求文档、技术文档、产品路线图
├── icons/                     # 扩展图标
├── src/
│   ├── background/
│   │   └── service-worker.js  # DeepSeek API 调用
│   ├── content/
│   │   ├── content.js         # 检测、提示条、DOM 替换
│   │   └── content.css
│   ├── popup/                 # 工具栏弹出页
│   ├── options/               # 设置页（API Key）
│   └── shared/
│       ├── constants.js
│       ├── language-detector.js
│       └── deepseek-client.js
└── README.md
```

## 使用说明

| 场景     | 操作                                   |
| -------- | -------------------------------------- |
| 自动提示 | 打开英文页 → 顶部横幅 → 「翻译为中文」 |
| 暂不翻译 | 点击「暂不翻译」（本会话内不再提示）   |
| 手动翻译 | 点击扩展图标 → 「翻译当前页」          |
| 配置密钥 | 扩展图标右键 → 选项                    |

## 注意事项

- API Key 保存在 `chrome.storage.sync`，请勿将含密钥的配置提交到 Git
- 翻译会修改页面 DOM 文本，**刷新页面可恢复原文**（未做持久化回滚）
- 复杂 SPA、Shadow DOM、iframe 内内容可能无法完整翻译
- 调用 DeepSeek 会产生 API 费用，请关注 [官方定价](https://platform.deepseek.com/)

## 技术栈

- Manifest V3
- ES Modules（background / content / popup / options）
- DeepSeek Chat Completions API

## 许可证

MIT
