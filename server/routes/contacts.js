/**
 * Modul: Kontakte (Contacts)
 * Zweck: REST-API-Routen für wichtige Familienkontakte
 * Abhängigkeiten: express, server/db.js, server/auth.js
 */

import { createLogger } from '../logger.js';
import express from 'express';
import * as db from '../db.js';
import { str, oneOf, collectErrors, MAX_TITLE, MAX_TEXT, MAX_SHORT } from '../middleware/validate.js';

const log = createLogger('Contacts');

const router  = express.Router();

const VALID_CATEGORIES = ['Arzt', 'Schule/Kita', 'Behörde', 'Versicherung',
                           'Handwerker', 'Notfall', 'Sonstiges'];

/**
 * Loads multi-value fields (phones, emails, addresses) for a contact.
 * @param {number} contactId - Contact ID
 * @returns {{ phones: Array, emails: Array, addresses: Array }}
 */
function loadMultiValueFields(contactId) {
  const phones = db.get().prepare(`
    SELECT id, label, value, is_primary FROM contact_phones
    WHERE contact_id = ?
    ORDER BY is_primary DESC, id ASC
  `).all(contactId).map(p => ({
    id: p.id,
    label: p.label,
    value: p.value,
    isPrimary: p.is_primary === 1
  }));

  const emails = db.get().prepare(`
    SELECT id, label, value, is_primary FROM contact_emails
    WHERE contact_id = ?
    ORDER BY is_primary DESC, id ASC
  `).all(contactId).map(e => ({
    id: e.id,
    label: e.label,
    value: e.value,
    isPrimary: e.is_primary === 1
  }));

  const addresses = db.get().prepare(`
    SELECT id, label, street, city, state, postal_code, country, is_primary
    FROM contact_addresses
    WHERE contact_id = ?
    ORDER BY is_primary DESC, id ASC
  `).all(contactId).map(a => ({
    id: a.id,
    label: a.label,
    street: a.street,
    city: a.city,
    state: a.state,
    postalCode: a.postal_code,
    country: a.country,
    isPrimary: a.is_primary === 1
  }));

  return { phones, emails, addresses };
}

/**
 * Validates phones array for multi-value contact fields.
 * @param {Array} phones - Array of { label, value, isPrimary? }
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePhones(phones) {
  if (!Array.isArray(phones)) return { valid: false, error: 'Phones must be an array' };
  if (phones.length > 20) return { valid: false, error: 'Too many phone entries (max 20)' };
  for (const p of phones) {
    if (!p || typeof p !== 'object') return { valid: false, error: 'Phone entry must be an object' };
    if (!p.label || !p.value) return { valid: false, error: 'Phone requires label and value' };
    if (typeof p.label !== 'string' || p.label.trim().length === 0 || p.label.length > 50) {
      return { valid: false, error: 'Phone label invalid or too long' };
    }
    if (typeof p.value !== 'string' || p.value.trim().length === 0 || p.value.length > 50) {
      return { valid: false, error: 'Phone value invalid or too long' };
    }
    if (p.isPrimary !== undefined && typeof p.isPrimary !== 'boolean') {
      return { valid: false, error: 'Phone isPrimary must be boolean' };
    }
  }
  return { valid: true };
}

/**
 * Validates emails array for multi-value contact fields.
 * @param {Array} emails - Array of { label, value, isPrimary? }
 * @returns {{ valid: boolean, error?: string }}
 */
function validateEmails(emails) {
  if (!Array.isArray(emails)) return { valid: false, error: 'Emails must be an array' };
  if (emails.length > 20) return { valid: false, error: 'Too many email entries (max 20)' };
  for (const e of emails) {
    if (!e || typeof e !== 'object') return { valid: false, error: 'Email entry must be an object' };
    if (!e.label || !e.value) return { valid: false, error: 'Email requires label and value' };
    if (typeof e.label !== 'string' || e.label.trim().length === 0 || e.label.length > 50) {
      return { valid: false, error: 'Email label invalid or too long' };
    }
    if (typeof e.value !== 'string' || e.value.trim().length === 0 || e.value.length > 255) {
      return { valid: false, error: 'Email value invalid or too long' };
    }
    if (!/^.+@.+$/.test(e.value)) {
      return { valid: false, error: 'Email value must be a valid email address' };
    }
    if (e.isPrimary !== undefined && typeof e.isPrimary !== 'boolean') {
      return { valid: false, error: 'Email isPrimary must be boolean' };
    }
  }
  return { valid: true };
}

