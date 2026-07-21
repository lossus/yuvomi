# Session 2026-07-21: Agent workflow and upstream tasks

## Auftrag und erwartetes Ergebnis

Die allgemeine Agent-Arbeitsweise aus `lossus/Hostgroup_Manager/.agent` auf Yuvomi übertragen und aus der geprüften v1.43.0-Updateplanung eine verbindliche `tasks.md` erstellen.

## Scope

- Task: Agent-Governance und Taskplanung
- In Scope: Root-Einstieg, `.agent`-Dokumente, Review-Gate, Session-Template, Update- und Wartbarkeits-Tasks
- Nicht im Scope: Produktcode, Upstream-Merge, Push, Fork-main-Merge, Produktion
- Risiko: widersprüchliche oder fachfremde Regeln; versehentlich ignorierte `AGENTS.md`

## Ausgangszustand

- Branch/Commit: `main` bei `ebe9a85f7d149868f2afa18ff66a925f051caaa0`
- Working Tree: vor dieser Dokumentationsänderung sauber
- Remotes/Ziel-SHA: `origin` = Fork, `upstream` = Original; geplantes Ziel `d506731fbf2fb628843398c231cde04e67e8e2f4`

## Evidenz und Integrationsentscheidung

- Die Hostgroup-Quelle enthält ein Root-`AGENTS.md`, feste `.agent`-Lesereihenfolge, Maintenance-Phasen, Review-Gate und Session-Template.
- Hostgroup-spezifische Firewall-, CMDB-, LDAP- und Architekturregeln sind nicht auf Yuvomi übertragbar und wurden nicht kopiert.
- Wiederverwendet wurden Scope-Gate, read-only Diagnose, kleinste kohärente Änderung, risikogerechte Tests, Session-Handoff und Verbot der Selbstakzeptanz.
- Yuvomi-spezifische Fork-/Upstream-, Migration-, Kitchen-, PWA- und Produktionsgrenzen wurden aus aktuellem Code, Git-Historie und bestehendem Upstream-Master-Prompt abgeleitet.

## Änderungen

- Dateien: `.gitignore`, `AGENTS.md`, `.agent/**`, `tasks.md`
- Verhalten: keine Runtime-Änderung
- Daten/Migrationen: keine
- Dokumentation: vollständige Agent-Governance und sequenzierte Taskliste

## Verifikation

- `git diff --check`: bestanden
- Relative Markdown-Linkziele: vollständig vorhanden
- `git check-ignore`: `AGENTS.md`, `.agent/README.md` und `tasks.md` sind nicht ignoriert
- Fremdprojektreste: nur die beabsichtigte Quellenreferenz in `SESSION_HANDOFF.md`
- Externe Systeme gemockt: nicht zutreffend; GitHub-Inhalte wurden read-only gelesen
- Verbleibende Risiken: Inhalt benötigt externe Review; keine Taskimplementierung wurde freigegeben

## Handoff

- Status: `implemented_by_agent`
- Dauerhafte Fakten überführt nach: `.agent/MEMORY.md`, `.agent/DECISIONS.md`, `.agent/ARCHITECTURE.md`
- Externe Review erforderlich: ja
- Nächster empfohlener Task: `YUV-UP-001`
- Nächster Task ausdrücklich freigegeben: nein
