import React from 'react'

export default function MappingPanel({ balloons, mapping, setMapping, onGenerate }) {
  const update = (key, val) => setMapping(prev => ({ ...prev, [key]: val }))

  return (
    <div className="mapping-panel">
      <h3>Balloon Mappings</h3>
      {balloons.map((b, i) => {
        const key = `{{B${i + 1}}}`
        const suggestion = (b.candidates?.numbers || [])[0] || ''
        return (
          <div key={i} className="mapping-row">
            <div><strong>{key}</strong></div>
            <input type="text" defaultValue={suggestion} onChange={e => update(key, e.target.value)} placeholder="Value" />
          </div>
        )
      })}
      <button onClick={onGenerate}>Generate DOCX</button>
    </div>
  )
}
