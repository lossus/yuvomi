import { unfoldLines, unescapeICSText, parseICS, parseVTODO, expandRRULE } from '../server/services/ics-parser.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}: ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

console.log('\n[ICS-Parser-Test]\n');

test('unfoldLines entfaltet Zeilenfortsetzungen', () => {
  const result = unfoldLines('SUMMARY:Hallo\r\n Welt');
  assert(result === 'SUMMARY:HalloWelt', `got: ${result}`);
});

test('parseICS: einfaches Ganztags-Event', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:test-1@x\r\nSUMMARY:Geburtstag\r\nDTSTART;VALUE=DATE:20260501\r\nDTEND;VALUE=DATE:20260502\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const events = parseICS(ics);
  assert(events.length === 1, `expected 1, got ${events.length}`);
  assert(events[0].uid === 'test-1@x', 'uid');
  assert(events[0].dtstart === '2026-05-01', `dtstart: ${events[0].dtstart}`);
  assert(events[0].dtend   === '2026-05-01', `dtend: ${events[0].dtend}`);
  assert(events[0].allDay  === true, 'allDay');
});

test('parseICS: Event ohne UID wird übersprungen', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Ohne UID\r\nDTSTART:20260601T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR';
  assert(parseICS(ics).length === 0, 'should skip event without UID');
});

test('parseICS: UTC datetime', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:utc@x\r\nSUMMARY:Meeting\r\nDTSTART:20260615T140000Z\r\nDTEND:20260615T150000Z\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const [ev] = parseICS(ics);
  assert(ev.dtstart === '2026-06-15T14:00:00Z', `dtstart: ${ev.dtstart}`);
  assert(ev.allDay  === false, 'allDay');
});

test('expandRRULE: WEEKLY 3-Wochen-Fenster', () => {
  const vevent = {
    uid: 'weekly@x', summary: 'Wöchentlich', description: null, location: null,
    dtstart: '2026-04-13', dtend: '2026-04-13', rrule: 'RRULE:FREQ=WEEKLY;BYDAY=MO', allDay: true,
  };
  const occ = expandRRULE(vevent, '2026-04-13', '2026-05-04');
  assert(occ.length >= 3, `expected >=3, got ${occ.length}`);
  assert(occ[0].uid === 'weekly@x__2026-04-13', `uid: ${occ[0].uid}`);
  assert(occ[0].rrule === null, 'expanded events have null rrule');
});

test('unescapeICSText: unescapes special sequences', () => {
  assert(unescapeICSText('Main Street\\, London') === 'Main Street, London', 'comma');
  assert(unescapeICSText('Notes\\;Details') === 'Notes;Details', 'semicolon');
  assert(unescapeICSText('Line1\\nLine2') === 'Line1\nLine2', 'newline');
  assert(unescapeICSText('C:\\\\path') === 'C:\\path', 'backslash');
  assert(unescapeICSText(null) === null, 'null passthrough');
});

test('parseICS: unescape text fields', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:esc@x\r\nSUMMARY:Dinner\\, Party\r\nLOCATION:Main St\\, City\r\nDTSTART:20260615T180000Z\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const [ev] = parseICS(ics);
  assert(ev.summary === 'Dinner, Party', `summary: ${ev.summary}`);
  assert(ev.location === 'Main St, City', `location: ${ev.location}`);
});

test('expandRRULE: null rrule → leeres Array', () => {
  const v = { uid: 'x', summary: 'x', description: null, location: null,
              dtstart: '2026-04-20', dtend: null, rrule: null, allDay: true };
  assert(expandRRULE(v, '2026-01-01', '2026-12-31').length === 0);
});

// --------------------------------------------------------
// parseVTODO (Apple Reminders / CalDAV VTODO components)
// --------------------------------------------------------

