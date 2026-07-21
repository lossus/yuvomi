# Review Gate

Die implementierende Agent-Instanz ist nicht die letzte Instanz für die Akzeptanz ihrer eigenen Arbeit.

## Statuswerte

```text
planned               definiert, nicht begonnen
in_progress           ausdrücklich freigegeben und in Bearbeitung
implemented_by_agent  Code, Tests und Dokumentation übergeben
merged                in Fork-main integriert
reviewed              extern gegen Scope und Evidenz geprüft
accepted              vom externen Review als Baseline freigegeben
needs_followup        nutzbar, aber mit erforderlicher Folgearbeit
rejected              vor Fortschritt zurückzunehmen oder zu überarbeiten
```

## Die implementierende Instanz darf

- einen ausdrücklich freigegebenen Task implementieren;
- fokussierte und vollständige Tests ausführen;
- Agent-Dokumentation aktualisieren;
- die Arbeit als `implemented_by_agent` dokumentieren;
- einen nächsten Task empfehlen.

## Die implementierende Instanz darf nicht

- ihre eigene Arbeit als `accepted` markieren;
- ohne Freigabe den nächsten Task beginnen;
- Scope still erweitern;
- `upstream` beschreiben;
- Merge, Push oder Produktionseinsatz als automatisch freigegeben behandeln;
- Dokumentation als alleinigen Sicherheitsbeleg verwenden.

## Externe Review-Checkliste

```text
Task und geänderte Dateien stimmen überein
Nicht-Scope wurde nicht implementiert
Fork- und Upstream-Grenzen wurden eingehalten
Migrationen und Upgradepfade sind nachvollziehbar
Tests sind vorhanden, aussagekräftig und tatsächlich ausgeführt
kritische Codepfade wurden direkt geprüft
keine Secrets oder produktiven Daten offengelegt
Dokumentation und Handoff sind aktuell
bekannte Findings sind festgehalten
nächster Task wurde nicht automatisch begonnen
```

Akzeptanz wird in `ACCEPTANCE_LOG.md` dokumentiert.
