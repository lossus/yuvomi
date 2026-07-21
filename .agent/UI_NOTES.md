# Yuvomi UI and PWA Notes

Diese Verträge sind vor UI-Änderungen gegen aktuellen Code und Tests zu prüfen.

## Grundregeln

- Sichtbare Texte kommen aus i18n; neue Keys müssen in allen unterstützten Locales vorhanden sein.
- Wiederverwendbare Interaktion gehört in gemeinsame Komponenten oder Utilities.
- Touch-, Maus- und Tastaturbedienung müssen zusammen funktionieren.
- Mobile Navigation, Router, Kitchen-Tabs und Service-Worker-Assets müssen bei neuen Seiten gemeinsam aktualisiert werden.
- Nach Frontend-Builds oder Service-Worker-Änderungen mit frischem Reload prüfen, um veraltete PWA-Assets auszuschließen.

## Kitchen-Verträge

- Pantry ist ein eigener Kitchen-Bereich und darf nicht auf das Dashboard zurückfallen.
- Freitextmengen bleiben sichtbar und unverändert.
- Bestandsänderungen erfolgen nur nach expliziter Bestätigung.
- Cooking Preview ist read-only; erst Cook Confirm verändert Bestand.
- Undo stellt Bestand über Gegenbewegungen wieder her.

## Kategorien und Einkaufslisten

- Der gemeinsame Category Manager verwaltet Kategorien für mehrere Module.
- Einkaufslisten besitzen zusätzlich eine unabhängige Reihenfolge und Default-Listen-Logik.
- Drag-and-drop benötigt weiterhin einen tastaturbedienbaren Up/Down-Pfad.
- Bei fehlgeschlagenem Reorder wird die Serverreihenfolge wiederhergestellt und der Fehler sichtbar gemeldet.

## Browserprüfung

- Desktop 1440×900
- Tablet 768×1024
- Mobil 390×844
- Tastaturfokus und Screenreader-Namen
- keine Console-/Page-Errors
- kein horizontaler Überlauf
- Router-Reload und PWA-Navigation für direkt aufgerufene Seiten
