# Yuvomi Architecture and Code Map

Diese Landkarte beschleunigt die Orientierung. Aktueller Code und Tests bleiben die maßgebliche Implementierungsevidenz.

## Stack

- Backend: Node.js, Express, ES Modules
- Datenbank: SQLite/SQLCipher über `server/db.js`
- Frontend: Vanilla JavaScript, Web Components, Plain CSS
- PWA: `public/sw.js`, Router und statische Assets unter `public/`
- API-Dokumentation: OpenAPI unter `server/openapi*`
- Tests: Node-Testskripte unter `test/`, teilweise mit Browser-Loader oder Puppeteer

## Code-Landkarte

| Bereich | Einstieg | Typische Folgedateien |
| --- | --- | --- |
| App-Start und Scheduler | `server/index.js` | Auth, Router, Services, Timer |
| Datenbank und Migrationen | `server/db.js` | `server/db-schema-test.js`, `test/test-db.js` |
| API-Routen | `server/routes/` | Services, Permissions, OpenAPI |
| Kitchen-Services | `server/services/ingredient-quantities.js`, `shopping-item-sources.js`, `meal-shopping-import.js`, `inventory.js`, `meal-cooking.js` | Shopping-, Meals-, Recipes- und Pantry-Routen |
| Frontend-Seiten | `public/pages/` | Komponenten, API-Client, CSS, i18n |
| Navigation | `public/router.js` | Kitchen-Tabs, Einstellungen, Berechtigungen |
| Kategorien | `public/components/category-manager.js` | Category-Routen und `category-manager-changed` |
| PWA/Offline | `public/sw.js` | Assetlisten, API-Cache-Regeln, Offline-Seite |
| Übersetzungen | `public/i18n.js`, `public/locales/*.json` | Locale-Paritätstests |
| OpenAPI/MCP | `server/openapi*`, MCP-Routen/Tests | Scopes und State-changing-Markierung |

## Kritische Datenflüsse

### Shopping-to-Pantry

```text
Shopping UI
→ POST /shopping/items/:id/to-pantry
→ Berechtigungen für Shopping und Pantry
→ atomare Lot-/Bestandsänderung
→ immutable Inventory Movement mit Shopping-Provenance
→ explizites gegenbuchendes Undo
```

### Cooking Consumption

```text
Meals UI
→ read-only Cook Preview
→ manuell bestätigte Lot-Allokationen
→ atomarer Cooking Event mit Snapshots und Inventory Movements
→ optionale Missing-to-Shopping-Ergänzung
→ gegenbuchendes Undo
```

### Upstream-Integration

```text
fester Upstream-SHA
→ Divergenz- und Overlap-Audit
→ Migration-Lineage-Tabelle
→ Integrationsbranch und konfliktbewusster Merge
→ fokussierte Tests
→ vollständige Suite und Browsermatrix
→ Branch-Push
→ externe Review
→ freigegebener Fork-main-Merge
```
