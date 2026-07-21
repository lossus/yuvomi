# Yuvomi Agent Memory

Dauerhafte, am aktuellen Repository zu verifizierende Fakten für `lossus/yuvomi`.

## Baseline

- Stack: Node.js 22+, Express 5, SQLite/SQLCipher, Vanilla JavaScript mit ES Modules, Plain CSS und eigenes i18n.
- `origin` ist der Fork `lossus/yuvomi`; `upstream` ist das read-only Original `ulsklyc/yuvomi`.
- Der Fork enthält zusätzliche Kitchen-Funktionen: frei sortierbare Einkaufslisten, Shopping-Provenance, strukturierte Mengen, Pantry, Shopping-to-Pantry und Cooking Consumption mit Undo.
- Bestandsänderungen werden über immutable `inventory_movements` und Gegenbewegungen nachvollziehbar gehalten.
- Freie Mengenangaben werden nicht automatisch interpretiert; strukturierte Mengen werden nur bei explizit kompatiblen Einheiten aggregiert oder verbraucht.

## Veröffentlichte Fork-Migrationslineage

| Fork-Version | Bedeutung |
| --- | --- |
| 86 | frei sortierbare Einkaufslisten |
| 87 | Shopping-Item-Provenance |
| 88 | strukturierte Zutaten- und Einkaufs-Mengen |
| 89 | Pantry-Locations, Lots und Inventory Movements |
| 90 | Shopping-to-Pantry-Provenance |
| 91 | Cooking Events und Allocation Snapshots |
| 92 | Upstream-Dokumentverknüpfung, ursprünglich Upstream 86 |
| 93 | Upstream-Ferien-Gruppencode, ursprünglich Upstream 87 |

Diese veröffentlichten Versionen bleiben unverändert. Neue Upstream-Schemaänderungen müssen additiv und lineage-sicher integriert werden.

## Upstream-Update-Baseline

- Letzte vollständig integrierte Upstream-Version im Fork: v1.22.2.
- Geplantes Ziel: Upstream v1.43.0, Commit `d506731fbf2fb628843398c231cde04e67e8e2f4`.
- Das verbindliche Upstream-Runbook liegt unter `docs/development/UPSTREAM_UPDATE_MASTER_PROMPT.md`.
- Kategorien und Einkaufslisten sind getrennte Verträge: Upstream verwaltet Kategorie-Reordering über den gemeinsamen Category Manager; der Fork verwaltet zusätzlich die Reihenfolge ganzer Einkaufslisten.

## Produktionsgrenze

- Produktionsänderungen benötigen Zielverifikation, wiederherstellbares Backup, Rollbackpfad sowie Health-, SQLite- und Datenintegritätsprüfung.
- Konkrete Hosts, Container, Images und Schema-Stände sind zeitabhängig und müssen live verifiziert werden.
