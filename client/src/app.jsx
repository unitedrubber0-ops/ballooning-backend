import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import "./styles.css";

// Configure PDF.js worker to be self-hosted
pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

export default function App() {
  const [file, setFile] = useState(null);
  const canvasRef = useRef(null);
  const pdfContainerRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [balloons, setBalloons] = useState([]);
  const [selectedType, setSelectedType] = useState('Diameter');
  const [customType, setCustomType] = useState('');
  const [types, setTypes] = useState([
    'Diameter', 'Length', 'Width', 'Height', 'X', 'Y', 'Z', 'Angle', 'Radius'
  ]);
  const [zoomLevel, setZoomLevel] = useState(1.5);
  const [editingBalloonId, setEditingBalloonId] = useState(null);
  const [editText, setEditText] = useState('');

  const handleGenerateReport = async () => {
    if (!balloons || balloons.length === 0) {
      alert('Please add some balloons first');
      return;
    }

    try {
      // 1. Structure the data for the backend
      const reportData = balloons.map(balloon => ({
        id: balloon.id,
        type: balloon.type, // This will go into the 'Remarks' column
        text: balloon.nearby ? balloon.nearby.join(', ') : 'N/A' // The resolved text
      }));

      // 2. Use FormData to send the data
      const formData = new FormData();
      formData.append('balloons', JSON.stringify(reportData));

      // 3. Make the API call to our new endpoint
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      // 4. Handle the file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated_report.docx';
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);

    } catch (error) {
      console.error('Error generating report:', error);
      alert(`Error generating report: ${error.message}`);
    }
  };

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

  const renderPDF = async (pdfFile, zoom) => {
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      
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

    setBalloons(currentBalloons => [...currentBalloons, newBalloon]);

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

  useEffect(() => {
    if (file) {
      renderPDF(file, zoomLevel).then(drawBalloons);
    }
  }, [file, balloons, zoomLevel]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prevZoom => prevZoom + 0.25);
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prevZoom => Math.max(0.25, prevZoom - 0.25));
  }, []);

  useEffect(() => {
    const container = pdfContainerRef.current;
    if (!container) return;

    const handleWheel = (event) => {
      if (event.ctrlKey) {
        event.preventDefault();
        if (event.deltaY < 0) {
          handleZoomIn();
        } else {
          handleZoomOut();
        }
      }
    };
    
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleZoomIn, handleZoomOut]);

  const handleExportPDF = async () => {
    if (!file || !canvasRef.current) return;

    try {
      const canvas = canvasRef.current;
      const imgData = canvas.toDataURL('image/png');
      const a4Width = 595.28;
      const a4Height = 841.89;
      const imgAspect = canvas.width / canvas.height;
      let pdfWidth = a4Width;
      let pdfHeight = a4Width / imgAspect;
      if (pdfHeight > a4Height) {
        pdfHeight = a4Height;
        pdfWidth = a4Height * imgAspect;
      }
      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? 'l' : 'p',
        unit: 'pt',
        format: [a4Width, a4Height]
      });
      const x = (a4Width - pdfWidth) / 2;
      const y = (a4Height - pdfHeight) / 2;
      pdf.addImage(imgData, 'PNG', x, y, pdfWidth, pdfHeight);
      pdf.save(`annotated_${fileName || 'document'}.pdf`);
    } catch (error) {
      console.error('Error exporting annotated PDF:', error);
    }
  };

  const handleStartEditing = (balloon) => {
    setEditingBalloonId(balloon.id);
    setEditText(balloon.type);
  };
  const handleSaveEdit = (balloonId) => {
    setBalloons(balloons.map(b => b.id === balloonId ? { ...b, type: editText } : b));
    setEditingBalloonId(null);
  };
  const handleCancelEdit = () => setEditingBalloonId(null);

  return (
    <div className="container">
      <div className="sidebar">
        <h1>PDF Ballooning Tool</h1>
        
        <div className="upload-section">
          <input type="file" accept=".pdf" onChange={handleFileChange} />
          {fileName && <p>Selected file: {fileName}</p>}
        </div>

        <div className="type-selector">
          <h3>Balloon Type:</h3>
          <select 
            value={selectedType} 
            onChange={(e) => setSelectedType(e.target.value)}
            className="type-dropdown"
          >
            {types.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          
          <form onSubmit={handleAddCustomType} className="custom-type-form">
            <input
              type="text"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              placeholder="Add custom type..."
              className="custom-type-input"
            />
            <button 
              type="submit" 
              className="custom-type-button"
              disabled={!customType || types.includes(customType)}
            >
              Add
            </button>
          </form>
        </div>

        <div className="balloon-list">
          <div className="balloon-header-row">
            <h3>Balloons:</h3>
            {balloons.length > 0 && (
              <button onClick={handleResetBalloons} className="reset-button">
                Reset All
              </button>
            )}
          </div>
          
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
              <button onClick={handleGenerateReport} className="generate-button">Generate Report</button>
            </div>
          )}
        </div>
      </div>
      
      <div className="pdf-container" ref={pdfContainerRef}> 
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