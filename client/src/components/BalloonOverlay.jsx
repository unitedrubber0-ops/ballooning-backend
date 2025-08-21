import React, { useState, useEffect } from 'react'

export default function BalloonOverlay({ containerRef, balloons, setBalloons }) {
  const [dragIndex, setDragIndex] = useState(null)
  const [balloonSize, setBalloonSize] = useState(30)  // Default size of 30px

  useEffect(() => {
    const handleMouseUp = () => setDragIndex(null)
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [])

  const handleMouseMove = (e) => {
    if (dragIndex === null) return
    const rect = e.target.getBoundingClientRect()
    const isLandscape = containerRef.current.classList.contains('landscape')
    
    let nx, ny;
    if (isLandscape) {
      nx = (e.clientY - rect.top) / rect.height
      ny = 1 - ((e.clientX - rect.left) / rect.width)
    } else {
      nx = (e.clientX - rect.left) / rect.width
      ny = (e.clientY - rect.top) / rect.height
    }
    
    setBalloons(prev => prev.map((b, i) => i === dragIndex ? { ...b, nx, ny } : b))
  }

  useEffect(() => {
    containerRef.current.addEventListener('mousemove', handleMouseMove)
    return () => containerRef.current.removeEventListener('mousemove', handleMouseMove)
  })

  return (
    <>
      <div className="pdf-controls">
        <div className="balloon-size-control">
          <label>Balloon Size:</label>
          <input
            type="number"
            min="20"
            max="60"
            value={balloonSize}
            onChange={(e) => setBalloonSize(Math.max(20, Math.min(60, e.target.value)))}
          />
          <span>px</span>
        </div>
      </div>
      {balloons.map((b, i) => (
        <div
          key={i}
          className="balloon"
          style={{
            left: `${(b.nx || 0) * 100}%`,
            top: `${(b.ny || 0) * 100}%`,
            width: `${balloonSize}px`,
            height: `${balloonSize}px`,
            fontSize: `${balloonSize * 0.5}px`
          }}
          onMouseDown={() => setDragIndex(i)}
          title={((b.candidates?.numbers || []).join(', '))}
        >{i + 1}</div>
      ))}
    </>
  )
}