/**
 * Validates addresses array for multi-value contact fields.
 * @param {Array} addresses - Array of { label, street?, city?, state?, postalCode?, country?, isPrimary? }
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAddresses(addresses) {
  if (!Array.isArray(addresses)) return { valid: false, error: 'Addresses must be an array' };
  if (addresses.length > 20) return { valid: false, error: 'Too many address entries (max 20)' };
  for (const a of addresses) {
    if (!a || typeof a !== 'object') return { valid: false, error: 'Address entry must be an object' };
    if (!a.label) return { valid: false, error: 'Address requires label' };
    if (typeof a.label !== 'string' || a.label.trim().length === 0 || a.label.length > 50) {
      return { valid: false, error: 'Address label invalid or too long' };
    }
    if (a.street !== undefined && (typeof a.street !== 'string' || a.street.length > 255)) {
      return { valid: false, error: 'Address street invalid or too long' };
    }
    if (a.city !== undefined && (typeof a.city !== 'string' || a.city.length > 255)) {
      return { valid: false, error: 'Address city invalid or too long' };
    }
    if (a.state !== undefined && (typeof a.state !== 'string' || a.state.length > 255)) {
      return { valid: false, error: 'Address state invalid or too long' };
    }
    if (a.postalCode !== undefined && (typeof a.postalCode !== 'string' || a.postalCode.length > 255)) {
      return { valid: false, error: 'Address postalCode invalid or too long' };
    }
    if (a.country !== undefined && (typeof a.country !== 'string' || a.country.length > 255)) {
      return { valid: false, error: 'Address country invalid or too long' };
    }
    if (a.isPrimary !== undefined && typeof a.isPrimary !== 'boolean') {
      return { valid: false, error: 'Address isPrimary must be boolean' };
    }
  }
  return { valid: true };
}

/**
 * GET /api/v1/contacts
 * Alle Kontakte, optional nach Kategorie gefiltert und nach Name gesucht.
 * Query: ?category=<cat>&q=<search>
 * Response: { data: Contact[] }
 */
router.get('/', (req, res) => {
  try {
    let sql    = 'SELECT * FROM contacts';
    const params = [];
    const where  = ['NOT EXISTS (SELECT 1 FROM housekeeping_workers hw WHERE hw.user_id = contacts.family_user_id)'];

    if (req.query.category && VALID_CATEGORIES.includes(req.query.category)) {
      where.push('category = ?');
      params.push(req.query.category);
    }

    if (req.query.q) {
      where.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)');
      const like = `%${req.query.q}%`;
      params.push(like, like, like);
    }

    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY category ASC, name ASC';

    const contacts = db.get().prepare(sql).all(...params);
    res.json({ data: contacts });
  } catch (err) {
    log.error('', err);
    res.status(500).json({ error: 'Interner Fehler', code: 500 });
  }
});

/**
 * POST /api/v1/contacts
 * Neuen Kontakt anlegen.
 * Body: { name, category?, phone?, email?, address?, notes?, phones?, emails?, addresses? }
 * Response: { data: Contact }
 */
