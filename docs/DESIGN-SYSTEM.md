# DESIGN-SYSTEM.md — Trackr

**Extracted from source**, not estimated. Read directly from `Mocks/untitled.pen` via the pen.dev connector on 2026-08-26.

Supersedes §0 of `FRONTEND-COMPONENTS.md`, where every token was a visual approximation. That file's structure stands; its values do not.

---

# 1 · TWO TOKEN SETS — `M/` MEANS MOCKUP, NOT MOBILE

The file carries two parallel systems:

| Prefix | Purpose | Evidence |
|---|---|---|
| **unprefixed** — `ink`, `paper`, `rule`, `redline`, `wf-ink` | **Wireframe / blueprint** artboards | `wf-ink` = wireframe ink · `redline` + `redline-soft` = review annotation markup |
| **`m-`** — `m-bg`, `m-primary`, `m-accent`… | **Mockup** — the real product | Full semantic colour system with state variants |

Same split in the components: `Button` is the wireframe version, `M/Button` the mockup version.

**Implementation uses the `m-` set only.** The unprefixed tokens never reach code.

---

# 2 · TOKENS — exact values

## 2.1 Mockup set (`m-`) — build against these

```css
@theme {
  /* surfaces */
  --color-bg:                #F5F3EF;   /* warm off-white page */
  --color-surface:           #FFFFFF;
  --color-surface-2:         #EFEBE3;   /* tag / chip background */
  --color-border:            #DBD5C9;
  --color-border-strong:     #C2BAA9;

  /* text */
  --color-ink:               #1B1B18;
  --color-ink-2:             #54524A;
  --color-muted:             #8B8778;

  /* primary — buttons, focus */
  --color-primary:           #16324F;
  --color-primary-hover:     #0F2439;
  --color-primary-foreground:#FFFFFF;
  --color-primary-soft:      #E4EAEE;

  /* accent — logo, avatar, active rail */
  --color-accent:            #C6602C;
  --color-accent-hover:      #A54E23;
  --color-accent-foreground: #FFFFFF;
  --color-accent-soft:       #F5E1D2;

  /* status */
  --color-success:           #1F7A4D;   --color-success-soft: #DEEDE2;
  --color-warning:           #A6740F;   --color-warning-soft: #F2E7CE;
  --color-danger:            #AE3B2C;   --color-danger-soft:  #F1DFD9;
  --color-violet:            #5B4B8F;   --color-violet-soft:  #E5E1F1;

  /* sidebar — its own scale */
  --color-sidebar:           #132638;
  --color-sidebar-2:         #1C3A54;   /* active item */
  --color-sidebar-ink:       #C7D3DC;
  --color-sidebar-muted:     #7E93A3;

  /* type */
  --font-display: "Archivo", sans-serif;
  --font-body:    "IBM Plex Sans", sans-serif;
  --font-mono:    "IBM Plex Mono", monospace;
}
```

**Every `-soft` variant pairs with its base** — that's the badge and banner pattern: `bg-warning-soft` + `text-warning`.

## 2.2 Wireframe set — reference only

`ink #15181C` · `ink2 #3C444C` · `muted #6B737C` · `paper #F6F7F8` · `sheet #FFFFFF` · `rule #C9CDD3` · `rule-soft #DFE3E7` · `fill #E4E7EA` · `fill2 #EDEFF1` · `redline #B33A26` · `redline-soft #F0DEDA` · `wf-ink #4A525A`
Fonts: `f-display Archivo` · `f-body IBM Plex Sans` · `f-mono IBM Plex Mono`

---

# 3 · WHAT I GOT WRONG

My values in `FRONTEND-COMPONENTS.md` §0 were read off rendered PNGs by eye. Nearly all were wrong.

| | My estimate | Actual | Off by |
|---|---|---|---|
| Accent | `#C2410C` | `#C6602C` | noticeably lighter, browner |
| Sidebar | `#1B2A3D` | `#132638` | darker, cooler |
| Primary | — (conflated with sidebar) | `#16324F` | **a separate token I'd missed** |
| Border | `#E3E0DC` | `#DBD5C9` | warmer |
| Surface-2 | — | `#EFEBE3` | missed entirely |
| **Body font** | system sans | **IBM Plex Sans** | wrong typeface |
| **Display font** | system sans | **Archivo** | wrong typeface |
| **Mono font** | `ui-monospace` | **IBM Plex Mono** | wrong typeface |
| Status colours | — | 4 pairs | missed entirely |
| Sidebar scale | — | 4 tokens | missed entirely |

**The fonts are the serious one.** Three specific typefaces, none of them system defaults — the whole product would have looked wrong.

---

# 4 · ICONS — Lucide

