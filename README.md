# SVG 编辑器 CLI

软件设计课程项目，使用 TypeScript 和 Node.js。

## 环境

- Node.js 24
- npm 11 或以上版本

## 安装与运行

在项目根目录执行：

```shell
npm ci
npm run cli
```

启动命令会先编译 TypeScript，再运行程序入口，输出：

```text
svg-editor 0.1.0
```

Windows PowerShell 若限制运行 `npm.ps1`，可以将命令中的 `npm` 换成 `npm.cmd`。

## 开发检查

| 命令 | 用途 |
| --- | --- |
| `npm run typecheck` | 类型检查，不生成文件 |
| `npm run lint` | ESLint 静态检查 |
| `npm run build` | 编译到 `dist/` |
| `npm run check` | 依次执行类型检查、静态检查和构建 |

GitHub Actions 在 Windows 和 Linux 上使用 `npm ci` 安装依赖，执行工程检查及 CLI 启动验证。

## 文档

- [课程需求](phase_cli_1.md)
- [架构说明](doc/README.md)
