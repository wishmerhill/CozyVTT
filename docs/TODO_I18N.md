# TODO — i18n / l10n

Known outstanding work for frontend localization (Italian/English), collected during the FASE A/B/C cleanup sessions. This is not an exhaustive audit — it records what surfaced while doing the actual work, not a systematic pass over the whole codebase.

Translation namespaces: `frontend/public/locales/{it,en}/*.json` (`common`, `campaign`, `character`, `admin`, `assets`, `auth`, `dashboard`, `errors`, `game-systems`, `setup`, `validation`).

## Paths missing from FASE C (never cleaned up, verify actual existence/name before retrying)

- `src/components/sheet/` — does not exist. The closest equivalent is `src/components/character-sheets/` (D&D5e, PF2e, CoC7e, Shadowrun6e sheets, "flexible" editor/viewer) and **was never cleaned up** in FASE A/B/C. This is likely the UI area with the most remaining hardcoded strings, given the volume of game text (skill names, traits, sheet sections). `character.json` already has a rich `sheet.*` section (probably created for these components in an earlier phase) — check how much real coverage already exists in the code before starting from scratch.
- `src/components/journal/` — does not exist, no equivalent folder found in the repo as of the check on 2026-09-03.
- `src/pages/CharacterPage.tsx` — does not exist. Instead there are `CharactersPage.tsx`, `CharacterEditorPage.tsx`, `CharacterTemplatesPage.tsx` — conceptually different pages, not cleaned up because they were outside the explicit scope of the request. Worth deciding whether they belong in a future phase.

## Real bug/limitation found during FASE C

- **`frontend/src/components/campaign/ChatMessage.tsx:48`** — the fallback for messages older than a week uses `date.toLocaleDateString('en-US', {...})`, a hardcoded locale. It's not a string passed through `t()`, so the cleanup didn't touch it, but the result still renders months/formats in English for users with Italian active. Fix by replacing `'en-US'` with the active locale (e.g. `i18n.language`) or wiring `Intl.DateTimeFormat` to the current language.

## Namespaces/folders not yet audited (not covered by FASE A/B/C)

The following areas already have a translation namespace but were not verified in this session (out of scope for FASE A/B/C): `admin` (only the relative time labels were covered in FASE B, the rest of the admin panel was not checked), `assets`, `auth`, `dashboard`, `errors`, `game-systems`, `setup`, `validation`, plus all of `character-sheets/` (see above) and `journal`/`sheet` if and when located. Should be planned as FASE D/E etc.

## Cases intentionally left untranslated (decisions made in FASE C, revisit if requirements change)

- **`COMMON_CONDITIONS` in `NpcQuickEditor.tsx`** (Blinded, Charmed, Prone, etc.) — condition names stay in English because they're stored as literal state values (`token.conditions`), synced with the backend and other clients via `.includes()`. Translating only the displayed label without touching the stored value would require a separate value→label i18n map (the stored value would stay the English ID, only the rendered label would be translated) — not done, to keep scope bounded. This affects the UI the DM sees.
- **Game system codes/names** ("D&D 5e", "PF2e", "SR6e", "CoC 7e", "Flex") — left as identifiers, not translated (proper nouns/brand names).
- **Dice notation and quick-roll buttons** (`1d20+5`, `4d6kh3`, `d4`…`d100` buttons, `Adv`/`Dis` chips) — technical game notation, not prose.
- **Technical units** (`px`, `ft`, hex colors `#RRGGBB`, file extensions `.mp3`/`.uvtt`) — left unchanged. Exception: the "sq" (squares) unit in `DmLightControls.tsx` was translated (`lighting.squaresUnit`) because it reads more like prose than technical notation — worth checking whether other similar units deserve the same treatment.
- **Raw enum/data values rendered without a mapping**: `token.type ?? 'npc'` fallback and disposition shown via a `capitalize` CSS class in `InitiativeTracker.tsx`; `dragData.name ?? 'Token'` fallback in `MapCanvas.tsx`; raw `template.type` badge in `TokenTemplateLibrary.tsx`. These are data values, not authored copy, but they stay visible in English regardless of the chosen language — worth deciding later whether they need a dedicated translation map.
- **`namePlaceholder: "Aria Moonshadow"`** in `character.json` — example placeholder (fantasy name), deliberately left identical in IT/EN, not UI copy to translate.
- **`'Failed to load a blank sheet'`** in `NewCharacterTemplateModal.tsx` — a "dead" error string: it's thrown as an `Error`, but the `catch` block only reads `err.response?.data?.message`, so it never actually reaches the UI. Not translated because it isn't user-facing; worth cleaning up or actually wiring it to the displayed message if the dead string should go away.

## Process notes (useful for continuing this work in future sessions)

- Established convention: `useTranslation('namespace')` with bare keys for the default namespace; `useTranslation(['ns1','ns2'])` with an explicit `ns2:key` prefix for additional namespaces (see `CampaignInfo.tsx`, `ChatPanel.tsx` as reference).
- Functions/constants defined outside the component (and thus without access to `t`) should be converted to receive `t` as a parameter rather than being moved inside the component (pattern used for `getModeLabels(t)`, `formatDuration(t, ...)`, the `TEMPLATE_KEYS_BY_SYSTEM` catalogs in `NewCharacterModal.tsx`).
- Before adding new keys, always check whether the `campaign`/`character`/`common` namespace already has a semantically fitting section: after FASE C these files are quite large (980 `campaign` keys, 333 `character`, 195 `common`), and duplication is a real risk.
- Recommended after every round of changes: verify IT/EN key parity (recursive key-set diff, not just `JSON.parse`).
