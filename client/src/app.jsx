import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import "./styles.css";

// Configure PDF.js worker to be self-hosted (Fixes the CORS issue)
pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

export default function App() {
  const [file, setFile] = useState(null);
  const canvasRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [balloons, setBalloons] = useState([]);
  const [selectedType, setSelectedType] = useState('Diameter');
  const [customType, setCustomType] = useState('');
  const [types, setTypes] = useState([
    'Diameter', 'Length', 'Width', 'Height', 'X', 'Y', 'Z', 'Angle', 'Radius'
  ]);

  // NEW STATE for Zooming
  const [zoomLevel, setZoomLevel] = useState(1.5);

  // NEW STATE for Editing
  const [editingBalloonId, setEditingBalloonId] = useState(null);
  const [editText, setEditText] = useState('');

  // Download DOCX report with balloon numbers and closest text
  const handleDownloadDocx = async () => {
    try {
      if (!balloons || balloons.length === 0) {
        alert('Please add some balloons first');
        return;
      }
      const balloonsForDoc = balloons.map((balloon) => ({
        id: balloon.id,
        type: balloon.type,
        text: balloon.nearby ? 
              (Array.isArray(balloon.nearby) ? balloon.nearby.join(' ') : balloon.nearby) :
              `Balloon ${balloon.id}`
      }));
      const formData = new FormData();
      formData.append('balloons', JSON.stringify(balloonsForDoc));
      const response = await fetch('/api/fill-doc-template', {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/octet-stream' }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'filled_report.docx';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('DOCX generation error:', error);
      alert(`Error generating DOCX report: ${error.message}`);
    }
  };
  
  const handleAddCustomType = (e) => {
    e.preventDefault();
    if (customType && !types.includes(customType)) {
      setTypes([...types, customType]);
      setSelectedType(customType);
      setCustomType('');
    }
  };

  // MODIFIED renderPDF to accept a zoom level
  const renderPDF = async (pdfFile, zoom) => {
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      
      // Use the passed zoom level
      const viewport = page.getViewport({ scale: zoom });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      console.log('PDF rendered successfully');
      
    } catch (error) {
      console.error('Error rendering PDF:', error);
    }
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setBalloons([]);
    }
  };

  const handleRemoveBalloon = (balloonId) => {
    setBalloons(balloons.filter(balloon => balloon.id !== balloonId));
  };

  const handleResetBalloons = () => {
    setBalloons([]);
  };

  const handleCanvasClick = async (event) => {
    if (!canvasRef.current || !file) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const nx = x / canvas.width;
    const ny = y / canvas.height;
    
    const newBalloon = {
      id: balloons.length > 0 ? Math.max(...balloons.map(b => b.id)) + 1 : 1,
      type: selectedType,
      x: nx,
      y: ny,
      nearby: []
    };

    const tempBalloons = [...balloons, newBalloon];
    setBalloons(tempBalloons);

    try {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('x', x);
      formData.append('y', y);

      const response = await fetch('/api/resolve-balloon', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      
      setBalloons(currentBalloons => 
        currentBalloons.map(b => b.id === newBalloon.id ? { ...b, nearby: data.nearby } : b)
      );
    } catch (error) {
      console.error('Error resolving balloon:', error);
    }
  };

  const drawBalloons = () => {
    const canvas = canvasRef.current;
    if (!canvas || !file) return;
    const context = canvas.getContext('2d');
    
    balloons.forEach(balloon => {
      const x = balloon.x * canvas.width;
      const y = balloon.y * canvas.height;
      
      context.beginPath();
      context.save();
      context.translate(x, y);
      context.scale(1.4, 1);
      context.arc(0, 0, 20, 0, 2 * Math.PI);
      context.restore();
      
      context.fillStyle = 'rgba(255, 255, 255, 0.9)';
      context.fill();
      context.strokeStyle = '#FF0000';
      context.lineWidth = 2.5;
      context.stroke();
      
      context.fillStyle = 'black';
      context.font = 'bold 20px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(balloon.id.toString(), x, y);
    });
  };

  // MODIFIED useEffect to re-render on zoom change
  useEffect(() => {
    if (file) {
      renderPDF(file, zoomLevel).then(drawBalloons);
    }
  }, [file, balloons, zoomLevel]); // Added zoomLevel dependency

  const handleExportPDF = async () => {
    // ... (This function remains the same)
  };

  // NEW FUNCTIONS for Zooming
  const handleZoomIn = () => {
    setZoomLevel(prevZoom => prevZoom + 0.25);
  };

  const handleZoomOut = () => {
    // Prevent zooming out too much
    setZoomLevel(prevZoom => Math.max(0.25, prevZoom - 0.25));
  };

  // NEW FUNCTIONS for Editing
  const handleStartEditing = (balloon) => {
    setEditingBalloonId(balloon.id);
    setEditText(balloon.type);
  };

  const handleSaveEdit = (balloonId) => {
    setBalloons(balloons.map(b => 
      b.id === balloonId ? { ...b, type: editText } : b
    ));
    setEditingBalloonId(null);
    setEditText('');
  };

  const handleCancelEdit = () => {
    setEditingBalloonId(null);
    setEditText('');
  };


  return (
    <div className="container">
      <div className="sidebar">
        <h1>PDF Ballooning Tool</h1>
        {/* ... (upload-section and type-selector are the same) ... */}
        <div className="balloon-list">
          {/* ... (balloon-header-row is the same) ... */}
          
          {/* MODIFIED balloon list to include editing UI */}
          {balloons.map((balloon) => (
            <div key={balloon.id} className="balloon-item">
              <div className="balloon-header">
                <div className="balloon-info">
                  <span className="balloon-label">{balloon.id}</span>
                  {editingBalloonId === balloon.id ? (
                    <div className="balloon-edit-form">
                      <input 
                        type="text" 
                        value={editText} 
                        onChange={(e) => setEditText(e.target.value)} 
                        autoFocus
                      />
                      <button onClick={() => handleSaveEdit(balloon.id)} className="save-button">✓</button>
                      <button onClick={handleCancelEdit} className="cancel-button">×</button>
                    </div>
                  ) : (
                    <>
                      <span className="balloon-type">{balloon.type}</span>
                      <button onClick={() => handleStartEditing(balloon)} className="edit-button">✎</button>
                    </>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveBalloon(balloon.id)}
                  className="remove-balloon-button"
                  title="Remove balloon"
                >
                  ×
                </button>
              </div>
              {balloon.nearby && balloon.nearby.length > 0 && (
                <span className="balloon-text">{balloon.nearby.join(', ')}</span>
              )}
            </div>
          ))}
          {balloons.length > 0 && (
            <div className="button-group">
              <button onClick={handleExportPDF} className="export-button">Export PDF</button>
              <button onClick={handleDownloadDocx} className="generate-button">Generate Report</button>
            </div>
          )}
        </div>
      </div>
      <div className="pdf-container">
        {/* NEW Zoom controls */}
        <div className="zoom-controls">
            <button onClick={handleZoomOut}>-</button>
            <span>{Math.round(zoomLevel * 100)}%</span>
            <button onClick={handleZoomIn}>+</button>
        </div>
        <canvas 
          ref={canvasRef} 
          onClick={handleCanvasClick}
          className="pdf-canvas"
        />
      </div>
    </div>
  );
}