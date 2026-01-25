# UI/UX Design System

**Target Platform:** macOS 26 (Tahoe) / iOS 26 Ecosystem
**Framework:** Electron (React + TypeScript)
**Design Language:** Liquid Glass (Native + CSS Hybrid)
**Architecture:** Feature-Sliced Design (FSD)

---

## 1. Core Philosophy

This application is designed as a **native citizen of the Apple ecosystem**. It prioritizes the Liquid Glass aesthetic, characterized by real-time refraction, fluid morphing, and vibrancy, over traditional flat web design.

A strict separation is maintained between:

- **Glass Controls (Foreground)**
- **Opaque Content (Background)**

This ensures visual clarity, accessibility, and predictable performance.

---

## 2. Technical Architecture: Feature-Sliced Design (FSD)

The frontend follows **Feature-Sliced Design** to ensure scalability and maintain clear separation of concerns. Complex features like the Bento Grid and Command Palette remain isolated and composable.

### 2.1 Folder Structure

```text
src/
├── app/        # Global styles, providers, entry points
├── processes/  # Multi-step flows (Onboarding, Checkout)
├── pages/      # Route-level components
├── widgets/    # Independent UI blocks (Header, Sidebar, BentoGrid)
├── features/   # User actions (ToggleTheme, AddToProject)
├── entities/   # Business models (User, Project, Task)
└── shared/     # Reusable primitives (UI, API, utilities)
```

**Rule:** A layer may only import from layers below it.

**Bento Grid Implementation:**
Each tile is a Widget composed of Entities (data) and Features (actions).

### 2.2 Electron Security & Performance

- **Context Isolation:** Enabled. Renderer never accesses Node.js APIs directly.
- **Sandboxing:** Enabled.
- **IPC Pattern:**
  - `ipcRenderer.invoke` (Renderer)
  - `ipcMain.handle` (Main)

- **Memory Hygiene:** Suspend invisible `BrowserViews` aggressively to align with macOS App Nap behavior.

---

## 3. The Liquid Glass Visual System

macOS 26 introduces physics-based glass materials. Electron applications must simulate this via a hybrid of native vibrancy and web-based rendering.

### 3.1 Window Composition

- Hide standard title bar
- Use custom drag regions

**Main Process:**

```ts
titleBarStyle: 'hidden'
trafficLightPosition: { x: 20, y: 20 }
```

**CSS:**

```css
.titlebar-drag-region {
  -webkit-app-region: drag;
}
```

### 3.2 Material Simulation (Refraction)

`backdrop-filter: blur()` alone is insufficient. Refraction must distort the background.

**Strategy:**

- **Sidebars / Modals:** Native vibrancy via `electron-liquid-glass`
- **Floating UI:** CSS + SVG filters

**SVG Filter:**

```xml
<svg style="display: none;">
  <filter id="liquid-refraction">
    <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" result="noise" />
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="20" xChannelSelector="R" yChannelSelector="G" />
  </filter>
</svg>
```

**CSS Usage:**

```css
.glass-panel {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(24px) saturate(180%);
  filter: url(#liquid-refraction);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}
```

### 3.3 Typography & Icons

- **Font Stack:** `system-ui, -apple-system, BlinkMacSystemFont`
- **Smoothing:** `-webkit-font-smoothing: antialiased`
- **Icons:** SF Symbols (SVG pipeline or web-font fallback)

---

## 4. Interaction Patterns

### 4.1 Command Palette (Cmd + K)

The command palette acts as the central nervous system of the app.

**Design:** Floating Liquid Glass modal

**Modes:**

1. Navigation ("Go to Settings")
2. Action ("Create Issue")
3. Input (Morphs to show form fields)

**Shortcut:** Registered via Electron `globalShortcut` when app is focused.

### 4.2 Bento Grid Dashboard

- **Library:** `react-grid-layout`
- **Drag:** Scale to `1.02`, increased shadow, translucent glass
- **Reflow:** Fluid CSS transitions (no snapping)

**Responsive Grid:**

