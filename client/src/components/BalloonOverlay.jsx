import React, { useState, useEffect } from 'react'

export default function BalloonOverlay({ containerRef, balloons, setBalloons }) {
  const [dragIndex, setDragIndex] = useState(null)

  useEffect(() => {
    const handleMouseUp = () => setDragIndex(null)
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [])

  const handleMouseMove = (e) => {
    if (dragIndex === null) return
    const r = containerRef.current.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width
    const ny = (e.clientY - r.top) / r.height
    setBalloons(prev => prev.map((b, i) => i === dragIndex ? { ...b, nx, ny } : b))
  }

  useEffect(() => {
    containerRef.current.addEventListener('mousemove', handleMouseMove)
    return () => containerRef.current.removeEventListener('mousemove', handleMouseMove)
  })

  return (
    <>
      {balloons.map((b, i) => (
        <div
          key={i}
          className="balloon"
          style={{ left: `${(b.nx || 0) * 100}%`, top: `${(b.ny || 0) * 100}%` }}
          onMouseDown={() => setDragIndex(i)}
          title={((b.candidates?.numbers || []).join(', '))}
        >{i + 1}</div>
      ))}
    </>
  )
}