router.post('/', (req, res) => {
  try {
    const vName    = str(req.body.name,     'Name',    { max: MAX_TITLE });
    const vCat     = oneOf(req.body.category || 'Sonstiges', VALID_CATEGORIES, 'Kategorie');
    const vPhone   = str(req.body.phone,   'Telefon', { max: MAX_SHORT, required: false });
    const vEmail   = str(req.body.email,   'E-Mail',  { max: MAX_TITLE, required: false });
    const vAddress = str(req.body.address, 'Adresse', { max: MAX_TEXT,  required: false });
    const vNotes   = str(req.body.notes,   'Notizen', { max: MAX_TEXT,  required: false });
    const errors   = collectErrors([vName, vCat, vPhone, vEmail, vAddress, vNotes]);
    if (errors.length) return res.status(400).json({ error: errors.join(' '), code: 400 });

    // Validate multi-value fields if provided
    if (req.body.phones !== undefined) {
      const phonesValidation = validatePhones(req.body.phones);
      if (!phonesValidation.valid) {
        return res.status(400).json({ error: phonesValidation.error, code: 400 });
      }
    }

    if (req.body.emails !== undefined) {
      const emailsValidation = validateEmails(req.body.emails);
      if (!emailsValidation.valid) {
        return res.status(400).json({ error: emailsValidation.error, code: 400 });
      }
    }

    if (req.body.addresses !== undefined) {
      const addressesValidation = validateAddresses(req.body.addresses);
      if (!addressesValidation.valid) {
        return res.status(400).json({ error: addressesValidation.error, code: 400 });
      }
    }

    // Insert contact and multi-value fields in a transaction
    const transaction = db.get().transaction(() => {
      const result = db.get().prepare(`
        INSERT INTO contacts (name, category, phone, email, address, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(vName.value, vCat.value || 'Sonstiges', vPhone.value, vEmail.value,
             vAddress.value, vNotes.value);

      const contactId = result.lastInsertRowid;

      // Insert phones
      if (req.body.phones && Array.isArray(req.body.phones)) {
        const insertPhone = db.get().prepare(`
          INSERT INTO contact_phones (contact_id, label, value, is_primary)
          VALUES (?, ?, ?, ?)
        `);
        for (const phone of req.body.phones) {
          insertPhone.run(contactId, phone.label, phone.value, phone.isPrimary ? 1 : 0);
        }
      }

      // Insert emails
      if (req.body.emails && Array.isArray(req.body.emails)) {
        const insertEmail = db.get().prepare(`
          INSERT INTO contact_emails (contact_id, label, value, is_primary)
          VALUES (?, ?, ?, ?)
        `);
        for (const email of req.body.emails) {
          insertEmail.run(contactId, email.label, email.value, email.isPrimary ? 1 : 0);
        }
      }

      // Insert addresses
      if (req.body.addresses && Array.isArray(req.body.addresses)) {
        const insertAddress = db.get().prepare(`
          INSERT INTO contact_addresses (contact_id, label, street, city, state, postal_code, country, is_primary)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const address of req.body.addresses) {
          insertAddress.run(
            contactId,
            address.label,
            address.street || null,
            address.city || null,
            address.state || null,
            address.postalCode || null,
            address.country || null,
            address.isPrimary ? 1 : 0
          );
        }
      }

      return contactId;
    });

    const contactId = transaction();

    // Query the created contact with multi-value fields
    const contact = db.get().prepare('SELECT * FROM contacts WHERE id = ?').get(contactId);
    const multiValueFields = loadMultiValueFields(contactId);

    res.status(201).json({
      data: {
        ...contact,
        ...multiValueFields
      }
    });
  } catch (err) {
    log.error('', err);
    res.status(500).json({ error: 'Interner Fehler', code: 500 });
  }
});

/**
 * PUT /api/v1/contacts/:id
 * Kontakt bearbeiten.
 * Body: alle Felder optional, phones/emails/addresses mit Replacement-Semantik
 * Response: { data: Contact }
 */
