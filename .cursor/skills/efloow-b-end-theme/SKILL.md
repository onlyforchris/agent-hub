---
name: efloow-b-end-theme
description: Applies Efloow Agent Hub B-end admin theme (Tailwind v4 tokens, semantic ui-* classes, interaction patterns). Use when styling React frontend pages, adding UI components, refactoring scattered Tailwind, theming modals/tables/forms/sidebar, or matching the cssdemo reference aesthetic.
paths:
  - "frontend/**/*.tsx"
  - "frontend/**/*.ts"
  - "frontend/**/*.css"
  - "frontend/docs/**"
---

# Efloow B-End Theme

## Source of truth (read before styling)

| Asset | Path |
|-------|------|
| Rules & workflow | [frontend/docs/theme-skills.md](frontend/docs/theme-skills.md) |
| Visual reference (indigo/purple admin) | [frontend/docs/cssdemo.html](frontend/docs/cssdemo.html) |
| Live tokens & classes | [frontend/src/index.css](frontend/src/index.css) |

**Do not** duplicate long Tailwind strings from `cssdemo.html` into TSX. Extract patterns into `index.css`, then use semantic classes in components.

## Four design rules

1. **Color — dark shell, light content**: sidebar `--color-brand-sidebar` (#0b1120); page `--color-brand-page`; surfaces white; primary CTA = indigo→purple gradient.
2. **Radius — inner small, outer large**: controls `--radius-control-*`, cards `--radius-card`, panels `--radius-panel`.
3. **Shadow — soft only**: `--shadow-soft-card`, `--shadow-soft-brand`; no harsh drop shadows.
4. **Interaction — closed loop**: hover lift/color; `active:scale(0.97)` on buttons; focus ring via `--shadow-soft-focus`; modals `ui-modal-enter` (0.95→1).

## Implementation order

1. Add or adjust tokens in `@theme` only (`index.css`).
2. Add or adjust semantic classes in `@layer components` / `@layer utilities`.
3. Replace inline brand utilities in TSX (`bg-indigo-600`, `rounded-2xl shadow-*`, etc.) with `ui-*` classes.
4. Smoke-check six surfaces: button, input, card, table, modal, sidebar.

## Semantic class cheat sheet

Prefer these over one-off Tailwind in feature code:

| Need | Class |
|------|-------|
| Page shell / glass panel | `app-shell` |
| Standard card | `ui-card` |
| Hero / emphasis card | `ui-card-strong` |
| KPI tile | `ui-stat-card` |
| Chart container | `ui-chart-card` |
| Primary CTA | `ui-btn-primary` |
| Secondary | `ui-btn-secondary` |
| Destructive | `ui-btn-danger` |
| Text field | `ui-input` |
| Field label | `ui-label` |
| Section title | `ui-panel-title` |
| Status chip | `ui-badge`, `ui-badge-danger` |
| Data grid | `ui-table` on `<table>` |
| Dark sidebar | `ui-sidebar` |
| Page enter | `ui-page-enter` or `animate-fade-in` |
| Modal backdrop / content | `ui-modal-mask`, `ui-modal-enter` |
| Menu accordion | `accordion-grid` + `data-open="true"` |
| Hidden scrollbar | `scrollbar-hide` |
| Visible scrollbar region | `scrollbar-default` |

Full cssdemo→class mapping: [reference.md](reference.md).

## Allowed in components

- Layout/spacing utilities: `flex`, `grid`, `gap-*`, `p-*`, `col-span-*`
- Responsive breakpoints
- One-off positioning not worth a token
- Slate text scale for body copy (`text-slate-700`, etc.)

## Forbidden in feature TSX

- Hardcoded brand hex/rgb for buttons, borders, sidebars (use tokens via `ui-*` or `var(--color-brand-*)`)
- Copy-paste gradient/shadow strings from `cssdemo.html` (`shadow-[0_4px_14px_0_rgba(99,102,241,0.39)]`, etc.)
- Random `rounded-2xl` / `rounded-[1.5rem]` on cards when `ui-card` / `ui-card-strong` applies
- JS height animation for accordions (use `accordion-grid`)
- Overriding `ui-btn-primary` with conflicting `bg-slate-900` unless explicitly requested

## Tables & forms (from cssdemo)

- Table header: `bg-slate-50`, `border-slate-200`, medium weight labels.
- Numeric columns: `text-right`, `font-semibold`; positive green / negative red only for signed amounts.
- Checkbox column: centered; row hover `hover:bg-indigo-50/30`.
- Form groups: `ui-label` + `ui-input`; required marker `text-red-500`.
- Textarea: same focus treatment as `ui-input` (border primary + soft ring).

## When extending the theme

1. Check `cssdemo.html` for the intended look.
2. If missing, add token → semantic class in `index.css`.
3. Use the new class in TSX; do not add another inline variant.
4. Update [reference.md](reference.md) only if you add a new semantic class.

## Acceptance checklist

- [ ] No stray brand hex in TSX (grep `#4f46e5`, `#0[Bb]1120`, `indigo-600` on structural chrome)
- [ ] Buttons/inputs/cards use `ui-*` classes
- [ ] Hover / focus / active present on interactive controls
- [ ] Tables: numbers right-aligned; badges use `ui-badge*`
- [ ] Modals use mask + enter animation classes
- [ ] `npm run typecheck` passes (frontend)
