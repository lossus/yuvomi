# Yuvomi Agent Instructions

Diese Regeln gelten für das gesamte Repository.

## Verbindlicher Einstieg

1. Lies vollständig [`.agent/README.md`](.agent/README.md).
2. Folge der dort festgelegten Lesereihenfolge.
3. Prüfe aktuellen Code und Tests als Implementierungsbeleg.
4. Melde Widersprüche zwischen Auftrag, Code, Tests und Dokumentation vor einer Änderung.
5. Bearbeite nur den ausdrücklich ausgewählten Task aus [`tasks.md`](tasks.md). Beginne keinen Folgetask automatisch.

## Repository- und Git-Grenzen

- `origin` ist der Benutzer-Fork `lossus/yuvomi`.
- `upstream` ist das Originalprojekt `ulsklyc/yuvomi` und strikt read-only.
- Kein Push, Pull Request oder anderer Schreibvorgang gegen `upstream`.
- Keine direkte Integrationsarbeit auf `main`; verwende einen aufgabenspezifischen Branch.
- Kein Rebase oder Force-Push für veröffentlichte Fork-Historie.
- Bestehende Benutzeränderungen erhalten; keine destruktiven Git-Kommandos.
- Ein Merge nach Fork-`main`, Push oder Produktionseinsatz benötigt eine ausdrückliche Benutzerfreigabe.

## Harte fachliche Grenzen

- Veröffentlichte Migrationen werden niemals nachträglich geändert oder neu nummeriert.
- Migrationen aus Fork und Upstream müssen anhand Inhalt und Lineage geprüft werden; eine konfliktfreie Git-Zusammenführung reicht nicht.
- Pantry-Bestandsänderungen bleiben journalbasiert, atomar und reversibel.
- Shopping-to-Pantry und Cooking dürfen keine implizite Mengeninterpretation einführen.
- Berechtigungen, Scopes, OpenAPI, MCP, Router, Service Worker und alle Locale-Keysets müssen bei Cross-Domain-Änderungen gemeinsam geprüft werden.
- Tests verwenden temporäre oder In-Memory-Datenbanken. Die lokale `yuvomi.db` darf nicht verändert oder gelöscht werden.
- Keine Secrets, Tokens, Passwörter, OIDC-Daten oder produktiven Konfigurationswerte ausgeben oder dokumentieren.
- Kein produktiver Deploy und keine produktive Migration ohne verifizierten Zielhost, wiederherstellbares Backup und anschließende Integritätsprüfung.

## Arbeits- und Review-Regel

- NO AUTOPILOT: Scope, Nicht-Scope, Risiko und Verifikation vor dem ersten Edit festhalten.
- Die kleinste kohärente Änderung umsetzen und vorhandene Muster wiederverwenden.
- Fokussierte Tests zuerst, danach breitere Tests proportional zum Risiko.
- Die implementierende Instanz darf ihre eigene Arbeit nicht als `accepted` markieren.
- Externe Review und Benutzerfreigabe bestimmen, ob ein Task akzeptiert ist und ob der nächste Task beginnen darf.

## Session-Dokumentation

Für Feature-, Repair-, Integrations- und Architektur-Sessions das Skelett unter [`.agent/memory/`](.agent/memory/) verwenden. Dauerhafte Fakten anschließend in `.agent/MEMORY.md`, Entscheidungen in `.agent/DECISIONS.md` und Code-Landkarten in `.agent/ARCHITECTURE.md` überführen. `CURRENT_STATE.md` und `SESSION_HANDOFF.md` müssen den tatsächlich erreichten Stand wiedergeben.
