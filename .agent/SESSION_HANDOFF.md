# Yuvomi Session Handoff

Datum: 2026-07-21

## Auftrag

- Upstream v1.43.0 auf wichtige Änderungen und Konflikte prüfen.
- Integrationsplan erstellen.
- eine spätere Änderung planen, die weitere Upstream-Updates vereinfacht.
- die allgemeine Agent-Arbeitsweise aus `lossus/Hostgroup_Manager/.agent` projektspezifisch übernehmen.
- daraus `tasks.md` erstellen.

## Befund

- `origin/main` und lokales `main` stehen auf `ebe9a85f`.
- Upstream v1.43.0 steht auf `d506731f`.
- Ausgangsdivergenz: 46 Fork-only und 145 Upstream-only Commits.
- 48 Dateien wurden auf beiden Linien geändert.
- Eine Merge-Simulation meldete zwölf Textkonflikte.
- Kategorien sind kombinierbar: Upstream-Category-Manager übernehmen, Fork-Einkaufslisten-Reordering erhalten.
- Größtes Risiko sind die unterschiedlich belegten Migrationsnummern 88–93; Git meldet dafür keinen Textkonflikt.
- OpenAPI wurde Upstream modularisiert und sollte als neue Basis verwendet werden.

## In dieser Session geändert

- Root-`AGENTS.md` und Yuvomi-spezifische `.agent`-Governance angelegt.
- `.gitignore` angepasst, damit `AGENTS.md` versioniert werden kann.
- `tasks.md` mit Update- und Härtungs-Tasks angelegt.
- Keine Produktlogik, Migration, Abhängigkeit oder Produktionsumgebung geändert.

## Nächster erlaubter Schritt

Externe Review dieser Dokumentationsänderung. Danach kann der Benutzer genau einen Task aus `tasks.md` freigeben. Empfohlener Start ist `YUV-UP-001`; kein Folgetask beginnt automatisch.
