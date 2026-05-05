# Oikos Repository Cleanup Design

**Datum:** 2026-05-04  
**Status:** Approved  
**Ziel:** Umfassende Pflege des GitHub Repos und der Projektdokumentation nach Release v0.45.0

## Überblick

Nach der erfolgreichen Implementierung von CardDAV Contacts Integration (v0.45.0) und Generic CalDAV Multi-Account Sync (v0.44.0) hat sich eine erhebliche Menge an abgeschlossenen Implementierungsplänen, Design-Specs und Audit-Dokumenten angesammelt. Diese Pflege-Aktion bringt die Projektdokumentation auf den aktuellen Stand, indem implementierte Dokumente archiviert, veraltete Inhalte entfernt und aktuelle Dokumentation aktualisiert werden.

## Hintergrund

### Analysierte Zeitspanne
CHANGELOG v0.40.0 bis v0.45.0 (1. Mai - 4. Mai 2026):
- v0.40.0: Budget Loans Tracker, Dashboard Widget Sizes
- v0.41.0: Birthday Badge, Filter Chips, Calendar Improvements
- v0.42.0: Module Toggles, Bulk Actions
- v0.43.0: Automatic Scheduled Backups
- v0.44.0: Generic CalDAV Multi-Account Sync
- v0.44.1: CalDAV Migration Crash Fix
- v0.45.0: CardDAV Contacts Integration, Multi-Value Contact Fields

### Identifizierte Probleme

