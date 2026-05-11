# RepoMonkey

一个通过 GitHub 管理用户脚本的 Chrome 扩展程序，类似于 Tampermonkey，但具有基于 Git 的版本控制功能。

## 功能特性

- 📦 **GitHub 集成**：绑定 GitHub 仓库来存储和管理你的用户脚本
- 🔄 **自动同步**：每 30 分钟自动同步（或手动同步）
- 🎯 **脚本管理**：通过简单的开关启用/禁用脚本
- 🎨 **现代化 UI**：简洁、简约的界面，采用绿/黑/灰配色方案
- ⚡ **轻量级**：快速高效，仅在需要时运行

## 安装

1. 克隆或下载此仓库
2. 打开 Chrome 并导航至 `chrome://extensions/`
3. 在右上角启用"开发者模式"
4. 点击"加载已解压的扩展程序"并选择 repo-monkey 目录

## 配置

1. 创建 GitHub 个人访问令牌（PAT）：
   - 访问 https://github.com/settings/tokens/new
   - 选择 `repo` 作用域
   - 生成并复制你的令牌

2. 点击 Chrome 工具栏中的 RepoMonkey 图标
3. 点击"绑定仓库"打开设置
4. 输入你的 PAT、仓库所有者和仓库名称
5. 点击"保存并同步"

## 仓库结构

RepoMonkey 在两个位置查找脚本（按优先级顺序）：
1. `/output/` 目录 - 如果存在，仅加载此处的脚本
2. 仓库根目录 - 否则，加载根目录中的所有 `.js` 文件

## 用户脚本格式

脚本应遵循标准的用户脚本元数据格式：

```javascript
// ==UserScript==
// @name         我的炫酷脚本
// @match        https://example.com/*
// ==/UserScript==

console.log('Hello, World!');
```

## 使用方法

- 从弹出窗口中切换脚本的开启/关闭
- 点击"立即同步"手动同步
- 从选项页面管理设置

## 许可证

MIT
