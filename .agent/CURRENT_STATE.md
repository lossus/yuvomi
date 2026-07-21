# Current State

Datum: 2026-07-21

## Repository

- Branch: `main`
- Lokaler/Fork-Commit: `ebe9a85f7d149868f2afa18ff66a925f051caaa0`
- `main` und `origin/main` sind synchron.
- Working Tree war vor Anlage dieser Agent-Dokumentation sauber.
- Upstream-Ziel für das geplante Update: v1.43.0 bei `d506731fbf2fb628843398c231cde04e67e8e2f4`.

## Aktive Planung

- Die geplante Arbeit ist in `../tasks.md` beschrieben.
- Noch kein Upstream-Integrationsbranch wurde erstellt.
- Noch kein Upstream-Merge, Push, Fork-main-Merge oder Produktionseinsatz wurde begonnen.
- Die Update-Integration und die spätere Architekturhärtung bleiben getrennte Arbeitsblöcke.

## Reviewstatus

- Agent-Governance und Taskplan werden in dieser Änderung angelegt.
- Status: `implemented_by_agent`, externe Review ausstehend.
- Kein Task aus `tasks.md` ist dadurch automatisch zur Implementierung oder Akzeptanz freigegeben.

## Bekannte Hauptrisiken des Updates

- semantisch kollidierende Migrationen trotz automatisch mergbarer `server/db.js`;
- OpenAPI-Wechsel vom Monolith zu Moduldateien;
- Überschneidungen in Shopping, Meals, Router, Service Worker und CSS;
- 23 automatisch mergbare, aber fachlich zu validierende Locale-Dateien;
- Erhalt der Fork-Kitchen-Verträge bei Übernahme der Upstream-UX- und Security-Fixes.
