const BASE = 'https://ballooning-backend.onrender.com/api'

export async function upload(pdfFile, templateFile) {
  const fd = new FormData()
  fd.append('pdf', pdfFile)
  fd.append('template', templateFile)
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error('Upload failed')
  return res.json()
}

export async function placeBalloon({ pdf, page, nx, ny }) {
  const res = await fetch(`${BASE}/place_balloon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdf, page, nx, ny })
  })
  return res.json()
}

export async function generateDoc({ template, mapping }) {
  try {
    const res = await fetch(`${BASE}/fill-doc-template`, {
      method: 'POST',
      headers: { 'Accept': 'application/octet-stream' },
      body: JSON.stringify({ template, mappings: mapping })
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${res.status}`);
    }
    
    return res.blob();
  } catch (error) {
    console.error('Error generating doc:', error);
    throw error;
  }
}
