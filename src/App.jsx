import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { loadEntries, saveEntry, purgeExpired, getEntryCount, loadEntryById } from './storage'
import TagCloud from './components/TagCloud'
import EntryCloud from './components/EntryCloud'
import WarmBackground from './components/WarmBackground'

// ─── Constants ───
const EXPIRY_OPTIONS = [
  { label: '1분', ms: 60000 },
  { label: '10분', ms: 600000 },
  { label: '1시간', ms: 3600000 },
  { label: '6시간', ms: 21600000 },
  { label: '24시간', ms: 86400000 },
  { label: '3일', ms: 259200000 },
  { label: '7일', ms: 604800000 },
  { label: '삭제 안 함', ms: 315360000000 }, // ~10년
]

const SUGGESTED_TAGS = [
  '질적연구', '민족지', '구술사', '현장연구', '아카이브',
  '인터뷰', '참여관찰', '사회학', '인류학', '역사학',
  '문학', '철학', '심리학', '교육학', '정치학',
  '젠더', '노동', '이주', '돌봄', '재난',
  '기억', '감각', '몸', '도시', '농촌',
]

// ─── Styles ───
const FONT = "'Noto Sans KR', sans-serif"

const labelStyle = {
  display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600,
  color: '#333', fontFamily: FONT,
  letterSpacing: '-0.02em',
}

const inputStyle = {
  width: '100%', padding: '12px 16px', borderRadius: 12,
  border: '1px solid #e0e0e0', background: 'rgba(255,255,255,0.8)',
  fontSize: 14, color: '#222', fontFamily: FONT,
  transition: 'border-color 0.3s',
}

