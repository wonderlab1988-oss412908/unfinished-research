import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { reactToEntry } from '../storage'

const CARD_COLORS = [
  '#c47a5a', '#5a7ac4', '#7a5ac4', '#5ac47a',
  '#c45a7a', '#5ac4b8', '#8b6f5c', '#6f5c8b',
  '#5c8b6f', '#8b5c6f', '#6f8b5c', '#5c6f8b',
]

const FONT = "'Noto Sans KR', sans-serif"

function timeLeft(expiresAt) {
  const diff = expiresAt - Date.now()
  if (diff <= 0) return '곧 사라짐'
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}일 남음`
  if (h > 0) return `${h}시간 남음`
  return `${Math.floor(diff / 60000)}분 남음`
}

export default function EntryCloud({ entries, onBack, tagName, onReact }) {
  const [zoom, setZoom] = useState(1)
  const [selected, setSelected] = useState(null)
  const [reacting, setReacting] = useState(null) // tracks which entry+type is being sent
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 })
  const panStart = useRef({ x: 0, y: 0 })
  const containerRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      setCanvasSize({ w: Math.max(rect.width, 320), h: Math.max(rect.height - 20, 300) })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const positions = useMemo(() => {
    const cx = canvasSize.w / 2, cy = canvasSize.h / 2
    const scale = Math.min(canvasSize.w / 800, canvasSize.h / 600)
    return entries.map((_, i) => {
      const angle = (i / entries.length) * 2 * Math.PI + (i * 0.3)
      const ring = Math.floor(i / 6)
      const radius = (80 + ring * 120 + (i % 3) * 30) * scale
      return {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        color: CARD_COLORS[i % CARD_COLORS.length],
      }
    })
  }, [entries, canvasSize])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    setZoom(z => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)))
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (el) el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el?.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const handleReact = async (e, entryId, type) => {
    e.stopPropagation()
    const key = `reacted_${entryId}_${type}`
    const alreadyReacted = !!localStorage.getItem(key)
    setReacting(`${entryId}_${type}`)
    const ok = await reactToEntry(entryId, type, alreadyReacted)
    if (ok) {
      if (alreadyReacted) {
        localStorage.removeItem(key)
      } else {
        localStorage.setItem(key, '1')
      }
      if (onReact) onReact()
    }
    setReacting(null)
  }

  const hasReacted = (entryId, type) => {
    return !!localStorage.getItem(`reacted_${entryId}_${type}`)
  }

  const handlePointerDown = (e) => {
    if (e.target.closest('[data-card]')) return
    setIsPanning(true)
    panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y }
  }
  const handlePointerMove = (e) => {
    if (!isPanning) return
    setPanOffset({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y })
  }
  const handlePointerUp = () => setIsPanning(false)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderBottom: '1px solid #e8e8e8',
        flexWrap: 'wrap', gap: 8,
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: '1px solid #ddd', padding: '8px 20px',
          borderRadius: 20, cursor: 'pointer', fontSize: 14,
          fontFamily: FONT, color: '#555',
          transition: 'all 0.3s',
        }}
        onMouseEnter={e => { e.target.style.background = '#FFF44F'; e.target.style.color = '#222'; e.target.style.borderColor = '#222' }}
        onMouseLeave={e => { e.target.style.background = 'none'; e.target.style.color = '#555'; e.target.style.borderColor = '#ddd' }}
        >
          ← 적환장으로
        </button>
        <span style={{
          fontFamily: FONT, fontSize: 18,
          color: '#222', fontWeight: 700,
        }}>
          #{tagName}
          <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 8, opacity: 0.5 }}>
            {entries.length}개의 연구
          </span>
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#999', display: canvasSize.w < 500 ? 'none' : 'inline' }}>
            스크롤로 확대/축소 · 드래그로 이동
          </span>
          <button onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }) }} style={{
            background: 'none', border: '1px solid #ddd', padding: '4px 12px',
            borderRadius: 12, cursor: 'pointer', fontSize: 12, color: '#555',
          }}>리셋</button>
        </div>
      </div>

      {/* Zoomable canvas */}
      <div ref={containerRef} style={{
        flex: 1, overflow: 'hidden', cursor: isPanning ? 'grabbing' : 'grab',
        position: 'relative',
      }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isPanning ? 'none' : 'transform 0.2s ease-out',
          width: canvasSize.w, height: canvasSize.h, position: 'relative',
          margin: '0 auto', marginTop: 20,
        }}>
          {entries.map((entry, i) => {
            const pos = positions[i]
            const isSelected = selected === entry.id
            return (
              <div key={entry.id} data-card="true"
                onClick={() => setSelected(isSelected ? null : entry.id)}
                style={{
                  position: 'absolute',
                  left: pos.x - (isSelected ? Math.min(190, canvasSize.w * 0.25) : Math.min(100, canvasSize.w * 0.14)),
                  top: pos.y - (isSelected ? 100 : 45),
                  width: isSelected ? Math.min(380, canvasSize.w * 0.8) : Math.min(200, canvasSize.w * 0.4),
                  padding: isSelected ? 'clamp(16px, 3vw, 24px)' : 'clamp(12px, 2vw, 16px)',
                  background: isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.85)',
                  borderRadius: 16,
                  boxShadow: isSelected
                    ? `0 12px 40px ${pos.color}20, 0 0 0 2px ${pos.color}40`
                    : '0 4px 16px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.4s cubic-bezier(.4,0,.2,1)',
                  backdropFilter: 'blur(8px)',
                  animation: `fadeSlideIn 0.5s ${i * 80}ms both`,
                  zIndex: isSelected ? 10 : 1,
                  borderLeft: `3px solid ${pos.color}`,
                  overflow: 'hidden',
                }}>
                <div style={{
                  fontFamily: FONT,
                  fontSize: isSelected ? 17 : 14,
                  fontWeight: 700, color: '#222',
                  marginBottom: 6, lineHeight: 1.4,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: isSelected ? 'normal' : 'nowrap',
                }}>
                  {entry.title}
                </div>

                {isSelected && (
                  <div style={{ animation: 'fadeSlideIn 0.3s both' }}>
                    {entry.plan && (
                      <div style={{
                        fontSize: 13, color: '#444', lineHeight: 1.7,
                        marginBottom: 10, fontFamily: FONT,
                        borderTop: '1px solid #e8e8e8', paddingTop: 10,
                      }}>
                        <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>연구 계획</div>
                        {entry.plan}
                      </div>
                    )}
                    <div style={{
                      fontSize: 13, color: '#555', lineHeight: 1.7,
                      fontFamily: FONT, fontStyle: 'italic',
                    }}>
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 4, fontStyle: 'normal' }}>소회</div>
                      {entry.reflection}
                    </div>
                    <div style={{
                      marginTop: 10, fontSize: 11, color: '#999',
                      display: 'flex', justifyContent: 'space-between',
                    }}>
                      <span>{entry.tags.map(t => `#${t}`).join(' ')}</span>
                      <span>{timeLeft(entry.expiresAt)}</span>
                    </div>

                    {/* Reaction buttons */}
                    <div style={{
                      display: 'flex', gap: 8, marginTop: 12, paddingTop: 12,
                      borderTop: '1px solid #e8e8e8',
                    }}>
                      <button
                        onClick={(e) => handleReact(e, entry.id, 'recycle')}
                        disabled={reacting === `${entry.id}_recycle`}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: 10,
                          border: hasReacted(entry.id, 'recycle') ? '2px solid #222' : '1px solid #ddd',
                          background: hasReacted(entry.id, 'recycle') ? '#FFF44F' : 'rgba(255,255,255,0.8)',
                          cursor: 'pointer',
                          fontSize: 12, fontFamily: FONT, fontWeight: 500,
                          color: '#222', transition: 'all 0.3s',
                          opacity: reacting === `${entry.id}_recycle` ? 0.5 : 1,
                        }}
                      >
                        ♻️ 살릴 수 있어 <span style={{ opacity: 0.5 }}>{entry.recycleCount || 0}</span>
                      </button>
                      <button
                        onClick={(e) => handleReact(e, entry.id, 'rip')}
                        disabled={reacting === `${entry.id}_rip`}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: 10,
                          border: hasReacted(entry.id, 'rip') ? '2px solid #222' : '1px solid #ddd',
                          background: hasReacted(entry.id, 'rip') ? '#FFF44F' : 'rgba(255,255,255,0.8)',
                          cursor: 'pointer',
                          fontSize: 12, fontFamily: FONT, fontWeight: 500,
                          color: '#222', transition: 'all 0.3s',
                          opacity: reacting === `${entry.id}_rip` ? 0.5 : 1,
                        }}
                      >
                        🪦 편히 쉬어 <span style={{ opacity: 0.5 }}>{entry.ripCount || 0}</span>
                      </button>
                    </div>
                  </div>
                )}

                {!isSelected && (
                  <div style={{
                    fontSize: 12, color: '#999',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: FONT, fontStyle: 'italic',
                  }}>
                    {entry.reflection?.slice(0, 40)}…
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
