import { useState, useEffect, useRef, useMemo } from 'react'

const TAG_COLORS = [
  '#b04a2a', '#2a5ab0', '#6a2ab0', '#2a8a4a',
  '#b02a5a', '#2a8a7a', '#7a5030', '#503070',
  '#307050', '#703050', '#507030', '#305070',
]

const FONT = "'Noto Sans KR', sans-serif"

export default function TagCloud({ tags, onTagClick, selectedTag }) {
  const containerRef = useRef(null)
  const [positions, setPositions] = useState([])

  const sortedTags = useMemo(() => {
    const arr = Object.entries(tags).map(([name, count]) => ({ name, count }))
    arr.sort((a, b) => b.count - a.count)
    return arr
  }, [tags])

  useEffect(() => {
    if (!containerRef.current || sortedTags.length === 0) return
    const rect = containerRef.current.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    const cx = w / 2
    const cy = h / 2
    const placed = []

    const newPositions = sortedTags.map((tag, i) => {
      const maxCount = sortedTags[0].count
      const ratio = tag.count / maxCount
      const fontSize = 18 + ratio * 30
      const estW = tag.name.length * fontSize * 0.7
      const estH = fontSize * 1.6

      let bestX = cx, bestY = cy
      for (let attempt = 0; attempt < 200; attempt++) {
        const angle = (attempt * 137.508 * Math.PI) / 180
        const radius = 8 + attempt * 3.5
        const tx = cx + Math.cos(angle) * radius - estW / 2
        const ty = cy + Math.sin(angle) * radius - estH / 2

        if (tx < 10 || tx + estW > w - 10 || ty < 10 || ty + estH > h - 10) continue

        const overlap = placed.some(p =>
          tx < p.x + p.w + 8 && tx + estW + 8 > p.x &&
          ty < p.y + p.h + 4 && ty + estH + 4 > p.y
        )
        if (!overlap) {
          bestX = tx; bestY = ty; break
        }
      }

      placed.push({ x: bestX, y: bestY, w: estW, h: estH })
      return {
        ...tag, fontSize, x: bestX, y: bestY,
        color: TAG_COLORS[i % TAG_COLORS.length],
        delay: i * 60,
      }
    })

    setPositions(newPositions)
  }, [sortedTags])

  if (sortedTags.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: '#999', fontFamily: FONT,
        fontSize: 16, opacity: 0.7,
      }}>
        아직 아무도 버리지 않았어요. 첫 번째가 되어주세요.
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{
      position: 'relative', width: '100%', height: '100%',
      minHeight: 400, overflow: 'hidden',
    }}>
      {positions.map((p) => (
        <button key={p.name} onClick={() => onTagClick(p.name)} style={{
          position: 'absolute', left: p.x, top: p.y,
          fontSize: p.fontSize,
          color: selectedTag === p.name ? '#222' : p.color,
          background: selectedTag === p.name ? '#FFF44F' : 'transparent',
          border: selectedTag === p.name ? '2px solid #222' : 'none',
          cursor: 'pointer', padding: '4px 10px',
          borderRadius: 20, fontFamily: FONT,
          fontWeight: p.count > 2 ? 700 : 500, whiteSpace: 'nowrap',
          transition: 'all 0.4s cubic-bezier(.4,0,.2,1)',
          opacity: 0, animation: `fadeSlideIn 0.6s ${p.delay}ms forwards`,
          letterSpacing: '-0.02em',
        }}
        onMouseEnter={e => {
          e.target.style.transform = 'scale(1.15)'
          e.target.style.textShadow = `0 0 20px ${p.color}40`
        }}
        onMouseLeave={e => {
          e.target.style.transform = 'scale(1)'
          e.target.style.textShadow = 'none'
        }}
        >
          {p.name}
          <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 4, verticalAlign: 'super' }}>
            {p.count}
          </span>
        </button>
      ))}
    </div>
  )
}