test('parseVTODO: einfacher offener Reminder', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nUID:todo-1@x\r\nSUMMARY:Milch kaufen\r\nEND:VTODO\r\nEND:VCALENDAR';
  const todos = parseVTODO(ics);
  assert(todos.length === 1, `expected 1, got ${todos.length}`);
  assert(todos[0].uid === 'todo-1@x', 'uid');
  assert(todos[0].summary === 'Milch kaufen', `summary: ${todos[0].summary}`);
  assert(todos[0].completed === false, 'completed should default false');
  assert(todos[0].due === null, 'due should be null');
  assert(todos[0].priority === null, 'priority should be null');
});

test('parseVTODO: STATUS:COMPLETED markiert als erledigt', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nUID:todo-2@x\r\nSUMMARY:Erledigt\r\nSTATUS:COMPLETED\r\nCOMPLETED:20260601T120000Z\r\nEND:VTODO\r\nEND:VCALENDAR';
  const [t] = parseVTODO(ics);
  assert(t.completed === true, 'completed should be true');
  assert(t.status === 'completed', `status: ${t.status}`);
});

test('parseVTODO: COMPLETED-Zeitstempel ohne STATUS gilt als erledigt', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nUID:todo-3@x\r\nSUMMARY:Fertig\r\nCOMPLETED:20260601T120000Z\r\nEND:VTODO\r\nEND:VCALENDAR';
  const [t] = parseVTODO(ics);
  assert(t.completed === true, 'completed should be true');
});

test('parseVTODO: DUE als reines Datum', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nUID:todo-4@x\r\nSUMMARY:Termin\r\nDUE;VALUE=DATE:20260701\r\nEND:VTODO\r\nEND:VCALENDAR';
  const [t] = parseVTODO(ics);
  assert(t.due === '2026-07-01', `due: ${t.due}`);
});

test('parseVTODO: DUE mit UTC-Zeit', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nUID:todo-5@x\r\nSUMMARY:Anruf\r\nDUE:20260701T143000Z\r\nEND:VTODO\r\nEND:VCALENDAR';
  const [t] = parseVTODO(ics);
  assert(t.due === '2026-07-01T14:30:00Z', `due: ${t.due}`);
});

test('parseVTODO: PRIORITY wird als Zahl gelesen, 0 → null', () => {
  const ics1 = 'BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nUID:p1@x\r\nSUMMARY:Wichtig\r\nPRIORITY:1\r\nEND:VTODO\r\nEND:VCALENDAR';
  assert(parseVTODO(ics1)[0].priority === 1, 'priority 1');
  const ics0 = 'BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nUID:p0@x\r\nSUMMARY:Egal\r\nPRIORITY:0\r\nEND:VTODO\r\nEND:VCALENDAR';
  assert(parseVTODO(ics0)[0].priority === null, 'priority 0 → null');
});

test('parseVTODO: VTODO ohne UID wird übersprungen', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nSUMMARY:Ohne UID\r\nEND:VTODO\r\nEND:VCALENDAR';
  assert(parseVTODO(ics).length === 0, 'should skip VTODO without UID');
});

test('parseVTODO: unescape von Summary und Description', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nUID:esc@x\r\nSUMMARY:Eier\\, Mehl\r\nDESCRIPTION:Zeile1\\nZeile2\r\nEND:VTODO\r\nEND:VCALENDAR';
  const [t] = parseVTODO(ics);
  assert(t.summary === 'Eier, Mehl', `summary: ${t.summary}`);
  assert(t.description === 'Zeile1\nZeile2', `description: ${t.description}`);
});

test('parseVTODO: mehrere VTODOs in einer Collection', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nUID:a@x\r\nSUMMARY:A\r\nEND:VTODO\r\nBEGIN:VTODO\r\nUID:b@x\r\nSUMMARY:B\r\nEND:VTODO\r\nEND:VCALENDAR';
  const todos = parseVTODO(ics);
  assert(todos.length === 2, `expected 2, got ${todos.length}`);
});

test('parseVTODO: ignoriert VEVENT-Komponenten', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:ev@x\r\nSUMMARY:Event\r\nDTSTART:20260615T140000Z\r\nEND:VEVENT\r\nEND:VCALENDAR';
  assert(parseVTODO(ics).length === 0, 'should not parse VEVENT as VTODO');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
