# Yuvomi Durable Decisions

## Fork und Upstream

- `origin` ist das einzige reguläre Schreibziel.
- `upstream` bleibt read-only.
- Upstream-Updates verwenden einen festen SHA und einen `integration/upstream-*`-Branch.
- Ein getesteter Integrationsbranch wird nicht ohne ausdrückliche Freigabe nach Fork-`main` gemergt oder produktiv ausgerollt.

## Daten und Migrationen

- Veröffentlichte Fork-Migrationen 86–93 sind unveränderliche Lineage.
- Gleich nummerierte Upstream-Migrationen werden nicht als bereits angewendet betrachtet, wenn ihr Inhalt abweicht.
- Frische Datenbanken und Upgrades vom produktiven Fork-Schema sind beide unterstützte Pfade.
- Destruktive Rebuilds oder die Unterstützung separat upstream-migrierter Kollisionsdatenbanken benötigen eine eigene Architekturentscheidung.

## Kitchen

- Ein normales Abhaken eines Einkaufsartikels erzeugt keinen Bestand.
- Shopping-to-Pantry ist eine ausdrückliche, berechtigungsgeprüfte und atomare Aktion.
- Cooking Consumption nutzt Vorschau, explizite Allokationen, immutable Snapshots und gegenbuchendes Undo.
- Freitext bleibt erhalten und wird nicht still in strukturierte Mengen umgewandelt.
- Cross-Domain-Schreibvorgänge bleiben transaktional und idempotent, wo ein Wiederholungsrisiko besteht.

## Kategorien

- Kategorie-Reordering und Einkaufslisten-Reordering sind getrennte Funktionen.
- Für Kategorien soll der gemeinsame Upstream-Category-Manager die UI-Basis bilden.
- Die Fork-Reihenfolge ganzer Einkaufslisten bleibt als eigener API- und Datenbankvertrag erhalten.

## Wartbarkeit

- Das v1.43.0-Update und die spätere Entkopplung von Fork-Erweiterungen werden auf getrennten Branches umgesetzt und separat geprüft.
- Neue Fork-Funktionalität soll bevorzugt in eigenen Services, Komponenten, Styles, OpenAPI-Fragmenten und Registries liegen statt in Upstream-Hotspots.
