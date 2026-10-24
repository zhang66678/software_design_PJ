# SVG 编辑器 CLI

软件设计课程 Phase 1 项目，使用 TypeScript 和 Node.js 创建、编辑及读写 SVG。内置 rect、circle、ellipse、line、text、g 六种类型，支持嵌套容器、文档树和整条编辑命令的撤销重做。

## 安装与运行

环境：**Node.js 24、npm 11 或以上版本**。在项目根目录执行：

```shell
npm ci
npm run cli
```

启动时自动编译，然后显示 `svg>` 提示符。输入 `help` 查看命令，按 `Ctrl+C` 退出。PowerShell 若限制运行 npm.ps1，可将 npm 换成 npm.cmd。

## 使用示例

逐行输入以下命令，创建带文字的节点，移动后撤销，再保存并读回：

```text
init 400 200
create g node
create rect start 30 70 160 60 #4a90d9 in node
create text label 65 105 "开始" in node
move node 20 0
tree
undo
show label
set label text "开始流程"
save "my diagram.svg"
read "my diagram.svg"
tree
```

容器移动会递归作用于矩形与文字，一次 undo 同时恢复两者。保存的 UTF-8 SVG 可直接用浏览器打开。

## 命令

| 语法 | 用途 |
| --- | --- |
| `init [w] [h]` | 新建画布，默认 800×600；清除默认文件路径并设置历史屏障 |
| `canvas [w] [h]` | 查询或修改画布尺寸；只给宽度时保留当前高度 |
| `read <file.svg>` | 读入文件，缺 id 自动补全并警告 |
| `save [file.svg]` | 保存文件；省略路径时使用最近一次成功读取或保存的路径 |
| `create rect <id> <x> <y> <w> <h> [fill]` | 创建矩形 |
| `create circle <id> <cx> <cy> <r> [fill]` | 创建圆 |
| `create ellipse <id> <cx> <cy> <rx> <ry> [fill]` | 创建椭圆 |
| `create line <id> <x1> <y1> <x2> <y2> [stroke]` | 创建线段 |
| `create text <id> <x> <y> "content"` | 创建文字，保留中文、空格和空内容 |
| `create g <id>` | 创建空容器 |
| `delete <id>` | 删除图形或完整子树 |
| `addto <gid> <id>` | 将已有图形或子树移到目标容器末尾 |
| `group <newGid> <id1> <id2>...` | 将至少一个已有图形收编进新容器 |
| `ungroup <gid>` | 解散嵌套容器，子节点占据原组的位置 |
| `front <id>` / `back <id>` | 调整同级显示顺序 |
| `move <id> <dx> <dy>` | 按增量移动图形或整棵子树 |
| `scale <id> <factor>` | 按正有限因子同时缩放位置和尺寸 |
| `set <id> <attr> <value>` | 修改几何、公共样式或文字内容 |
| `tree [id]` | 显示整份文档或指定图形的完整子树 |
| `show <id>` | 显示图形属性与真实父节点 |
| `help` | 显示命令语法 |
| `undo` / `redo` | 撤销或重做一条编辑 |

所有 create 类型均可追加 `in <containerId>`，省略时挂在画布根级。id 全树唯一且区分大小写。整行以 `#` 开头时为注释，颜色中的 `#` 保留；带空格的参数用双引号包裹。

### 几何、样式与结构

- 坐标允许有限浮点数；宽高和半径可为零，但不能为负；画布尺寸必须为正有限数。canvas 修改尺寸保留图形几何与层级。
- scale 基于坐标原点，同时乘上全部几何属性；文字只改变 x/y。set 支持各类型的几何属性、fill、stroke、stroke-width，文字内容使用 text 修改。未设置的样式保留缺省，容器样式按 SVG 继承。
- addto 保留子树、几何和显式样式，目标不能为自身或后代；目标为当前父级时移到同级末尾。
- 同父级 group 占最早选中节点的位置；跨父级按原文档遍历顺序收编，新组放根级末尾。不能重复选中目标或同时选中祖先与后代。ungroup 保留子节点几何与显式样式，按课程约定不能解散 svg 的直接子容器。
- SVG 按同级顺序绘制。front 移到同级列表末尾、显示在最前；back 移到开头、显示在最后。两者保留层级和图形内容。

### 文件与历史

成功 init、read、save 或修改 canvas 尺寸后禁止 undo/redo，下一次成功编辑开始新的历史。tree、show、help 和无参 canvas 不改变历史；撤销后执行新的成功编辑会清空 redo。

成功 read 或显式 save 更新默认文件路径，init 清除路径，canvas 保留路径。尚无路径时首次 save 必须指定文件名；同路径保存会替换原文件，目标父目录需已存在。摘要计数包含容器与后代，不包含 svg 根。

命令失败时输出一行以 `error:` 开头的信息，保留当前文档、默认路径和历史，随后可继续输入命令。缺失或空 id 按“标签名+序号”补全并逐条警告，避开文件中全部已有 id；重复 id 或非法数据使整次读取失败。

## SVG 支持范围

读取 UTF-8 XML 1.0 SVG，支持六种内置类型及其嵌套结构、同级顺序、显式公共样式和文字。几何值支持有限数及 px 单位，未提供的图形几何属性按 0 处理。画布需提供正的 width/height，或由 viewBox 推导尺寸；viewBox 须以 (0,0) 为原点且与画布尺寸一致。

不支持的元素、transform、CSS、字体等属性，以及 DTD 和处理指令会明确报错。本项目导出的文件可以完整读回。box 与动态插件属于后续阶段，当前创建 box 会报 unknown shape type。

## 回放课程示例

提供[典型会话](examples/typical-session.txt)、[两节点流程图](examples/flowchart.txt)和[外部 SVG](examples/other.svg)。在项目根目录用 PowerShell 执行：

```powershell
npm run build
New-Item -ItemType Directory -Force examples/output | Out-Null
cmd /c "node dist/bootstrap/Main.js < examples\flowchart.txt"
cmd /c "node dist/bootstrap/Main.js < examples\typical-session.txt"
```

Linux/macOS 可先执行 `mkdir -p examples/output`，再用 `node dist/bootstrap/Main.js < examples/flowchart.txt` 或对应的典型会话文件回放。

生成的 flowchart.svg 和 demo.svg 位于 examples/output/，可直接用浏览器打开，该目录不纳入版本控制。典型会话预期输出两条错误（非法分组、保存后撤销）和一条自动补 id 警告，随后继续正常执行；流程图示例应无错误。

## 工程检查

| 命令 | 用途 |
| --- | --- |
| `npm run typecheck` | 检查源码和测试类型，不生成文件 |
| `npm run lint` | ESLint 静态检查 |
| `npm test` | 编译并运行测试，包含真实 CLI 会话 |
| `npm run build` | 编译产品源码到 dist/ |
| `npm run check` | 依次执行类型检查、Lint、测试和构建 |

GitHub Actions 配置 Windows 和 Linux 检查，使用 npm ci 安装依赖，并验证工程检查及 CLI 启动。

## 文档

- [课程需求](phase_cli_1.md)
- [架构方案、关键决策、一致性自查与质量保证](doc/README.md)
- [PlantUML 模块依赖图](doc/architecture.puml)
