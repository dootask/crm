import { getDb } from '#/lib/db'
import type { Contact } from '#/lib/types'

export interface ContactInput {
  customer_id: number
  name: string
  title?: string | null
  phone?: string | null
  email?: string | null
  is_primary?: boolean
  note?: string | null
}

export function listContacts(customerId: number): Array<Contact> {
  return getDb()
    .prepare(
      'SELECT * FROM contacts WHERE customer_id = ? ORDER BY is_primary DESC, id ASC',
    )
    .all(customerId) as Array<Contact>
}

export function getContact(id: number): Contact | undefined {
  return getDb().prepare('SELECT * FROM contacts WHERE id = ?').get(id) as
    | Contact
    | undefined
}

export function createContact(input: ContactInput): Contact {
  const primary = input.is_primary ? 1 : 0
  const db = getDb()
  const tx = db.transaction(() => {
    if (primary) {
      db.prepare(
        'UPDATE contacts SET is_primary = 0 WHERE customer_id = ?',
      ).run(input.customer_id)
    }
    const info = db
      .prepare(
        `INSERT INTO contacts (customer_id, name, title, phone, email, is_primary, note)
         VALUES (@customer_id, @name, @title, @phone, @email, @is_primary, @note)`,
      )
      .run({
        customer_id: input.customer_id,
        name: input.name,
        title: input.title ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        is_primary: primary,
        note: input.note ?? null,
      })
    return info.lastInsertRowid as number
  })
  return getContact(tx())!
}

export function updateContact(
  id: number,
  patch: Partial<ContactInput>,
): Contact | undefined {
  const existing = getContact(id)
  if (!existing) return undefined
  const db = getDb()
  const tx = db.transaction(() => {
    if (patch.is_primary) {
      db.prepare(
        'UPDATE contacts SET is_primary = 0 WHERE customer_id = ?',
      ).run(existing.customer_id)
    }
    const fields: Array<string> = []
    const params: Array<unknown> = []
    const map: Record<string, unknown> = {
      name: patch.name,
      title: patch.title,
      phone: patch.phone,
      email: patch.email,
      note: patch.note,
      is_primary:
        patch.is_primary === undefined ? undefined : patch.is_primary ? 1 : 0,
    }
    for (const [k, v] of Object.entries(map)) {
      if (v !== undefined) {
        fields.push(`${k} = ?`)
        params.push(v)
      }
    }
    if (fields.length) {
      fields.push(`updated_at = datetime('now')`)
      params.push(id)
      db.prepare(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`).run(
        ...params,
      )
    }
  })
  tx()
  return getContact(id)
}

export function deleteContact(id: number): boolean {
  return getDb().prepare('DELETE FROM contacts WHERE id = ?').run(id).changes > 0
}