1. **BACKLOG.md veraltet** - "Completed Features" endet bei v0.41.0, BL-11 (CardDAV) noch in "Open Entries" obwohl implementiert
2. **PROGRESS.md obsolet** - Session-spezifisches Tracking-Dokument für v0.45.0
3. **README.md unvollständig** - Contacts-Beschreibung erwähnt CardDAV Multi-Account Sync nicht
4. **26 Markdown-Dateien in docs/** - viele implementierte Pläne/Specs/Audits
5. **Emojis im CHANGELOG** - inkonsistent mit Projektstil

## Entscheidungen

Basierend auf Klärungsfragen wurden folgende Strategien festgelegt:

1. **Archivierung:** Implementierte Pläne/Specs/Designs → `docs/archive/` (Option B)
2. **PROGRESS.md:** Löschen, da im Git-Verlauf erhalten (Option A)
3. **BACKLOG.md:** Auf "Open Entries" reduzieren, "Completed" streichen (Option C)
4. **Audit-Dateien:** Alle nach `docs/archive/` (Option A)
5. **Design-Dokumente:** Nach `docs/archive/designs/` (Custom)
6. **awesome-selfhosted/:** Behalten (Custom)
7. **superpowers/specs + plans:** Nach `docs/archive/superpowers/` (Option A)
8. **README.md:** Contacts-Beschreibung komplett neu formulieren (Option C)
9. **Emojis:** Aus CHANGELOG entfernen, nirgends neu einbauen
10. **Vorgehen:** Thematische Commits (Ansatz A)

## Design

### 1. Archivierungsstrategie

**Ziel:** Implementierte Pläne, Specs und Design-Dokumente aus dem aktiven Arbeitsbereich entfernen, aber als historische Referenz bewahren.

**Archivstruktur:**
```
docs/archive/
├── designs/
│   ├── 2026-05-04-cardav-api-routes-implementation.md
│   ├── 2026-05-04-cardav-contacts-design.md
│   └── 2026-05-04-generic-caldav-design.md
├── superpowers/
│   ├── plans/
│   │   ├── 2026-04-20-ics-subscription.md
│   │   ├── 2026-04-21-installer-system.md
│   │   ├── 2026-04-25-ux-accessibility-fixes.md
│   │   ├── 2026-04-26-ux-improvements.md
│   │   ├── 2026-04-27-ux-ui-optimization.md
│   │   ├── 2026-04-29-ux-improvements.md
│   │   ├── 2026-04-29-ux-navigation-improvements.md
│   │   ├── 2026-04-29-ux-navigation-redesign.md
│   │   ├── 2026-04-30-microinteraction-long-loops.md
│   │   ├── 2026-05-04-cardav-contacts.md
│   │   └── 2026-05-04-generic-caldav.md
│   └── specs/
│       ├── 2026-04-20-ics-subscription-design.md
│       ├── 2026-04-27-ux-ui-optimization-design.md
│       ├── 2026-04-29-ux-navigation-redesign-design.md
│       └── ICS_URL_Subscription_v2.md
├── color-redesign-proposal.md
├── installer-plan.md
├── installer-recon.md
├── premium-ui-audit.md
└── ux-audit-plan.md
```

**Vorgehen:**
1. Erstelle Archivverzeichnisse: `docs/archive/`, `docs/archive/designs/`, `docs/archive/superpowers/plans/`, `docs/archive/superpowers/specs/`
2. Verschiebe Dateien mit `git mv` (erhält Git-Historie)
3. `docs/awesome-selfhosted/` bleibt unberührt

**Dateien insgesamt:** 23 Markdown-Dateien

### 2. Bereinigungsstrategie

**Ziel:** Session-spezifische Tracking-Dokumente entfernen, deren Information bereits im Git-Verlauf und CHANGELOG konserviert ist.

**Zu löschende Dateien:**
- `PROGRESS.md` (CardDAV v0.45.0 Session-Tracking)

**Vorgehen:**
1. `git rm PROGRESS.md`
2. Keine weiteren Löschungen im Root oder docs/

**Begründung:** PROGRESS.md war ein temporäres Arbeitsdokument für die CardDAV-Implementierung. Alle relevanten Informationen sind in:
- Git-Commits (detaillierte Implementierungsschritte)
- CHANGELOG.md (User-facing Änderungen)
- Archivierte Design-Docs (technische Spezifikation)

### 3. Aktualisierungsstrategie

**Ziel:** BACKLOG.md und CHANGELOG.md auf aktuellen Stand bringen und vereinfachen.

**BACKLOG.md Änderungen:**
1. BL-11 (CardDAV) aus "Open Entries" entfernen - implementiert in v0.45.0
2. "Completed Features" Sektion komplett streichen - CHANGELOG.md ist die autoritäre Quelle
3. Struktur vereinfachen zu:

```markdown
# Backlog

Feature requests and planned extensions. Entries here will **not** be implemented until explicitly prioritized and moved into a release branch.

New suggestion? → [Open an issue](https://github.com/ulsklyc/oikos/issues/new?template=feature_request.md) or add it here.

## Open Entries

| ID | Issue | Feature | Notes |
|----|-------|---------|-------|
| *Currently no open backlog items* | | | |
```

**CHANGELOG.md Änderungen:**
1. Alle Emojis entfernen - durchgehend für alle Versionen
2. Keine inhaltlichen Änderungen - nur Emoji-Bereinigung

### 4. Verbesserungsstrategie (README.md)

**Ziel:** Contacts-Modul-Beschreibung aktualisieren, um CardDAV Multi-Account Sync widerzuspiegeln.

**Aktueller Stand:**
```markdown
| **Notes & Contacts** | Colored sticky notes with Markdown support. Contact directory with vCard import/export. |
```

**Neue Formulierung:**
```markdown
| **Notes & Contacts** | Colored sticky notes with Markdown support. Contact directory with multi-account CardDAV sync (Nextcloud, iCloud, Radicale, Baikal), multiple phones/emails/addresses per contact, and vCard import/export. |
```

**Änderungen:**
- Ergänzt: "multi-account CardDAV sync" mit Provider-Beispielen (konsistent mit Calendar-Zeile)
- Ergänzt: "multiple phones/emails/addresses per contact" (v0.45.0 Feature)
- Behalten: "vCard import/export" (existierendes Feature)
- Keine Emojis

**Keine weiteren README-Änderungen** - restliche Modul-Beschreibungen bleiben unberührt.

### 5. Commit-Strategie

**Ziel:** Vier thematische Commits mit klaren, aussagekräftigen Nachrichten.

**Commit 1: Archivierung**
```
docs: archive implemented plans, specs, and design documents

Move completed implementation plans (2026-04-20 to 2026-05-04),
design specs, and audit documents to docs/archive/ for historical
reference while keeping the main docs/ directory focused on active
documentation.

Archived:
- 11 implementation plans (superpowers/plans/)
- 4 design specs (superpowers/specs/)
- 3 design documents (designs/)
- 5 audit/proposal documents (root level)
```

**Commit 2: Bereinigung**
```
docs: remove session-specific PROGRESS.md

Remove CardDAV v0.45.0 session tracking document. Information is
preserved in git history, CHANGELOG.md, and archived design docs.
```

**Commit 3: Aktualisierung**
```
docs: update BACKLOG and remove emojis from CHANGELOG

- BACKLOG.md: remove BL-11 (implemented in v0.45.0), strip "Completed
  Features" section (CHANGELOG is authoritative source)
- CHANGELOG.md: remove all emojis for consistency
```

**Commit 4: Verbesserung**
```
docs: update README Contacts module description

Reflect v0.45.0 CardDAV multi-account sync and multi-value contact
fields (multiple phones/emails/addresses per contact).
```

## Erfolgskriterien

1. **Archiv erstellt:** `docs/archive/` mit korrekter Struktur existiert
2. **23 Dateien archiviert:** Alle implementierten Pläne/Specs/Designs verschoben
3. **PROGRESS.md entfernt:** Datei existiert nicht mehr im Root
4. **BACKLOG.md vereinfacht:** Nur "Open Entries", keine "Completed Features", BL-11 entfernt
5. **CHANGELOG.md emoji-frei:** Keine Emojis in allen Versionen
6. **README.md aktualisiert:** Contacts-Beschreibung spiegelt v0.45.0 Features wider
7. **4 Commits erstellt:** Jeder mit klarer, thematischer Nachricht
8. **Git-Historie erhalten:** `git mv` verwendet, keine Commits verloren
9. **Keine Emojis hinzugefügt:** Weder in README noch in anderen Dateien

## Nicht-Ziele

- SPEC.md überprüfen oder aktualisieren (separate Aufgabe)
- Weitere README-Sektionen ändern (nur Contacts-Modul)
- docs/installation.md oder andere aktive Docs ändern
- Inhaltliche Änderungen an CHANGELOG.md (nur Emoji-Entfernung)
