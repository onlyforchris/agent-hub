# cssdemo.html → Project Theme Mapping

Reference prototype: `frontend/docs/cssdemo.html`  
Implemented tokens/classes: `frontend/src/index.css`

## Token inventory (`@theme`)

| Token | Value / role |
|-------|----------------|
| `--font-sans` | Inter stack |
| `--font-mono` | JetBrains Mono |
| `--color-brand-primary` | #4f46e5 (indigo-600) |
| `--color-brand-accent` | #8b5cf6 (purple) |
| `--color-brand-sidebar` | #0b1120 (demo `bg-[#0B1120]`) |
| `--color-brand-page` | #f8fafc (demo body bg) |
| `--color-brand-surface` | #ffffff |
| `--color-brand-border` | #e2e8f0 |
| `--color-brand-danger` | #dc2626 |
| `--radius-control-sm/md` | 0.5rem / 0.75rem |
| `--radius-card` | 1rem (~`rounded-2xl` on small cards) |
| `--radius-panel` | 1.5rem (~`rounded-[1.5rem]`) |
| `--shadow-soft-card` | Demo card shadow |
| `--shadow-soft-brand` | Demo primary glow |
| `--dur-fast/base/modal` | 150 / 220 / 300ms |
| `--ease-brand` | cubic-bezier(0.2, 0.8, 0.2, 1) |

## Component mapping

### Button (`cssdemo` `Button` variants)

| Demo variant | Tailwind in demo | Use in project |
|--------------|------------------|----------------|
| primary | `bg-gradient-to-r from-indigo-600 to-purple-600` + brand shadow + hover `-translate-y-0.5` | `ui-btn-primary` |
| secondary | white + slate border + hover indigo text | `ui-btn-secondary` |
| danger | red-50 / red-600 border | `ui-btn-danger` |
| ghost | transparent slate hover | `ui-btn-secondary` with extra utilities, or local `text-slate-500 hover:bg-slate-100` |

Shared: `active:scale-[0.97]` — already on `ui-btn-primary`; add to others if missing.

### Form

| Demo | Project |
|------|---------|
| `FormGroup` label | `ui-label` + optional `*` in red |
| `Input` / `Select` | `ui-input` |
| textarea in audit form | `ui-input` + `resize-none h-24` |

### Badge

| Demo `type` | Project |
|-------------|---------|
| danger / warning / success | Extend `ui-badge` variants in `index.css` if needed; today: `ui-badge`, `ui-badge-danger` |
| default slate ring | `ui-badge` |

### Layout chrome

| Demo | Project |
|------|---------|
| `aside` dark sidebar | `ui-sidebar` or `bg-[var(--color-brand-sidebar)]` |
| `GlobalHeader` white bar | `border-b border-slate-200/60 bg-white shadow-sm` (layout OK inline) |
| main `bg-slate-50` | `bg-[var(--color-brand-page)]` or body default |
| stat cards `rounded-2xl shadow-sm` | `ui-stat-card` |
| audit panel `rounded-[1.5rem] shadow-[0_8px_30px...]` | `ui-card-strong` |

### Sidebar accordion

Demo pattern:

```html
<div class="grid transition-[grid-template-rows] ... grid-rows-[1fr]|grid-rows-[0fr]">
  <ul class="overflow-hidden">...</ul>
</div>
```

Project: `accordion-grid` + `data-open="true"` (see `index.css` utilities).

### Dropdowns / popovers

Demo: `opacity-0 scale-95` → `opacity-100 scale-100` with `origin-top-right`.

Project: reuse transition utilities on a wrapper, or add `ui-popover-enter` in `index.css` if repeated.

### Modal

Demo scale 0.95 enter → `ui-modal-enter` + `ui-modal-mask`.

### Table (Tab list)

| Concern | Convention |
|---------|------------|
| Wrapper | `border border-slate-200 rounded-xl overflow-hidden` |
| thead | `bg-slate-50 border-b text-slate-500 font-medium` |
| tbody divide | `divide-y divide-slate-100` |
| row hover | `hover:bg-indigo-50/30` |
| amount column | `text-right font-semibold` + semantic color |
| pagination | secondary buttons + active page `bg-indigo-600` → prefer tokenized pill in theme if reused |

### Tabs

Demo: border-b + `border-indigo-600 text-indigo-600` active tab.

Not yet a `ui-tab` class — if tabs appear in 3+ places, add `ui-tabs` / `ui-tab-active` to `index.css`.

### Stepper (audit workflow)

Demo-only pattern; keep local to feature unless reused. Use brand primary for completed steps, slate for pending.

### Activity timeline

Demo avatar gradient + white card — layout-specific; use `ui-card` for comment bubbles.

## Files to touch by task type

| Task | Edit first |
|------|------------|
| New global look | `frontend/src/index.css` `@theme` |
| New reusable control | `index.css` `@layer components` |
| New page | TSX with `ui-*`; layout utilities only |
| Prototype parity check | Open `frontend/docs/cssdemo.html` in browser |

## Grep helpers (violations)

```bash
# From frontend/
rg "from-indigo-600|#4f46e5|#0[Bb]1120|shadow-\[0_" src --glob "*.tsx"
rg "rounded-\[1\.5rem\]|rounded-2xl border border-slate" src --glob "*.tsx"
```

Fix hits by switching to semantic classes or extending `index.css`.
