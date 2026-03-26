/**
 * Client-side encryption using Web Crypto API (AES-GCM)
 * 
 * DB에는 암호문만 저장됩니다.
 * 운영자가 Supabase 대시보드를 열어도 본문을 읽을 수 없습니다.
 * 
 * 키는 VITE_ENCRYPTION_KEY 환경변수에서 가져옵니다.
 * 모든 사용자가 같은 키를 사용하므로 서로의 글을 읽을 수 있습니다.
 */

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY

if (!ENCRYPTION_KEY) {
  console.warn(
    '⚠️ VITE_ENCRYPTION_KEY가 설정되지 않았습니다.\n' +
    '.env 파일에 VITE_ENCRYPTION_KEY를 추가해주세요.\n' +
    '생성 방법: 브라우저 콘솔에서 crypto.randomUUID() 실행'
  )
}

// ─── Key derivation ───
// 환경변수 문자열로부터 안정적인 AES-GCM 키를 파생
async function deriveKey(passphrase) {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  
  // 고정 salt — 같은 키에서 항상 같은 파생키 생성
  const salt = encoder.encode('salvage-yard-for-lost-studies-v1')
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// 캐시된 키 (매번 파생하지 않기 위해)
let cachedKey = null

async function getKey() {
  if (!cachedKey && ENCRYPTION_KEY) {
    cachedKey = await deriveKey(ENCRYPTION_KEY)
  }
  return cachedKey
}

// ─── Encrypt ───
export async function encrypt(plaintext) {
  const key = await getKey()
  if (!key) return plaintext // 키 없으면 평문 (개발용)
  
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  )
  
  // iv + ciphertext를 합쳐서 base64로 인코딩
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  
  return btoa(String.fromCharCode(...combined))
}

// ─── Decrypt ───
export async function decrypt(encoded) {
  const key = await getKey()
  if (!key) return encoded // 키 없으면 그대로 반환 (개발용)
  
  try {
    const combined = new Uint8Array(
      atob(encoded).split('').map(c => c.charCodeAt(0))
    )
    
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)
    
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    )
    
    return new TextDecoder().decode(plaintext)
  } catch (e) {
    // 복호화 실패 시 (키 불일치, 손상된 데이터 등)
    console.warn('Decryption failed:', e.message)
    return '[복호화 실패 — 다른 키로 작성된 글일 수 있습니다]'
  }
}

// ─── Batch helpers ───
export async function encryptEntry(entry) {
  return {
    ...entry,
    title: await encrypt(entry.title),
    plan: entry.plan ? await encrypt(entry.plan) : '',
    reflection: await encrypt(entry.reflection),
    // tags는 평문 유지 (태그 구름 기능을 위해)
  }
}

export async function decryptEntry(entry) {
  return {
    ...entry,
    title: await decrypt(entry.title),
    plan: entry.plan ? await decrypt(entry.plan) : '',
    reflection: await decrypt(entry.reflection),
    // tags는 이미 평문
  }
}
