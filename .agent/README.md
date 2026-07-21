# Yuvomi Coding Agent Entry Point

Dieses Verzeichnis ist der verbindliche Einstieg für Agenten, die Yuvomi analysieren, reparieren, erweitern, aus Upstream aktualisieren oder für den Homelab-Einsatz vorbereiten.

## Pflichtlektüre

1. Root [`../AGENTS.md`](../AGENTS.md)
2. [`MEMORY.md`](MEMORY.md)
3. [`CURRENT_STATE.md`](CURRENT_STATE.md)
4. [`SESSION_HANDOFF.md`](SESSION_HANDOFF.md)
5. [`../tasks.md`](../tasks.md)
6. [`MAINTENANCE.md`](MAINTENANCE.md)
7. [`DECISIONS.md`](DECISIONS.md)
8. Aufgabenspezifische Abschnitte in [`ARCHITECTURE.md`](ARCHITECTURE.md) und [`UI_NOTES.md`](UI_NOTES.md)
9. Bei Upstream-Arbeit vollständig [`../docs/development/UPSTREAM_UPDATE_MASTER_PROMPT.md`](../docs/development/UPSTREAM_UPDATE_MASTER_PROMPT.md)
10. Aktueller Code, Git-Historie und fokussierte Tests

## Dokumentenlandkarte

| Bedarf | Dokument |
| --- | --- |
| Dauerhafte Fakten und Fork-Invarianten | [`MEMORY.md`](MEMORY.md) |
| Aktueller Branch-, Review- und Arbeitsstand | [`CURRENT_STATE.md`](CURRENT_STATE.md) |
| Letzte Übergabe und nächster erlaubter Schritt | [`SESSION_HANDOFF.md`](SESSION_HANDOFF.md) |
| Verbindlicher Diagnose-/Änderungsablauf | [`MAINTENANCE.md`](MAINTENANCE.md) |
| Architektur und Code-Landkarte | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Dauerhafte Entscheidungen | [`DECISIONS.md`](DECISIONS.md) |
| UI-, PWA- und Browser-Verträge | [`UI_NOTES.md`](UI_NOTES.md) |
| Geplante und freizugebende Arbeit | [`../tasks.md`](../tasks.md) |
| Review- und Akzeptanzregeln | [`REVIEW_GATE.md`](REVIEW_GATE.md) |
| Extern akzeptierte Arbeit | [`ACCEPTANCE_LOG.md`](ACCEPTANCE_LOG.md) |
| Neue Session-Notiz | [`memory/SESSION_TEMPLATE.md`](memory/SESSION_TEMPLATE.md) |

## Priorität bei Widersprüchen

1. Expliziter Benutzerauftrag und Root-`AGENTS.md`
2. Aktueller Code und ausführbare Tests
3. `CURRENT_STATE.md` und `SESSION_HANDOFF.md`
4. Dauerhafte Entscheidungen und Architektur
5. Historische Session-Notizen

Widersprüche werden vor Änderungen benannt und anhand von Repository-Evidenz aufgelöst.

## Verbindliches Ausführungsmuster

1. Repository, Remotes, Branch und Working Tree prüfen.
2. Genau einen freigegebenen Task auswählen.
3. Ziel, Scope, Nicht-Scope, Risiken und Prüfkriterien festhalten.
4. Datenfluss und bestehende Verträge vollständig nachvollziehen.
5. Kleinste kohärente Änderung implementieren.
6. Fokussierte und risikogerechte breite Tests ausführen.
7. Session-Notiz, Handoff und betroffene dauerhafte Dokumentation aktualisieren.
8. Arbeit als `implemented_by_agent`, nicht als `accepted`, übergeben.
9. Vor Merge, Push, Deploy oder Folgetask die jeweils erforderliche Freigabe einholen.
