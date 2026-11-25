# Guided Tours & Contextual Help Authoring Guide

## 1. Adding or Updating Tour Steps
Edit `src/features/tours/config.ts`:
- Each step requires a unique `id`, a stable `[data-tour="..."]` target selector, optional `route` for multi-page navigation, and localized `title`, `description`, and `purpose` for `en`, `hi`, and `gu`.
- Persistence (`welcomeDismissed`, `completedTours`, `activeTourId`, `stepIndex`) is stored in `localStorage` (`sagar-tour-state-v1`) with zero personal data.

## 2. Contextual Help
Use `<ContextualHelp topic="calculator" | "bulk-enquiry" | "quotation" | "order-tracking" />` from `src/components/website/contextual-help.tsx` to provide plain-language numbered steps and a direct tour launcher.
