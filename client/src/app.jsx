import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import "./styles.css";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

export default function App() {
  const [file, setFile] = useState(null);
  const canvasRef = useRef(null);
  const [scale] = useState(1.5);
  const [fileName, setFileName] = useState('');
  const [balloons, setBalloons] = useState([]);
  const [selectedType, setSelectedType] = useState('Diameter');
  const [customType, setCustomType] = useState('');
  const [types, setTypes] = useState([
    'Diameter',
    'Length',
    'Width',
    'Height',
    'X',
    'Y',
    'Z',
    'Angle',
    'Radius'
  ]);

  // Download DOCX report with balloon numbers and closest text
  const handleDownloadDocx = async () => {
    try {
      if (!balloons || balloons.length === 0) {
        alert('Please add some balloons first');
        return;
      }

      console.log('Starting DOCX download process...');
      
      // Prepare balloon data
      const balloonsForDoc = balloons.map((balloon, index) => ({
        id: index + 1,
        text: balloon.nearby ? 
              (Array.isArray(balloon.nearby) ? balloon.nearby.join(' ') : balloon.nearby) :
              balloon.text || `Balloon ${index + 1}`
      }));

      console.log('Prepared balloon data:', balloonsForDoc);

      const formData = new FormData();
      formData.append('balloons', JSON.stringify(balloonsForDoc));
      console.log('Sending request to backend...');
      const response = await fetch('/api/fill-doc-template', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/octet-stream',
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Server error response:', response.status, errorData);
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      console.log('Got response from server, reading blob...');
      const blob = await response.blob();
      console.log('Received blob of type:', blob.type);

      console.log('Creating download URL...');
      const url = window.URL.createObjectURL(blob);
      
      console.log('Triggering download...');
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'filled_report.docx';
      document.body.appendChild(a);
      a.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        console.log('Download cleanup completed');
      }, 100);
      
      console.log('DOCX download initiated');
    } catch (error) {
      console.error('DOCX generation error:', error);
      alert(`Error generating DOCX report: ${error.message}`);
      throw error; // Re-throw for error boundary
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

  const resolveBalloonText = async (balloon) => {
    if (!file) return;
    
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('x', balloon.nx * canvasRef.current.width);
    formData.append('y', balloon.ny * canvasRef.current.height);
    
    try {
      const response = await fetch('/api/resolve-balloon', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Failed to resolve balloon text');
      
      const data = await response.json();
      return data.nearby || [];
    } catch (error) {
      console.error('Error resolving balloon text:', error);
      return [];
    }
  };

  const renderPDF = async (pdfFile) => {
    try {
      // Load the PDF file
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      // Get the first page
      const page = await pdf.getPage(1);
      
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Set canvas dimensions
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Render PDF page into canvas context
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
      setBalloons([]); // Reset balloons when new file is selected
      renderPDF(selectedFile);
    }
  };

  const handleRemoveBalloon = (balloonId) => {
    setBalloons(balloons.filter(balloon => balloon.id !== balloonId));
  };

  const handleResetBalloons = () => {
    setBalloons([]);
  };

  const handleCanvasClick = async (event) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Calculate normalized coordinates
    const nx = x / canvas.width;
    const ny = y / canvas.height;
    
    const newBalloon = {
      id: balloons.length + 1,
      type: selectedType,
      x: nx,
      y: ny,
      nearby: []
    };

    setBalloons([...balloons, newBalloon]);

    // Call backend to resolve text near balloon
    try {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('x', nx * canvas.width); // Convert to absolute coordinates
      formData.append('y', ny * canvas.height); // Convert to absolute coordinates

      const response = await fetch('/api/resolve-balloon', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      // Update balloon with resolved text
      const updatedBalloons = [...balloons, { ...newBalloon, nearby: data.nearby }];
      setBalloons(updatedBalloons);
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
      
      // Draw oval
      context.beginPath();
      context.save();
      context.translate(x, y);
      context.scale(1.4, 1); // Make it oval by scaling x more than y
      context.arc(0, 0, 20, 0, 2 * Math.PI); // Increased radius from 15 to 20
      context.restore();
      
      // Fill with white and red border
      context.fillStyle = 'rgba(255, 255, 255, 0.9)';
      context.fill();
      context.strokeStyle = '#FF0000'; // Changed to red
      context.lineWidth = 2.5; // Slightly thicker border
      context.stroke();
      
      // Draw just the number
      context.fillStyle = 'black';
      context.font = 'bold 20px Arial'; // Increased from 16px to 20px
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(balloon.id.toString(), x, y);
    });
  };

  // Re-render PDF and balloons whenever they change
  useEffect(() => {
    if (file) {
      renderPDF(file).then(drawBalloons);
    }
  }, [file, balloons]);

  const handleExportPDF = async () => {
    if (!file || !canvasRef.current) return;

    try {
      const canvas = canvasRef.current;
      const imgData = canvas.toDataURL('image/png');

      // A4 size in points
      const a4Width = 595.28;
      const a4Height = 841.89;
      // Calculate aspect ratio
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

      // Center the image on the page
      const x = (a4Width - pdfWidth) / 2;
      const y = (a4Height - pdfHeight) / 2;
      pdf.addImage(imgData, 'PNG', x, y, pdfWidth, pdfHeight);
      pdf.save(`annotated_${fileName || 'document'}.pdf`);
    } catch (error) {
      console.error('Error exporting annotated PDF:', error);
    }
  };

  const generateReport = async () => {
    try {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('balloons', JSON.stringify(balloons));

      const response = await fetch('/api/generate-doc', {
        method: 'POST',
        body: formData
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'filled_report.docx';
      a.click();
    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

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
          {balloons.map((balloon, index) => (
            <div key={index} className="balloon-item">
              <div className="balloon-header">
                <div className="balloon-info">
                  <span className="balloon-label">{balloon.id}</span>
                  <span className="balloon-type">{balloon.type}</span>
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
              <button onClick={handleExportPDF} className="export-button">
                Export PDF
              </button>
              <button onClick={generateReport} className="generate-button">
                Generate Report
              </button>
              <button onClick={handleDownloadDocx} className="generate-button">
                Download DOCX Report
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="pdf-container">
        <canvas 
          ref={canvasRef} 
          onClick={handleCanvasClick}
          className="pdf-canvas"
        />
      </div>
    </div>
  );
}
