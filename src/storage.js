import { supabase } from './supabaseClient'
import { encryptEntry, decryptEntry } from './crypto'

// ─── Fetch all non-expired entries (decrypted) ───
export async function loadEntries() {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .gt('expires_at', now)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Load error:', error)
    return []
  }

  // Decrypt all entries in parallel
  const decrypted = await Promise.all(
    data.map(async (row) => {
      const entry = {
        id: row.id,
        title: row.title,
        plan: row.plan,
        reflection: row.reflection,
        tags: row.tags || [],
        createdAt: new Date(row.created_at).getTime(),
        expiresAt: new Date(row.expires_at).getTime(),
        recycleCount: row.recycle_count || 0,
        ripCount: row.rip_count || 0,
      }
      return decryptEntry(entry)
    })
  )

  return decrypted
}

// ─── Insert a new entry (encrypted) ───
export async function saveEntry(entry) {
  // Encrypt before saving
  const encrypted = await encryptEntry(entry)

  const { data, error } = await supabase
    .from('entries')
    .insert({
      title: encrypted.title,
      plan: encrypted.plan || '',
      reflection: encrypted.reflection,
      tags: entry.tags, // tags stay plaintext
      created_at: new Date(entry.createdAt).toISOString(),
      expires_at: new Date(entry.expiresAt).toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('Save error:', error)
    return null
  }
  return data.id
}

// ─── Delete expired entries (cleanup) ───
export async function purgeExpired() {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('entries')
    .delete()
    .lte('expires_at', now)

  if (error) {
    console.error('Purge error:', error)
  }
}

// ─── Fetch a single entry by ID (decrypted) ───
export async function loadEntryById(id) {
  const { data: row, error } = await supabase
    .from('entries')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !row) {
    console.error('Load by ID error:', error)
    return null
  }

  // Check if expired
  if (new Date(row.expires_at) <= new Date()) return null

  const entry = {
    id: row.id,
    title: row.title,
    plan: row.plan,
    reflection: row.reflection,
    tags: row.tags || [],
    createdAt: new Date(row.created_at).getTime(),
    expiresAt: new Date(row.expires_at).getTime(),
    recycleCount: row.recycle_count || 0,
    ripCount: row.rip_count || 0,
  }
  return decryptEntry(entry)
}

// ─── React to an entry (recycle or rip), toggle on/off ───
export async function reactToEntry(entryId, type, undo = false) {
  const column = type === 'recycle' ? 'recycle_count' : 'rip_count'

  // Get current count first
  const { data, error: fetchError } = await supabase
    .from('entries')
    .select(column)
    .eq('id', entryId)
    .single()

  if (fetchError) {
    console.error('React fetch error:', fetchError)
    return false
  }

  const current = data[column] || 0
  const next = undo ? Math.max(0, current - 1) : current + 1
  const { error } = await supabase
    .from('entries')
    .update({ [column]: next })
    .eq('id', entryId)

  if (error) {
    console.error('React error:', error)
    return false
  }
  return true
}

// ─── Get total entry count ───
export async function getEntryCount() {
  const now = new Date().toISOString()
  const { count, error } = await supabase
    .from('entries')
    .select('*', { count: 'exact', head: true })
    .gt('expires_at', now)

  if (error) {
    console.error('Count error:', error)
    return 0
  }
  return count || 0
}
