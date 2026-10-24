# SVG 编辑器 CLI

软件设计课程项目，使用 TypeScript 和 Node.js，通过终端命令创建、编辑图形、文字及嵌套容器，查看文档结构，并撤销、重做编辑操作。

## 环境

- Node.js 24
- npm 11 或以上版本

## 安装与运行

在项目根目录执行：

```shell
npm ci
npm run cli
```

启动命令会先编译 TypeScript，再进入交互终端：

```text
svg-editor 0.1.0 — type 'help' for commands
svg>
```

Windows PowerShell 若限制运行 `npm.ps1`，可以将命令中的 `npm` 换成 `npm.cmd`。

输入 `help` 查看命令，按 `Ctrl+C` 退出。

## 使用示例

启动后逐行输入：

```text
init 800 600
create rect r1 10 20 100 50 #4a90d9
move r1 30 0
tree
undo
show r1
redo
tree
```

`move` 使用增量坐标，因此矩形的 x 从 10 变为 40。撤销后 `show r1` 显示 x=10，重做后 `tree` 显示 x=40。

也可以创建其他图形和文字：

```text
create circle c1 100 100 20 red
create ellipse e1 200 100 40 20 #4a90d9
create line edge 120 100 160 100 black
create text title 20 40 "我的流程图"
```

缩放和修改属性：

```text
scale r1 2
set r1 fill #f5a623
set r1 width 160
set title text "流程图 v2"
show r1
```

创建容器并直接指定图形归属：

```text
init 800 600
create g flowchart
create g node1 in flowchart
create rect start 120 100 160 60 #4a90d9 in node1
create text start-label 155 135 "开始" in node1
move node1 0 100
tree flowchart
show start-label
undo
```

移动或缩放容器会递归作用于全部后代，一次操作对应一个撤销单元。`tree <id>` 显示指定图形及其完整子树，`show` 显示真实父级。

在上面的文档中，可以继续迁移已有节点或删除子树：

```text
create g archive
addto archive node1
delete node1
undo
undo
```

`addto` 将图形或容器移到目标容器的末尾，保留子树、几何和显式样式；目标是当前父级时调整到同级末尾。容器不能迁入自身或后代。`delete` 删除目标及全部后代，撤销时恢复原父级、顺序和内容。

将已有图形收编成组，或解散嵌套分组：

```text
group content start-label start
tree node1
ungroup content
```

`group` 至少指定一个已有图形。同父级分组占最早选中节点的位置，子节点保持原顺序；跨父级分组按原文档遍历顺序收编，新组放在根级末尾。重复目标、id 冲突及同时选择祖先与后代会报错。

`ungroup` 将子节点按原顺序插回原组的位置，保留几何与显式子样式。按课程约定，不能解散 svg 的直接子容器；可以通过 undo 撤销刚刚创建的根级分组。

## 命令

| 语法 | 用途 |
| --- | --- |
| `init [w] [h]` | 新建画布，默认 800×600；清除原文档和历史记录 |
| `create rect <id> <x> <y> <w> <h> [fill]` | 创建矩形，id 唯一且区分大小写；省略 fill 时遵循 SVG 默认样式 |
| `create circle <id> <cx> <cy> <r> [fill]` | 创建圆，指定圆心和半径 |
| `create ellipse <id> <cx> <cy> <rx> <ry> [fill]` | 创建椭圆，指定中心和两个半轴长度 |
| `create line <id> <x1> <y1> <x2> <y2> [stroke]` | 创建线段，指定两端坐标及可选描边色 |
| `create text <id> <x> <y> "content"` | 创建文字，保留中文、空格和空内容 |
| `create g <id>` | 创建空容器，可继续嵌套容器或图形 |
| `delete <id>` | 删除图形或完整子树 |
| `addto <gid> <id>` | 将已有图形或子树迁入目标容器末尾 |
| `group <newGid> <id1> <id2>...` | 新建容器并收编已有图形，保持原有相对顺序 |
| `ungroup <gid>` | 解散嵌套容器，将子节点提升到原组的位置 |
| `move <id> <dx> <dy>` | 按增量移动图形或整棵子树 |
| `scale <id> <factor>` | 按正有限因子同时缩放位置和尺寸 |
| `set <id> <attr> <value>` | 修改几何属性、公共样式或文字内容 |
| `tree [id]` | 显示文档结构与几何属性，或显示指定图形的完整子树 |
| `show <id>` | 显示图形属性与父节点 |
| `help` | 显示命令语法 |
| `undo` | 撤销上一条编辑 |
| `redo` | 重做被撤销的编辑 |

所有类型的 `create` 都支持尾缀 `in <containerId>`，将新图形加入已存在容器的末尾；省略时创建在画布根级。目标不存在或为叶子图形时会报错。

整行以 `#` 开头时作为注释；颜色中的 `#` 会保留。带空格的参数用双引号包裹，例如 `"rgb(255, 0, 0)"`。编辑失败时输出一行以 `error:` 开头的信息，并保留文档与历史，随后可以继续输入命令。

坐标允许有限浮点数，宽高与半径允许为零但不能为负数。

`scale` 基于坐标原点，同时乘上全部几何属性；文字缩放作用于 x/y。`set` 支持 `fill`、`stroke`、`stroke-width` 及各图形的几何属性（如矩形的 x/y/width/height）；文字内容使用 `text` 修改。

`tree`、`show` 和 `help` 不改变编辑历史。成功新建画布后禁止撤销、重做，下一次成功编辑开始新的历史；撤销后执行新的编辑会清空重做记录。

## 开发检查

| 命令 | 用途 |
| --- | --- |
| `npm run typecheck` | 检查源码和测试的类型，不生成文件 |
| `npm run lint` | ESLint 静态检查 |
| `npm test` | 编译并运行自动化测试，包含 CLI 真实入口测试 |
| `npm run build` | 编译到 `dist/` |
| `npm run check` | 依次执行类型检查、静态检查、测试和构建 |

GitHub Actions 在 Windows 和 Linux 上使用 `npm ci` 安装依赖，执行工程检查及 CLI 启动验证。

## 文档

- [课程需求](phase_cli_1.md)
- [架构说明](doc/README.md)