- Desktop: 12 columns
- Tablet: 6 columns
- Mobile: Single column stack

### 4.3 Sidebar & Navigation

- Native macOS sidebar vibrancy
- Toolbar transitions from transparent to heavy glass on scroll

---

## 5. Motion & Fluidity

Animations must feel physical, not mechanical.

### 5.1 Apple Spring Curve

```css
:root {
  --ease-spring: linear(
    0,
    0.009,
    0.035 2.1%,
    0.141 4.4%,
    0.723 12.9%,
    0.938 16.7%,
    1.017 18.4%,
    1.077 20.4%,
    1.121 22.1%,
    1.149 24.2%,
    1.159 26.4%,
    1.152 28.6%,
    1.136 30.7%,
    1.094 34.8%,
    1.056 39%,
    1.008 46.8%,
    0.99 53.4%,
    0.998 61.6%,
    1.003 71.2%,
    1
  );
}

.modal-enter {
  transition:
    transform 0.5s var(--ease-spring),
    opacity 0.4s ease-out;
}
```

### 5.2 Layout Morphing

Use **FLIP animations** for shared-element transitions, especially when expanding Bento tiles.

---

## 6. Accessibility (WCAG 2.2)

### 6.1 Contrast on Glass

- Avoid pure white text directly on glass
- Always provide text-shadow or material backing
- Focus rings:
  - 2px solid `#007AFF`
  - 2px white offset

### 6.2 Reduce Transparency

```css
@media (prefers-reduced-transparency: reduce) {
  .glass-panel {
    backdrop-filter: none !important;
    filter: none !important;
    background: var(--bg-solid-opaque) !important;
    border: 1px solid var(--border-solid) !important;
  }
}
```

### 6.3 Reduce Motion

- Disable spring physics
- Fallback to simple cross-fade transitions

---

## 7. System Integration Checklist

This checklist defines required and optional integrations to ensure the application behaves as a first‑class macOS citizen.

### 7.1 Menu Bar App

- Secondary lightweight menu bar (tray) app for quick status checks
- No full window rendering; use popovers only
- Shares state with main app via IPC or shared storage
- Must respect system appearance (Dark / Light mode)
- Fast launch time (<200ms perceived)

### 7.2 Native macOS Menus

- Replicate all Command Palette actions in the native Application Menu
- Ensure menu items expose keyboard shortcuts consistently
- Group actions using standard macOS conventions (File, Edit, View, Window)
- Required for accessibility and screen reader compatibility

### 7.3 Command & Shortcut Parity

- Every critical action must be reachable via:
  - Command Palette
  - Native Menu Bar
  - Keyboard shortcut (where applicable)

- Avoid shortcut conflicts with system-reserved key combinations

### 7.4 Haptics & Feedback

- Trigger subtle haptic feedback on:
  - Bento Grid snap / reflow completion
  - Successful drag-and-drop placement

- Haptics must be non-blocking and optional
- Gracefully degrade on unsupported hardware

### 7.5 Dark Mode & System Appearance

- Fully respect `nativeTheme.shouldUseDarkColors`
- No manual color inversion hacks
- Liquid Glass materials must adapt opacity and contrast dynamically
- Re-render glass surfaces on appearance change

### 7.6 Performance & Power Awareness

- Suspend inactive BrowserViews
- Avoid continuous animations when window is unfocused
- Respect macOS App Nap and energy-saving behaviors
- Throttle background tasks when running as menu bar app only

### 7.7 Accessibility Integration

- Verify all native menus are keyboard-navigable
- Ensure focus order matches visual hierarchy
- Validate VoiceOver labels for Command Palette and Bento Grid tiles

---

## 8. References & Inspiration

The following resources informed architectural and interaction decisions. They are not normative requirements but serve as design and engineering guidance:

- Electron application architecture and security best practices
- Native-style Liquid Glass experiments for Electron
- Command Palette interaction patterns
- WCAG 2.2 accessibility guidance, especially focus indicators
- macOS menu bar and native menu design guidelines

These references should be revisited periodically to ensure continued alignment with platform evolution and accessibility standards.
