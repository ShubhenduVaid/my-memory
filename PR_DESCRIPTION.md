# Simplify UI with Modal-Based Settings

## Summary

Complete UI/UX overhaul following macOS design patterns (Raycast/Spotlight) and WCAG 2.1 AA accessibility compliance.

## Changes

### UI Simplification
- **Single settings entry point**: Replaced 4 toggle buttons with one gear icon ⚙️
- **Modal-based settings**: All integrations organized in tabbed modal (AI Provider | Obsidian | Local | Notion)
- **Toast notifications**: Non-blocking feedback replaces inline status messages
- **Search-first pattern**: Main interface is now clean - just search bar + settings icon

### Visual Improvements
- **Connection indicators**: Green dots on tabs show configured integrations at a glance
- **Empty state guidance**: Helpful hints with setup instructions in dashed boxes
- **Better button hierarchy**: Primary (yellow) vs secondary (gray) actions clearly distinguished
- **Improved spacing**: Better whitespace and visual hierarchy throughout

### Accessibility (WCAG 2.1 AA)
- **Color contrast**: All text now meets 4.5:1 minimum ratio
- **ARIA roles**: Modal (dialog), tabs (tablist/tab/tabpanel), results (listbox/option)
- **Focus management**: Modal traps focus, returns to trigger on close
- **Screen reader support**: Status indicators have sr-only text, live regions for dynamic content
- **Keyboard navigation**: Full keyboard support with visible focus rings

## Screenshots

### Before
- 4 buttons visible in search bar (AI Settings, Obsidian, Local, Notion)
- All panels could expand simultaneously, cluttering the interface
- Settings mixed with search results

### After
- Clean search bar with single gear icon
- Settings in organized tabbed modal
- Toast notifications for feedback
- Green dots indicate connected integrations

## Testing

- [x] Build passes (`npm run build`)
- [x] App launches (`npm run start`)
- [x] Settings modal opens/closes correctly
- [x] Tab switching works
- [x] Toast notifications appear
- [x] Focus trap works in modal
- [x] Escape closes modal
- [x] All integrations still functional

## Files Changed

- `src/renderer/index.html` - New modal structure, ARIA attributes
- `src/renderer/styles.css` - Modal styles, contrast fixes, focus rings
- `src/renderer/renderer.ts` - Modal logic, focus management, toast system
