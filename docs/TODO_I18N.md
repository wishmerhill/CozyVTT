# TODO — i18n / l10n

Known outstanding work for frontend localization (Italian/English), collected during the FASE A/B/C/D cleanup sessions. This is not an exhaustive audit — it records what surfaced while doing the actual work, not a systematic pass over the whole codebase.

Translation namespaces: `frontend/public/locales/{it,en}/*.json` (`common`, `campaign`, `character`, `admin`, `assets`, `auth`, `dashboard`, `errors`, `game-systems`, `setup`, `validation`).

## FASE D (done, 2026-09-04)

- **`src/components/character-sheets/`** — fully audited and cleaned up, including subfolders not touched by earlier phases:
  - `dnd5e/`, `pathfinder2e/`, `call-of-cthulhu-7e/` were mostly already wired to `sheet.*` keys from an earlier, unlogged pass; remaining gaps (a hardcoded tooltip in `SpellcastingBlock.tsx`) were closed.
  - `flexible/` (generic/flexible character sheet — editor, viewer, all `components/` and `components/sections/*`, plus `utils/section-templates.ts`) had **zero i18n coverage** before this phase. Added the `sheet.flexible.*` namespace (58 keys, includes a `sheet.flexible.templates.*` block for the add-section-menu template picker) and wired up all 14 files. Default data values created by templates (e.g. a new stats field named "New Stat", a blank section titled "New List") are intentionally left in English — they're mutable user data, not UI chrome, consistent with how template-created section titles ("Attributes", "Skills"...) already worked.
  - `shadowrun6e/Shadowrun6eCharacterSheet.tsx` (the "not implemented" placeholder shown when viewing a Shadowrun 6e character) was still hardcoded; added `editor.shadowrunViewTitle` / `editor.shadowrunViewNotImplemented` / `editor.shadowrunRoadmapNote`, mirroring the existing `editor.shadowrunEditorTitle` / `editor.shadowrunEditorNotImplemented` pair used by the equivalent editor-mode placeholder.