Every icon node carries `library: "lucide"`. Confirmed in `M/Button` (`arrow-right`), `M/Checkbox` (`check`), `M/Nav item` (`layout-dashboard`).

**Use `lucide-react`.** Not a decision to make — it's what the design is drawn against, and icon names map one to one.

Sizes seen: **16px** in buttons · **17px** in nav items · **13px** inside the checkbox.

---

# 5 · COMPONENT SPECS — exact

## M/Button → P-01

```
fill              $m-primary
padding           13px vertical, 22px horizontal
gap               8
justify/align     center / center
Icon              lucide, 16×16, $m-primary-foreground, DISABLED by default
Label             $m-font-body · 13.5px · weight 600 · letterSpacing 0.1
                  fill $m-primary-foreground
```

```jsx
className="inline-flex items-center justify-center gap-2 px-[22px] py-[13px]
           bg-[--color-primary] text-[--color-primary-foreground]
           font-body text-[13.5px] font-semibold tracking-[0.1px]
           hover:bg-[--color-primary-hover]"
```

**The icon exists but is disabled** — the component supports an optional leading icon. Build it as an optional prop, not omitted.

## M/Field → P-02 + P-03

```
width             280 (fill_container in context)
layout            vertical, gap 7

Label             $m-font-mono · 10.5px · weight 600 · letterSpacing 0.8
                  fill $m-ink-2 · content UPPERCASE
Box               fill $m-surface · stroke $m-border 1px · padding 11/13
Value             $m-font-body · 13.5px · normal · fill $m-muted
```

⚠️ **The uppercase mono label is a real component property, not styling I inferred.** `letterSpacing: 0.8` at 10.5px mono. Encode it in the `Label` primitive.

## M/Tag → P-05

```
fill              $m-surface-2
padding           5px vertical, 10px horizontal
gap               5
Label             $m-font-mono · 10.5px · weight 600 · letterSpacing 0.5 · $m-ink-2
```

## M/Checkbox

```
18 × 18 · fill $m-surface · stroke $m-border-strong 1.3px
Check icon        lucide "check" · 13×13 · $m-primary · disabled when unchecked
```

## M/Avatar → P-17

```
34 × 34 · fill $m-accent
Initials          $m-font-display · 12.5px · weight 700 · #FFFFFF
```

**Display font on initials** — Archivo, not body. Confirms L082: initials only, no image.

## M/Nav item → sidebar

```
width 208 · gap 11 · padding 10/14 · fill transparent (#00000000)
Icon              lucide · 17×17 · $m-sidebar-ink
Label             $m-font-body · 13.5px · weight 500 · $m-sidebar-ink
```

Active state uses `$m-sidebar-2` as fill plus the accent left rail (visible in the sidebar mockup).

---

# 6 · TYPE SCALE

Non-integer sizes throughout — deliberate, and they need explicit Tailwind values:

| Size | Weight | Font | Used for |
|---|---|---|---|
| **10.5px** | 600 | mono | field labels, tags — `letterSpacing 0.5–0.8` |
| **12.5px** | 700 | display | avatar initials |
| **13.5px** | 500 | body | nav labels |
| **13.5px** | 600 | body | button labels |
| **13.5px** | normal | body | field values |

`text-[13.5px]` rather than `text-sm` — the standard scale would round these and the design would drift.

---

# 7 · SPACING

Observed: `5 · 7 · 8 · 10 · 11 · 13 · 14 · 22`

Not a 4px or 8px grid. Use the literal values from each component spec rather than snapping to a scale.

---

# 8 · OPEN

| | Question |
|---|---|
| **Corner radius** | **No `cornerRadius` on any component.** The default is 0, and omitted properties mean defaults — so the system appears to use **square corners**. But the rendered PNGs read as slightly rounded to me. Confirm with your designer: sharp, or a small radius that didn't serialise? This affects every primitive. |
| Shadows | None present on any component. Cards appear flat with a border only — confirm |
| Focus states | Not defined in the components. Needs a decision: accent ring, primary ring, or offset outline |
| Disabled states | Not defined. `M/Button` has no disabled variant — needed for the LinkedIn SSO button (C4) |

**Corner radius is the one to answer first** — it touches all 21 primitives, and `rounded-md` versus square is the difference between two entirely different-looking products.

---

# 9 · WHAT THIS CHANGES

- `FRONTEND-COMPONENTS.md` §0 tokens → **replaced by §2.1 here**
- Every `rounded-md` in that file → **pending §8's radius answer**
- Icons → **`lucide-react` confirmed**, was unspecified
- Fonts → **three specific families**, was unspecified
- `P-03 Label` → uppercase mono with letter-spacing is now a **verified spec**, not an inference