router.put('/:id', (req, res) => {
  try {
    const id      = parseInt(req.params.id, 10);
    const contact = db.get().prepare('SELECT * FROM contacts WHERE id = ?').get(id);
    if (!contact) return res.status(404).json({ error: 'Kontakt nicht gefunden', code: 404 });

    const checks = [];
    if (req.body.name     !== undefined) checks.push(str(req.body.name,     'Name',    { max: MAX_TITLE, required: false }));
    if (req.body.category !== undefined) checks.push(oneOf(req.body.category, VALID_CATEGORIES, 'Kategorie'));
    if (req.body.phone    !== undefined) checks.push(str(req.body.phone,    'Telefon', { max: MAX_SHORT, required: false }));
    if (req.body.email    !== undefined) checks.push(str(req.body.email,    'E-Mail',  { max: MAX_TITLE, required: false }));
    if (req.body.address  !== undefined) checks.push(str(req.body.address,  'Adresse', { max: MAX_TEXT,  required: false }));
    if (req.body.notes    !== undefined) checks.push(str(req.body.notes,    'Notizen', { max: MAX_TEXT,  required: false }));
    const errors = collectErrors(checks);
    if (errors.length) return res.status(400).json({ error: errors.join(' '), code: 400 });

    // Validate multi-value fields if provided
    if (req.body.phones !== undefined) {
      const phonesValidation = validatePhones(req.body.phones);
      if (!phonesValidation.valid) {
        return res.status(400).json({ error: phonesValidation.error, code: 400 });
      }
    }

    if (req.body.emails !== undefined) {
      const emailsValidation = validateEmails(req.body.emails);
      if (!emailsValidation.valid) {
        return res.status(400).json({ error: emailsValidation.error, code: 400 });
      }
    }

    if (req.body.addresses !== undefined) {
      const addressesValidation = validateAddresses(req.body.addresses);
      if (!addressesValidation.valid) {
        return res.status(400).json({ error: addressesValidation.error, code: 400 });
      }
    }

    // Update contact and multi-value fields in a transaction
    const transaction = db.get().transaction(() => {
      // Update scalar fields
      db.get().prepare(`
        UPDATE contacts
        SET name     = COALESCE(?, name),
            category = COALESCE(?, category),
            phone    = ?,
            email    = ?,
            address  = ?,
            notes    = ?
        WHERE id = ?
      `).run(
        req.body.name?.trim() ?? null,
        req.body.category ?? null,
        req.body.phone   !== undefined ? (req.body.phone?.trim()   || null) : contact.phone,
        req.body.email   !== undefined ? (req.body.email?.trim()   || null) : contact.email,
        req.body.address !== undefined ? (req.body.address?.trim() || null) : contact.address,
        req.body.notes   !== undefined ? (req.body.notes?.trim()   || null) : contact.notes,
        id
      );

      // Replace phones (delete all, insert new)
      if (req.body.phones !== undefined && Array.isArray(req.body.phones)) {
        db.get().prepare('DELETE FROM contact_phones WHERE contact_id = ?').run(id);

        const insertPhone = db.get().prepare(`
          INSERT INTO contact_phones (contact_id, label, value, is_primary)
          VALUES (?, ?, ?, ?)
        `);
        for (const phone of req.body.phones) {
          insertPhone.run(id, phone.label, phone.value, phone.isPrimary ? 1 : 0);
        }
      }

      // Replace emails (delete all, insert new)
      if (req.body.emails !== undefined && Array.isArray(req.body.emails)) {
        db.get().prepare('DELETE FROM contact_emails WHERE contact_id = ?').run(id);

        const insertEmail = db.get().prepare(`
          INSERT INTO contact_emails (contact_id, label, value, is_primary)
          VALUES (?, ?, ?, ?)
        `);
        for (const email of req.body.emails) {
          insertEmail.run(id, email.label, email.value, email.isPrimary ? 1 : 0);
        }
      }

      // Replace addresses (delete all, insert new)
      if (req.body.addresses !== undefined && Array.isArray(req.body.addresses)) {
        db.get().prepare('DELETE FROM contact_addresses WHERE contact_id = ?').run(id);

        const insertAddress = db.get().prepare(`
          INSERT INTO contact_addresses (contact_id, label, street, city, state, postal_code, country, is_primary)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const address of req.body.addresses) {
          insertAddress.run(
            id,
            address.label,
            address.street || null,
            address.city || null,
            address.state || null,
            address.postalCode || null,
            address.country || null,
            address.isPrimary ? 1 : 0
          );
        }
      }
    });

    transaction();

    // Query the updated contact with multi-value fields
    const updated = db.get().prepare('SELECT * FROM contacts WHERE id = ?').get(id);
    const multiValueFields = loadMultiValueFields(id);

    res.json({
      data: {
        ...updated,
        ...multiValueFields
      }
    });
  } catch (err) {
    log.error('', err);
    res.status(500).json({ error: 'Interner Fehler', code: 500 });
  }
});

/**
 * DELETE /api/v1/contacts/:id
 * Kontakt löschen.
 * Response: 204 No Content
 */
router.delete('/:id', (req, res) => {
  try {
    const id     = parseInt(req.params.id, 10);
    const contact = db.get().prepare('SELECT family_user_id FROM contacts WHERE id = ?').get(id);
    if (!contact) return res.status(404).json({ error: 'Kontakt nicht gefunden', code: 404 });
    
    if (contact.family_user_id) {
      return res.status(403).json({ error: 'Familienmitglieder können nicht aus der Kontaktliste gelöscht werden.', code: 403 });
    }

    const result = db.get().prepare('DELETE FROM contacts WHERE id = ?').run(id);
    if (result.changes === 0)
      return res.status(404).json({ error: 'Kontakt nicht gefunden', code: 404 });
    res.status(204).end();
  } catch (err) {
    log.error('', err);
    res.status(500).json({ error: 'Interner Fehler', code: 500 });
  }
});

/**
 * GET /api/v1/contacts/meta
 * Kategorien-Liste für Dropdowns.
 * Response: { data: { categories } }
 */
router.get('/meta', (_req, res) => {
  try {
    res.json({ data: { categories: VALID_CATEGORIES } });
  } catch (err) {
    log.error('', err);
    res.status(500).json({ error: 'Interner Fehler', code: 500 });
  }
});

/**
 * GET /api/v1/contacts/:id
 * Einzelnen Kontakt abrufen mit Multi-Value Fields (phones, emails, addresses).
 * Response: { data: Contact }
 */
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const contact = db.get().prepare('SELECT * FROM contacts WHERE id = ?').get(id);
    if (!contact) return res.status(404).json({ error: 'Kontakt nicht gefunden', code: 404 });

    // Load multi-value fields
    const multiValueFields = loadMultiValueFields(id);

    res.json({
      data: {
        ...contact,
        ...multiValueFields
      }
    });
  } catch (err) {
    log.error('', err);
    res.status(500).json({ error: 'Interner Fehler', code: 500 });
  }
});

/**
 * GET /api/v1/contacts/:id/vcard
 * Kontakt als vCard 3.0 (.vcf) exportieren.
 * Response: text/vcard Dateidownload
 */
router.get('/:id/vcard', (req, res) => {
  try {
    const id      = parseInt(req.params.id, 10);
    const contact = db.get().prepare('SELECT * FROM contacts WHERE id = ?').get(id);
    if (!contact) return res.status(404).json({ error: 'Kontakt nicht gefunden', code: 404 });

    const esc = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${esc(contact.name)}`,
      `N:${esc(contact.name)};;;;`,
    ];
    if (contact.phone)   lines.push(`TEL;TYPE=VOICE:${esc(contact.phone)}`);
    if (contact.email)   lines.push(`EMAIL:${esc(contact.email)}`);
    if (contact.address) lines.push(`ADR;TYPE=HOME:;;${esc(contact.address)};;;;`);
    if (contact.notes)   lines.push(`NOTE:${esc(contact.notes)}`);
    if (contact.category) lines.push(`CATEGORIES:${esc(contact.category)}`);
    lines.push('END:VCARD');

    const vcf      = lines.join('\r\n');
    const filename = encodeURIComponent(contact.name.replace(/[^a-zA-Z0-9-_ ]/g, '_')) + '.vcf';

    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(vcf);
  } catch (err) {
    log.error('', err);
    res.status(500).json({ error: 'Interner Fehler', code: 500 });
  }
});

export default router;
export { validatePhones, validateEmails, validateAddresses };
