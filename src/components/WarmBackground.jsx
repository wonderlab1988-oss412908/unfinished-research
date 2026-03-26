export default function WarmBackground() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: '#FAFAF7',
      }} />
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '60%',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,244,79,0.06) 0%, transparent 70%)',
        animation: 'floatA 25s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', right: '-10%', width: '55%', height: '55%',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,244,79,0.05) 0%, transparent 70%)',
        animation: 'floatB 30s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', top: '40%', left: '50%', width: '40%', height: '40%',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,244,79,0.04) 0%, transparent 70%)',
        animation: 'floatC 20s ease-in-out infinite',
      }} />
    </div>
  )
}
