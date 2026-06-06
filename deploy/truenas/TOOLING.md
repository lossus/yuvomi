# TrueNAS Catalog — Tooling

Dieses Verzeichnis ist die Source of Truth für die TrueNAS-Community-App von Oikos.
Die ~80 vendored Library-Dateien werden **nicht** hier gepflegt — sie leben im
Fork `ulsklyc/apps` unter `ix-dev/community/oikos/templates/library/`.

## Dateien

- `app.yaml.tmpl` / `ix_values.yaml.tmpl` — Templates; `{{APP_VERSION}}`,
  `{{CATALOG_VERSION}}`, `{{IMAGE_TAG}}` werden vom Generator ersetzt.
- `questions.yaml`, `item.yaml`, `README.md`, `templates/docker-compose.yaml`,
  `templates/test_values/basic-values.yaml` — statisch, werden verbatim kopiert.
- `catalog-version.json` — der einzige persistente Zustand (Catalog-Version).

## Manuell generieren

    npm run truenas:generate -- --bump=patch --out ~/truenas-apps/ix-dev/community/oikos

`--bump` ist `patch` (Default), `minor` oder `major`. Der Lauf schreibt die
Dateien ins `--out`-Verzeichnis (das ein `templates/library/` enthalten muss)
und schreibt `catalog-version.json` fort.

## Automatik

`.github/workflows/truenas-publish.yml` läuft bei jedem `release: published`
(Default `patch`) und kann manuell via `workflow_dispatch` mit `minor`/`major`
ausgelöst werden. Ablauf pro Lauf: die Versionsdateien generieren (Validierung,
Ausgabe nach `/tmp` und damit verworfen) und dabei `catalog-version.json`
fortschreiben, anschließend **nur** `catalog-version.json` zurück nach `main`
committen.

**Kein Fork-Push, kein PR.** Der Workflow pusht nichts nach `truenas/apps` und
öffnet keinen Pull Request. Der offizielle TrueNAS-Bot zieht App-Updates direkt
und eigenständig — eine CI-seitige PR-Erstellung oder ein force-pushter
`community/oikos`-Branch ist nicht (mehr) nötig.

## Voraussetzungen für die Automatik

- `main` darf keine Branch-Protection-Regel haben, die den `github-actions[bot]`
  am direkten Push hindert — sonst schlägt der Rück-Commit der
  `catalog-version.json` fehl.

## Library-Bump (selten)

Wenn TrueNAS eine neue `lib_version` verlangt:
1. Im Fork die neue Library nach `templates/library/base_vX_Y_Z/` vendoren.
2. In `app.yaml.tmpl` `lib_version` und `lib_version_hash` auf die neuen Werte
   setzen (Hash aus `library/hashes.yaml` des TrueNAS-Repos).
3. Generator laufen lassen und das Ergebnis prüfen.