export default function App() {
  const [tab, setTab] = useState('write')
  const [entries, setEntries] = useState([])
  const [entryCount, setEntryCount] = useState(0)
  const [loaded, setLoaded] = useState(false)

  // Write tab state
  const [title, setTitle] = useState('')
  const [plan, setPlan] = useState('')
  const [reflection, setReflection] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState([])
  const [expiry, setExpiry] = useState(EXPIRY_OPTIONS[2].ms)
  const [customExpiry, setCustomExpiry] = useState('')
  const [customUnit, setCustomUnit] = useState('minutes')
  const [useCustom, setUseCustom] = useState(false)
  const [step, setStep] = useState('form')
  const [submitting, setSubmitting] = useState(false)
  const [lastEntryId, setLastEntryId] = useState(null)
  const [copied, setCopied] = useState(false)

  // Single entry view (from URL)
  const [viewingEntry, setViewingEntry] = useState(null)

  // Cloud tab state
  const [selectedTag, setSelectedTag] = useState(null)

  // Load entries from Supabase
  const refreshEntries = useCallback(async () => {
    try {
      await purgeExpired()
      const data = await loadEntries()
      setEntries(data)
      const count = await getEntryCount()
      setEntryCount(count)
    } catch (e) {
      console.error('Refresh error:', e)
    }
  }, [])

  useEffect(() => {
    refreshEntries().then(() => setLoaded(true))

    // Check URL for ?id= param → show single entry
    const params = new URLSearchParams(window.location.search)
    const entryId = params.get('id')
    if (entryId) {
      loadEntryById(entryId).then(entry => {
        if (entry) setViewingEntry(entry)
      })
    }
  }, [refreshEntries])

  // Periodic refresh
  useEffect(() => {
    const interval = setInterval(refreshEntries, 60000)
    return () => clearInterval(interval)
  }, [refreshEntries])

  // Refresh when switching to cloud tab
  useEffect(() => {
    if (tab === 'cloud') refreshEntries()
  }, [tab, refreshEntries])

  const addTag = (t) => {
    const cleaned = t.trim().replace(/^#/, '')
    if (cleaned && !tags.includes(cleaned) && tags.length < 5) {
      setTags([...tags, cleaned])
    }
    setTagInput('')
  }

  const getEffectiveExpiry = () => {
    if (!useCustom) return expiry
    const val = parseFloat(customExpiry)
    if (!val || val <= 0) return expiry
    const multiplier = customUnit === 'minutes' ? 60000 : customUnit === 'hours' ? 3600000 : 86400000
    return val * multiplier
  }

  const getExpiryLabel = () => {
    if (!useCustom) return EXPIRY_OPTIONS.find(o => o.ms === expiry)?.label
    const val = parseFloat(customExpiry)
    if (!val || val <= 0) return '?'
    const unitLabel = customUnit === 'minutes' ? '분' : customUnit === 'hours' ? '시간' : '일'
    return `${val}${unitLabel}`
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    const effectiveExpiry = getEffectiveExpiry()
    const entry = {
      title, plan, reflection, tags,
      createdAt: Date.now(),
      expiresAt: Date.now() + effectiveExpiry,
    }
    const entryId = await saveEntry(entry)
    if (entryId) {
      setLastEntryId(entryId)
      setCopied(false)
      setStep('done')
      refreshEntries()
    } else {
      alert('등록에 실패했어요. 다시 시도해주세요.')
    }
    setSubmitting(false)
  }

  const resetForm = () => {
    setTitle(''); setPlan(''); setReflection('')
    setTagInput(''); setTags([]); setExpiry(EXPIRY_OPTIONS[2].ms)
    setCustomExpiry(''); setCustomUnit('minutes'); setUseCustom(false)
    setStep('form')
  }

  const tagCounts = useMemo(() => {
    const counts = {}
    entries.forEach(e => e.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1 }))
    return counts
  }, [entries])

  const filteredEntries = useMemo(() => {
    if (!selectedTag) return []
    return entries.filter(e => e.tags.includes(selectedTag))
  }, [entries, selectedTag])

  if (!loaded) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#FAFAF7', fontFamily: FONT, color: '#999',
      }}>
        불러오는 중...
      </div>
    )
  }

  return (
    <>
      <WarmBackground />

      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: 820, margin: '0 auto', minHeight: '100vh',
        padding: '30px 20px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36, animation: 'fadeSlideIn 0.8s both' }}>
          <div style={{
            fontSize: 11, letterSpacing: 4, color: '#999', marginBottom: 8,
            fontFamily: FONT, textTransform: 'uppercase',
          }}>
            Salvage Yard for Lost Studies
          </div>
          <h1 style={{
            fontFamily: FONT, fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 700,
            color: '#222', letterSpacing: '-0.03em', lineHeight: 1.3,
          }}>
            더 망하기 전에
          </h1>
          <p style={{
            fontFamily: FONT, fontSize: 14, color: '#777',
            marginTop: 10, lineHeight: 1.7, maxWidth: 440, margin: '10px auto 0',
          }}>
            망한 연구, 못 한 연구. 여기에 내려놓고 다시 생각해보세요.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 4, height: 4, borderRadius: '50%', background: '#FFF44F',
                opacity: 0.5 + i * 0.2,
              }} />
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28,
          animation: 'fadeSlideIn 0.8s 0.2s both',
        }}>
          {[
            { id: 'write', label: '버리기 Drop Off', icon: '✦' },
            { id: 'cloud', label: '적환장 Transfer Station', icon: '◎' },
          ].map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setSelectedTag(null) }} style={{
              fontFamily: FONT, fontSize: 14,
              padding: '10px 28px', borderRadius: 24,
              border: tab === t.id ? '2px solid #222' : '1px solid #ddd',
              background: tab === t.id ? '#FFF44F' : 'rgba(255,255,255,0.7)',
              color: tab === t.id ? '#222' : '#777',
              cursor: 'pointer', transition: 'all 0.4s cubic-bezier(.4,0,.2,1)',
              fontWeight: tab === t.id ? 700 : 400,
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Single Entry View (from URL) */}
        {viewingEntry && (
          <div style={{
            background: 'rgba(255,255,255,0.75)', borderRadius: 24,
            border: '1px solid #e8e8e8', padding: 'clamp(20px, 4vw, 36px)',
            marginBottom: 20, animation: 'fadeSlideIn 0.5s both',
          }}>
            <div style={{
              background: 'rgba(255,244,79,0.08)', borderRadius: 16,
              padding: 24, borderLeft: '3px solid #FFF44F',
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#222', marginBottom: 12, fontFamily: FONT }}>
                {viewingEntry.title}
              </div>
              {viewingEntry.plan && (
                <div style={{ fontSize: 14, color: '#444', lineHeight: 1.8, marginBottom: 12, fontFamily: FONT }}>
                  <span style={{ fontSize: 11, color: '#999' }}>연구 계획</span><br />
                  {viewingEntry.plan}
                </div>
              )}
              <div style={{ fontSize: 14, color: '#555', lineHeight: 1.8, fontStyle: 'italic', fontFamily: FONT }}>
                <span style={{ fontSize: 11, color: '#999', fontStyle: 'normal' }}>소회</span><br />
                {viewingEntry.reflection}
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 16, paddingTop: 12, borderTop: '1px solid #e8e8e8',
              }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {viewingEntry.tags.map(t => (
                    <span key={t} style={{
                      background: '#22222010', padding: '3px 10px', borderRadius: 10,
                      fontSize: 12, color: '#555', fontFamily: FONT,
                    }}>#{t}</span>
                  ))}
                </div>
                <span style={{ fontSize: 12, color: '#999', fontFamily: FONT }}>
                  ♻️ {viewingEntry.recycleCount} · 🪦 {viewingEntry.ripCount}
                </span>
              </div>
            </div>
            <button onClick={() => {
              setViewingEntry(null)
              window.history.replaceState({}, '', window.location.pathname)
            }} style={{
              marginTop: 16, padding: '10px 28px', borderRadius: 16,
              border: '2px solid #222', background: '#FFF44F',
              fontSize: 14, color: '#222', cursor: 'pointer',
              fontFamily: FONT, fontWeight: 700, width: '100%',
            }}>
              사이트 둘러보기
            </button>
          </div>
        )}

        {/* Content Area */}
        <div style={{
          background: 'rgba(255,255,255,0.75)',
          borderRadius: 24, backdropFilter: 'blur(12px)',
          border: '1px solid #e8e8e8',
          boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
          minHeight: 500, overflow: 'hidden',
          animation: 'fadeSlideIn 0.8s 0.3s both',
        }}>

          {/* ─── WRITE TAB: Form ─── */}
          {tab === 'write' && step === 'form' && (
            <div style={{ padding: 'clamp(20px, 4vw, 36px) clamp(16px, 3vw, 32px)' }}>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>제목 (가제, 별명, 아무거나)</label>
                <input
                  value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="예: 결국 IRB에서 막힌 그 프로젝트"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>
                  뭘 하려고 했나 <span style={{ fontWeight: 300, opacity: 0.5 }}>(선택)</span>
                </label>
                <textarea
                  value={plan} onChange={e => setPlan(e.target.value)}
                  placeholder="거창한 계획이든, 막연한 구상이든 괜찮아요"
                  rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.8 }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>왜 망했나 (또는 왜 못 했나)</label>
                <textarea
                  value={reflection} onChange={e => setReflection(e.target.value)}
                  placeholder="솔직하게. 어차피 익명이고, 곧 사라집니다."
                  rows={5} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.8 }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>
                  태그 <span style={{ fontWeight: 500, color: '#FFF44F', background: '#222', padding: '1px 8px', borderRadius: 6, fontSize: 11, marginLeft: 4 }}>필수</span> <span style={{ fontWeight: 300, opacity: 0.5 }}>(최대 5개)</span>
                </label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) } }}
                    placeholder="태그 달기 (Enter)"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={() => addTag(tagInput)} style={{
                    padding: '0 20px', borderRadius: 12,
                    border: '1px solid #ddd', background: 'rgba(255,255,255,0.8)',
                    cursor: 'pointer', fontFamily: FONT,
                    fontSize: 13, color: '#555', transition: 'all 0.3s',
                  }}>추가</button>
                </div>

                {tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {tags.map(t => (
                      <span key={t} style={{
                        background: '#222', color: '#FFF44F', padding: '4px 14px',
                        borderRadius: 14, fontSize: 13, fontFamily: FONT,
                        display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500,
                      }}>
                        #{t}
                        <span onClick={() => setTags(tags.filter(x => x !== t))}
                          style={{ cursor: 'pointer', opacity: 0.7, fontSize: 11 }}>✕</span>
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {SUGGESTED_TAGS.filter(t => !tags.includes(t)).slice(0, 12).map(t => (
                    <button key={t} onClick={() => addTag(t)} style={{
                      background: 'rgba(255,244,79,0.15)', border: '1px solid rgba(255,244,79,0.4)',
                      padding: '3px 12px', borderRadius: 12, fontSize: 12, color: '#555',
                      cursor: 'pointer', fontFamily: FONT,
                      transition: 'all 0.2s',
                    }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 28 }}>
                <label style={labelStyle}>언제 사라지게 할까요</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {EXPIRY_OPTIONS.map(opt => (
                    <button key={opt.ms} onClick={() => { setExpiry(opt.ms); setUseCustom(false) }} style={{
                      padding: '8px 20px', borderRadius: 16,
                      border: !useCustom && expiry === opt.ms ? '2px solid #222' : '1px solid #ddd',
                      background: !useCustom && expiry === opt.ms ? '#FFF44F' : 'rgba(255,255,255,0.7)',
                      color: !useCustom && expiry === opt.ms ? '#222' : '#777',
                      cursor: 'pointer', fontSize: 13, fontFamily: FONT,
                      fontWeight: !useCustom && expiry === opt.ms ? 700 : 400,
                      transition: 'all 0.3s',
                    }}>
                      {opt.label}
                    </button>
                  ))}
                  <button onClick={() => setUseCustom(true)} style={{
                    padding: '8px 20px', borderRadius: 16,
                    border: useCustom ? '2px solid #222' : '1px solid #ddd',
                    background: useCustom ? '#FFF44F' : 'rgba(255,255,255,0.7)',
                    color: useCustom ? '#222' : '#777',
                    cursor: 'pointer', fontSize: 13, fontFamily: FONT,
                    fontWeight: useCustom ? 700 : 400,
                    transition: 'all 0.3s',
                  }}>
                    직접 설정
                  </button>
                </div>
                {useCustom && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', animation: 'fadeSlideIn 0.3s both' }}>
                    <input
                      type="number" min="1" value={customExpiry}
                      onChange={e => setCustomExpiry(e.target.value)}
                      placeholder="숫자"
                      style={{ ...inputStyle, width: 100, textAlign: 'center' }}
                    />
                    <select value={customUnit} onChange={e => setCustomUnit(e.target.value)} style={{
                      ...inputStyle, width: 'auto', cursor: 'pointer',
                    }}>
                      <option value="minutes">분</option>
                      <option value="hours">시간</option>
                      <option value="days">일</option>
                    </select>
                    <span style={{ fontSize: 12, color: '#999', fontFamily: FONT }}>후 삭제</span>
                  </div>
                )}
              </div>

              {tags.length === 0 && title.trim() && reflection.trim() && (
                <div style={{
                  fontSize: 12, color: '#c45a5a', fontFamily: FONT, marginBottom: 8,
                  animation: 'fadeSlideIn 0.3s both',
                }}>
                  태그를 최소 1개 이상 달아주세요. 적환장에서 찾을 수 있어요.
                </div>
              )}
              <button
                onClick={() => { if (title.trim() && reflection.trim() && tags.length > 0) setStep('confirm') }}
                disabled={!title.trim() || !reflection.trim() || tags.length === 0}
                style={{
                  width: '100%', padding: '14px', borderRadius: 16,
                  border: title.trim() && reflection.trim() && tags.length > 0 ? '2px solid #222' : 'none',
                  fontSize: 16, fontFamily: FONT,
                  fontWeight: 700,
                  cursor: title.trim() && reflection.trim() && tags.length > 0 ? 'pointer' : 'default',
                  background: title.trim() && reflection.trim() && tags.length > 0 ? '#FFF44F' : '#e0e0e0',
                  color: title.trim() && reflection.trim() && tags.length > 0 ? '#222' : '#999',
                  transition: 'all 0.4s',
                  boxShadow: title.trim() && reflection.trim() && tags.length > 0
                    ? '0 4px 20px rgba(255,244,79,0.3)' : 'none',
                }}>
                여기 두고 가기
              </button>
            </div>
          )}

          {/* ─── WRITE TAB: Confirm ─── */}
          {tab === 'write' && step === 'confirm' && (
            <div style={{ padding: 'clamp(20px, 4vw, 36px) clamp(16px, 3vw, 32px)' }}>
              <div style={{
                textAlign: 'center', marginBottom: 28,
                fontFamily: FONT, color: '#222',
              }}>
                <div style={{ fontSize: 24, marginBottom: 6, fontWeight: 700 }}>확인해 주세요</div>
                <div style={{ fontSize: 13, opacity: 0.5 }}>익명으로 등록됩니다. 되돌릴 수 없어요.</div>
              </div>

              <div style={{
                background: 'rgba(255,244,79,0.08)', borderRadius: 16,
                padding: 24, marginBottom: 24, borderLeft: '3px solid #FFF44F',
              }}>
                <div style={{
                  fontSize: 18, fontWeight: 700, color: '#222', marginBottom: 12,
                  fontFamily: FONT,
                }}>
                  {title}
                </div>
                {plan && (
                  <div style={{
                    fontSize: 14, color: '#444', lineHeight: 1.8, marginBottom: 12,
                    fontFamily: FONT,
                  }}>
                    <span style={{ fontSize: 11, color: '#999' }}>연구 계획</span><br />
                    {plan}
                  </div>
                )}
                <div style={{
                  fontSize: 14, color: '#555', lineHeight: 1.8, fontStyle: 'italic',
                  fontFamily: FONT,
                }}>
                  <span style={{ fontSize: 11, color: '#999', fontStyle: 'normal' }}>소회</span><br />
                  {reflection}
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginTop: 16, paddingTop: 12, borderTop: '1px solid #e8e8e8',
                }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {tags.map(t => (
                      <span key={t} style={{
                        background: '#22222010', padding: '3px 10px', borderRadius: 10,
                        fontSize: 12, color: '#555', fontFamily: FONT,
                      }}>#{t}</span>
                    ))}
                  </div>
                  <span style={{ fontSize: 12, color: '#999', fontFamily: FONT }}>
                    {getExpiryLabel()} 후 삭제
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setStep('form')} style={{
                  flex: 1, padding: 12, borderRadius: 14,
                  border: '1px solid #ddd', background: 'transparent',
                  fontSize: 15, color: '#555', cursor: 'pointer',
                  fontFamily: FONT,
                }}>
                  수정하기
                </button>
                <button onClick={handleSubmit} disabled={submitting} style={{
                  flex: 2, padding: 12, borderRadius: 14,
                  border: submitting ? 'none' : '2px solid #222',
                  background: submitting ? '#e0e0e0' : '#FFF44F',
                  fontSize: 15, color: '#222', cursor: submitting ? 'wait' : 'pointer',
                  fontFamily: FONT, fontWeight: 700,
                  boxShadow: '0 4px 20px rgba(255,244,79,0.3)',
                }}>
                  {submitting ? '등록 중...' : '등록하기'}
                </button>
              </div>
            </div>
          )}

          {/* ─── WRITE TAB: Done ─── */}
          {tab === 'write' && step === 'done' && (
            <div style={{
              padding: '60px 32px', textAlign: 'center',
              fontFamily: FONT,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#FFF44F',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', fontSize: 28,
                border: '2px solid #222',
              }}>
                ✦
              </div>
              <div style={{ fontSize: 22, color: '#222', fontWeight: 700, marginBottom: 10 }}>
                접수 완료
              </div>
              <div style={{ fontSize: 14, color: '#666', lineHeight: 1.7, marginBottom: 6 }}>
                당신의 망한 연구가 여기 잠시 머뭅니다.
              </div>
              <div style={{
                fontSize: 13, color: '#999',
                animation: 'gentlePulse 3s ease-in-out infinite',
                marginBottom: 32,
              }}>
                {getExpiryLabel()} 후 흔적 없이 사라집니다.
              </div>
              {/* Link copy */}
              {lastEntryId && (
                <div style={{
                  marginBottom: 24, padding: '12px 16px', borderRadius: 12,
                  background: 'rgba(255,244,79,0.1)', border: '1px solid #e8e8e8',
                  display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center',
                  animation: 'fadeSlideIn 0.3s both',
                }}>
                  <span style={{ fontSize: 12, color: '#777', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {`${window.location.origin}?id=${lastEntryId}`}
                  </span>
                  <button onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}?id=${lastEntryId}`)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }} style={{
                    padding: '6px 14px', borderRadius: 10, flexShrink: 0,
                    border: copied ? '2px solid #222' : '1px solid #ddd',
                    background: copied ? '#FFF44F' : '#fff',
                    fontSize: 12, color: '#222', cursor: 'pointer',
                    fontFamily: FONT, fontWeight: 500, transition: 'all 0.3s',
                  }}>
                    {copied ? '복사됨!' : '링크 복사'}
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={resetForm} style={{
                  padding: '10px 28px', borderRadius: 16,
                  border: '1px solid #ddd', background: 'rgba(255,255,255,0.7)',
                  fontSize: 14, color: '#555', cursor: 'pointer',
                  fontFamily: FONT,
                }}>
                  하나 더 버리기
                </button>
                <button onClick={() => { setTab('cloud'); resetForm() }} style={{
                  padding: '10px 28px', borderRadius: 16,
                  border: '2px solid #222',
                  background: '#FFF44F',
                  fontSize: 14, color: '#222', cursor: 'pointer',
                  fontFamily: FONT, fontWeight: 700,
                }}>
                  적환장 보기
                </button>
              </div>
            </div>
          )}

          {/* ─── CLOUD TAB ─── */}
          {tab === 'cloud' && !selectedTag && (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'clamp(360px, 60vh, 520px)' }}>
              {/* 전체 보기 버튼 */}
              <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setSelectedTag('__all__')} style={{
                  padding: '6px 16px', borderRadius: 14,
                  border: '1px solid #ddd', background: 'rgba(255,255,255,0.7)',
                  fontSize: 12, color: '#555', cursor: 'pointer', fontFamily: FONT,
                  transition: 'all 0.3s',
                }}>
                  전체 보기 ({entries.length})
                </button>
              </div>
              <div style={{ flex: 1, padding: 'clamp(8px, 1.5vw, 16px) clamp(12px, 2vw, 20px) clamp(12px, 2vw, 20px)' }}>
                <TagCloud
                  tags={tagCounts}
                  onTagClick={setSelectedTag}
                  selectedTag={selectedTag}
                />
              </div>
            </div>
          )}

          {tab === 'cloud' && selectedTag && (
            <div style={{ height: 'clamp(400px, 65vh, 560px)' }}>
              <EntryCloud
                entries={selectedTag === '__all__' ? entries : filteredEntries}
                tagName={selectedTag === '__all__' ? '전체' : selectedTag}
                onBack={() => setSelectedTag(null)}
                onReact={refreshEntries}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center', marginTop: 28, padding: 16,
          fontFamily: FONT, fontSize: 14, color: '#999',
          lineHeight: 1.7,
        }}>
          완전한 익명 · 자동 삭제 · 아무도 모릅니다
          <br />
          <span style={{ opacity: 0.5 }}>
            현재 {entryCount}개의 연구가 머물고 있어요
          </span>
          <br />
          <span style={{
            display: 'inline-block', marginTop: 8, padding: '4px 14px',
            background: 'rgba(255,244,79,0.15)', borderRadius: 12,
            fontSize: 12, color: '#777', letterSpacing: '0.02em',
          }}>
            🔒 본문은 암호화되어 운영자도 읽을 수 없습니다
          </span>
          <div style={{
            marginTop: 12, fontSize: 12, color: '#bbb', letterSpacing: '0.03em',
            lineHeight: 1.8,
          }}>
            AES-256-GCM 클라이언트 사이드 암호화 · 태그만 평문 저장
            <br />
            React · Supabase · Vercel · Web Crypto API
            <br />
            <a href="mailto:wonderlab1988@gmail.com" style={{ color: '#bbb', textDecoration: 'none' }}>
              문의: wonderlab1988@gmail.com
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
