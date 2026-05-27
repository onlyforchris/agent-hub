# Theme Skills（通用版）

## 1. 目标
- 将 B 端/中台设计规范快速映射为可落地的全局主题能力。
- 输出统一的 Token、语义组件类、交互动效约束，避免页面各写各的。

## 2. 适用框架
- React + Tailwind CSS v4（`@theme` + `@layer`）
- 多模块后台系统（侧边栏 + 顶栏 + 卡片 + 表格 + 表单 + 弹窗）

## 3. 核心映射规则
1. 色彩策略：深浅对撞
- 侧边栏与导航：深色背景（如 `--color-brand-sidebar`）
- 内容区与卡片：浅色背景（如 `--color-brand-page` / `--color-brand-surface`）
- 主按钮：品牌渐变（主色到强调色）

2. 层级策略：内小外大
- 控件圆角：`--radius-control-sm/md`
- 卡片圆角：`--radius-card`
- 面板圆角：`--radius-panel`

3. 光影策略：柔和低对比
- 卡片阴影：`--shadow-soft-card`
- 品牌强调阴影：`--shadow-soft-brand`
- 避免高对比硬阴影

4. 交互策略：闭环反馈
- Hover：轻微上浮或色彩增强
- Active：轻微缩放（如 `scale(0.97)`）
- Focus：品牌色边框 + 低透明光圈
- Modal：`0.95 -> 1` 的淡入上移动画

## 4. 必备 Token 清单
- 字体：`--font-sans`、`--font-mono`
- 颜色：`--color-brand-primary`、`--color-brand-accent`、`--color-brand-page`、`--color-brand-border`、`--color-brand-danger`
- 圆角：`--radius-control-*`、`--radius-card`、`--radius-panel`
- 阴影：`--shadow-soft-*`
- 动画：`--dur-fast`、`--dur-base`、`--dur-modal`、`--ease-brand`

## 5. 语义类约定（推荐最小集）
- 容器类：`app-shell`、`ui-card`、`ui-card-strong`
- 按钮类：`ui-btn-primary`、`ui-btn-secondary`、`ui-btn-danger`
- 表单类：`ui-input`、`ui-label`
- 状态类：`ui-badge`、`ui-badge-danger`
- 布局类：`ui-sidebar`、`ui-header-glass`
- 弹层类：`ui-modal-mask`、`ui-modal-enter`
- 工具类：`accordion-grid`、`scrollbar-hide`

## 6. 实施步骤（可复用流程）
1. 先定义 Token（只改 `@theme`，不碰业务组件）
2. 再定义语义类（`@layer components`）
3. 最后替换页面中的散落 Tailwind 字符串
4. 统一验收：按钮、输入框、卡片、表格、弹窗、侧栏 6 类组件必须风格一致

## 7. 验收标准
- 无硬编码品牌色（优先用 Token）
- 无不成体系的随机圆角/阴影值
- 交互状态（hover/focus/active）完整
- 表格数字右对齐、状态 badge 风格统一
- 手风琴使用 `grid-template-rows` 过渡，不用 JS 算高度