- **`frontend/src/components/campaign/ChatMessage.tsx`** — the `'en-US'` hardcoded locale (see bug below, carried over from FASE C) was already fixed in this branch by the time FASE D started; verified `formatRelativeTime` now takes and uses `i18n.language`.
- **Namespace audit** (`assets`, `errors`, `game-systems`, `validation`, plus `character`/`common`/`admin` spot-checked) — recursive EN/IT key-set diff found **zero missing keys** in any namespace. A pass for suspiciously-identical EN/IT values turned up only expected cases: proper nouns (class/race/game-system names), the app name, and interpolation-only templates (`"{{count}} file"`, `"#{{number}}"`) — none need translation.
- **Real bug found while auditing `SpellcastingBlock.tsx`** — the `ritual` and `concentration` spell badges had their translation keys swapped (`spell.ritual` rendered `sheet.preparedSpell`'s text via a mismatched key, etc.), so the wrong label showed next to ritual/concentration spells regardless of language. Fixed alongside the i18n cleanup since it was directly tied to the keys being audited.
- Paths from the FASE C "missing paths" list, re-verified: `src/components/journal/` still does not exist; `src/pages/CharacterPage.tsx` still does not exist (`CharactersPage.tsx` / `CharacterEditorPage.tsx` / `CharacterTemplatesPage.tsx` remain out of scope, not yet decided for a future phase).

## Real bug/limitation found during FASE C (fixed in FASE D)

- ~~**`frontend/src/components/campaign/ChatMessage.tsx:48`** — the fallback for messages older than a week uses `date.toLocaleDateString('en-US', {...})`, a hardcoded locale.~~ Fixed: `formatRelativeTime` now takes a `locale` parameter, called with `i18n.language`.

## Namespaces/folders not yet audited

- `src/pages/CharactersPage.tsx`, `CharacterEditorPage.tsx`, `CharacterTemplatesPage.tsx` — still not covered by any phase so far.
- `auth`, `dashboard`, `setup` namespaces — not specifically re-checked in FASE D (FASE D's namespace audit covered `assets`, `errors`, `game-systems`, `validation`, `character`, `common`, `admin` only).

## Cases intentionally left untranslated (decisions made in FASE C, revisit if requirements change)

- **`COMMON_CONDITIONS` in `NpcQuickEditor.tsx`** (Blinded, Charmed, Prone, etc.) — condition names stay in English because they're stored as literal state values (`token.conditions`), synced with the backend and other clients via `.includes()`. Translating only the displayed label without touching the stored value would require a separate value→label i18n map (the stored value would stay the English ID, only the rendered label would be translated) — not done, to keep scope bounded. This affects the UI the DM sees.
- **Game system codes/names** ("D&D 5e", "PF2e", "SR6e", "CoC 7e", "Flex") — left as identifiers, not translated (proper nouns/brand names).
- **Dice notation and quick-roll buttons** (`1d20+5`, `4d6kh3`, `d4`…`d100` buttons, `Adv`/`Dis` chips) — technical game notation, not prose.
- **Technical units** (`px`, `ft`, hex colors `#RRGGBB`, file extensions `.mp3`/`.uvtt`) — left unchanged. Exception: the "sq" (squares) unit in `DmLightControls.tsx` was translated (`lighting.squaresUnit`) because it reads more like prose than technical notation — worth checking whether other similar units deserve the same treatment.
- **Raw enum/data values rendered without a mapping**: `token.type ?? 'npc'` fallback and disposition shown via a `capitalize` CSS class in `InitiativeTracker.tsx`; `dragData.name ?? 'Token'` fallback in `MapCanvas.tsx`; raw `template.type` badge in `TokenTemplateLibrary.tsx`. These are data values, not authored copy, but they stay visible in English regardless of the chosen language — worth deciding later whether they need a dedicated translation map.
- **`namePlaceholder: "Aria Moonshadow"`** in `character.json` — example placeholder (fantasy name), deliberately left identical in IT/EN, not UI copy to translate.
- **`'Failed to load a blank sheet'`** in `NewCharacterTemplateModal.tsx` — a "dead" error string: it's thrown as an `Error`, but the `catch` block only reads `err.response?.data?.message`, so it never actually reaches the UI. Not translated because it isn't user-facing; worth cleaning up or actually wiring it to the displayed message if the dead string should go away.
- **`SectionTemplate.create()` default titles/values** in `flexible/utils/section-templates.ts` (e.g. new "Attributes"/"Skills" section titles) and default field names added by the editors (e.g. `StatsEditor`'s "New Stat", `TableEditor`'s "New Column") — left in English. They're mutable user data written into `character.data`, not authored UI copy; the user can rename them immediately. Only the template *picker* labels (`sheet.flexible.templates.*.name`/`.description`, shown in `AddSectionMenu.tsx`) are translated.

## Process notes (useful for continuing this work in future sessions)

- Established convention: `useTranslation('namespace')` with bare keys for the default namespace; `useTranslation(['ns1','ns2'])` with an explicit `ns2:key` prefix for additional namespaces (see `CampaignInfo.tsx`, `ChatPanel.tsx` as reference).
- Functions/constants defined outside the component (and thus without access to `t`) should be converted to receive `t` as a parameter rather than being moved inside the component (pattern used for `getModeLabels(t)`, `formatDuration(t, ...)`, the `TEMPLATE_KEYS_BY_SYSTEM` catalogs in `NewCharacterModal.tsx`).
- Before adding new keys, always check whether the `campaign`/`character`/`common` namespace already has a semantically fitting section: after FASE D `character.json` alone is ~950 keys, and duplication is a real risk.
- Recommended after every round of changes: verify IT/EN key parity (recursive key-set diff, not just `JSON.parse`).
- For plain data files (`.ts`, no React component, no `useTranslation`) that hold display strings — e.g. `section-templates.ts` — store i18n **keys** in the data (with a short comment on the interface saying so) and translate with `t()` in the component that renders them, rather than trying to translate at the data-definition site.
- When a hint string embeds a UI label inline (e.g. `Click "Add Section" to get started`), split it into an interpolated key (`clickAddSectionHint: 'Click "{{action}}" below to get started.'`) so the button's own translated label (`t('sheet.flexible.addSection')`) is reused instead of duplicating the English text in two keys that could drift apart during translation.
