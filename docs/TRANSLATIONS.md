# Multilingual & Easy Mode Configuration Guide

## 1. Supported Languages
- English (`en`), Hindi (`hi`), Gujarati (`gu`) defined in `src/features/i18n/types.ts` and `src/features/i18n/dictionary.ts`.
- Language selection is persisted in `localStorage` (`sagar-locale-v1`) and updates `document.documentElement.lang`. Missing keys automatically fall back to English.

## 2. Easy Mode
- Toggled via `ExperienceControls` in the site header (`sagar-easy-mode-v1`), setting `data-easy-mode="true"` on `<html>`.
- Increases base body copy to `18px`, expands touch targets to `min-height: 48px`, and preserves all underlying forms and business logic.

## 3. Translation Rules
- Keep terminology simple and everyday; never machine-translate product names or official brand identifiers.
- Technical knowledge articles support reviewed `hi`/`gu` translations via `knowledge_articles.translations`.
