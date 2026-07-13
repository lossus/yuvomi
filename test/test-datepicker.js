/**
 * Modul: yuvomi-datepicker-Test
 * Zweck: Sichert Struktur, Invarianten und ISO-Wertkontrakt des gemeinsamen
 *        Datum-/Zeit-Components sowie die i18n-Vollständigkeit über alle Locales.
 * Ausführen: node test/test-datepicker.js
 *
 * Ansatz wie test-category-manager.js: Quelltext-Analyse (kein DOM im Node-Lauf)
 * + Locale-Abgleich gegen die deutsche Referenz.
 */
import { readFileSync, readdirSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}: ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion fehlgeschlagen'); }

console.log('\n[yuvomi-datepicker-Test]\n');

const comp = readFileSync(new URL('../public/components/datepicker.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/styles/datepicker.css', import.meta.url), 'utf8');

// ── Struktur & Registrierung ────────────────────────────────────────────
test('Definiert das Custom Element yuvomi-datepicker', () => {
  assert(/customElements\.define\(\s*'yuvomi-datepicker'/.test(comp), 'Tag-Name muss yuvomi-datepicker sein');
});
test('Registrierung ist idempotent (guard gegen Doppel-Define)', () => {
  assert(/if\s*\(\s*!customElements\.get\(\s*'yuvomi-datepicker'\s*\)\s*\)/.test(comp), 'Define muss geguardet sein');
});
test('Ist form-associated (ElementInternals)', () => {
  assert(/static\s+formAssociated\s*=\s*true/.test(comp), 'formAssociated muss true sein');
  assert(/attachInternals/.test(comp), 'attachInternals muss genutzt werden');
  assert(/setFormValue\(/.test(comp), 'setFormValue muss den Wert an das Formular spiegeln');
});

// ── ISO-Wertkontrakt ────────────────────────────────────────────────────
test('Exponiert value get/set', () => {
  assert(/get value\(\)/.test(comp), 'value-Getter fehlt');
  assert(/set value\(/.test(comp), 'value-Setter fehlt');
});
test('datetime kombiniert Datum und Zeit als YYYY-MM-DDTHH:MM', () => {
  assert(/\$\{d\}T\$\{tm\}/.test(comp), 'datetime-Getter muss d+T+time zusammensetzen');
  assert(/raw\.split\('T'\)/.test(comp), 'datetime-Setter muss auf T splitten');
});
test('Nutzt die zentralen i18n-Parser/Formatter (kein eigenes Datumsparsing)', () => {
  assert(/parseDateInput/.test(comp) && /parseTimeInput/.test(comp), 'Muss parseDateInput/parseTimeInput nutzen');
  assert(/formatDateInput/.test(comp) && /formatTimeInput/.test(comp), 'Muss formatDateInput/formatTimeInput nutzen');
});

// ── Interaktion & Plattform ─────────────────────────────────────────────
test('Öffnet Popover über die native Popover-API (Top-Layer)', () => {
  assert(/setAttribute\('popover'/.test(comp), 'Muss popover-Attribut setzen');
  assert(/showPopover\(\)/.test(comp) && /hidePopover\(\)/.test(comp), 'show/hidePopover nötig');
});
test('Öffnet den Microkalender auch auf Touch und nutzt native Sheets nur für Zeiten', () => {
  assert(/pointer:\s*coarse/.test(comp), 'Coarse-Pointer-Erkennung nötig');
  assert(/showPicker\(\)/.test(comp), 'showPicker() für native Sheets nötig');
  assert(/sub\.kind\s*===\s*'time'\s*&&\s*coarse\s*&&\s*this\._openNative\(sub\)/.test(comp),
    'Nur die Zeit-Auswahl darf auf Touch den nativen Picker öffnen');
  assert(/this\._openPopover\(sub\)/.test(comp), 'Datums-Auswahl muss auf Touch zum gemeinsamen Popover durchfallen');
});
test('Kalenderraster ist Montag-first', () => {
  assert(/Montag\s*=\s*0/.test(comp) || /getDay\(\)\s*-\s*1/.test(comp), 'Montag-first-Offset nötig');
});
test('Kalenderraster unterstützt Arrow, Home, End und Monatswechsel per Tastatur', () => {
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']) {
    assert(comp.includes(key), `${key}-Behandlung fehlt`);
  }
  assert(/e\.key\s*===\s*'Home'\s*\?\s*-weekday\s*:\s*6\s*-\s*weekday/.test(comp),
    'Home/End müssen Montag-basiert zum Wochenanfang/-ende navigieren');
});
test('Tagesbuttons bleiben native Buttons für Enter und Touch-Klick', () => {
  assert(/btn\.type\s*=\s*'button'/.test(comp), 'Tage müssen native Buttons sein');
  assert(/btn\.addEventListener\('click'/.test(comp), 'Tage brauchen den gemeinsamen Klick-/Touch-Pfad');
});
test('Wochentags-/Monatsnamen kommen aus Intl (keine eigenen Locale-Keys)', () => {
  assert(/Intl\.DateTimeFormat/.test(comp), 'Intl muss für Labels genutzt werden');
});

// ── Sicherheit & Sauberkeit ─────────────────────────────────────────────
test('Nutzt kein innerHTML', () => {
  assert(!/\.innerHTML/.test(comp), 'innerHTML ist verboten (PostToolUse-Hook)');
});
test('Escaped dynamische Werte via esc()', () => {
  assert(/import \{[^}]*esc[^}]*\} from '\/utils\/html\.js'/.test(comp), 'esc muss importiert werden');
  assert(/esc\(/.test(comp), 'esc muss verwendet werden');
});
test('Räumt Popover in disconnectedCallback auf', () => {
  assert(/disconnectedCallback\s*\(\)\s*\{[\s\S]*?_popover/.test(comp), 'Popover-Cleanup nötig');
});
test('Räumt globale Listener beim Schließen wieder ab', () => {
  assert(/removeEventListener\('pointerdown'/.test(comp), 'Doc-pointerdown-Listener muss abgeräumt werden');
});

// ── A11y ────────────────────────────────────────────────────────────────
test('Adoptiert zugehöriges <label> als Aria-Namen', () => {
  assert(/label\[for=/.test(comp), 'label[for] muss berücksichtigt werden');
  assert(/closest\('label'\)/.test(comp), 'umschließendes <label> muss berücksichtigt werden');
});
test('Trigger trägt ein aria-label', () => {
  assert(/aria-label="\$\{esc\(triggerLabel\)\}"/.test(comp), 'Trigger braucht aria-label');
});

// ── CSS: nur Tokens, kein Hardcoding von Farben ─────────────────────────
test('CSS nutzt Tokens (--active-module-accent Fallback)', () => {
  assert(/var\(--active-module-accent,\s*var\(--color-accent\)\)/.test(css), 'Modul-Akzent mit Fallback nötig');
});
test('CSS respektiert prefers-reduced-motion', () => {
  assert(/@media \(prefers-reduced-motion: reduce\)/.test(css), 'Reduced-Motion-Alternative nötig');
});
test('Popover bleibt vollständig innerhalb kleiner Viewports', () => {
  assert(/box-sizing:\s*border-box/.test(css), 'Viewport-Breite muss inklusive Padding gelten');
  assert(/width:\s*min\(340px,\s*calc\(100vw\s*-\s*16px\)\)/.test(css), 'Breite muss am kleinen Viewport geklemmt sein');
  assert(/max-height:\s*calc\(100dvh\s*-\s*16px\)/.test(css), 'Höhe muss am dynamischen Viewport geklemmt sein');
  assert(/overflow-y:\s*auto/.test(css) && /overscroll-behavior:\s*contain/.test(css),
    'Kleine Querformat-Viewports brauchen internes, begrenztes Scrollen');
});
test('CSS enthält keine Hex-Farben (nur Tokens)', () => {
  const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g);
  assert(!hex, `Hex-Farben gefunden: ${hex && hex.join(', ')}`);
});

// ── i18n-Vollständigkeit über alle Locales ──────────────────────────────
const localesDir = new URL('../public/locales/', import.meta.url);
const localeFiles = readdirSync(localesDir).filter((f) => f.endsWith('.json'));
const REQUIRED_KEYS = ['openCalendar', 'openTimePicker', 'previousMonth', 'nextMonth', 'today', 'clear'];

test(`Alle ${localeFiles.length} Locales haben den datepicker-Namespace`, () => {
  assert(localeFiles.length === 23, `Erwartet 23 Locale-Dateien, gefunden ${localeFiles.length}`);
  for (const file of localeFiles) {
    const json = JSON.parse(readFileSync(new URL(file, localesDir), 'utf8'));
    assert(json.datepicker, `${file}: datepicker-Namespace fehlt`);
    for (const key of REQUIRED_KEYS) {
      assert(typeof json.datepicker[key] === 'string' && json.datepicker[key].trim(),
        `${file}: datepicker.${key} fehlt oder leer`);
    }
  }
});

test('Keine Locale hat überschüssige datepicker-Keys', () => {
  for (const file of localeFiles) {
    const json = JSON.parse(readFileSync(new URL(file, localesDir), 'utf8'));
    const extra = Object.keys(json.datepicker).filter((k) => !REQUIRED_KEYS.includes(k));
    assert(extra.length === 0, `${file}: unerwartete Keys ${extra.join(', ')}`);
  }
});

console.log(`\n  ${passed} bestanden, ${failed} fehlgeschlagen\n`);
process.exit(failed > 0 ? 1 : 0);
