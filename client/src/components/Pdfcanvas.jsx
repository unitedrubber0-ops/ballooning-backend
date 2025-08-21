import React, { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import "react-pdf/dist/Page/TextLayer.css"
import "react-pdf/dist/Page/AnnotationLayer.css"

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

export default function PdfCanvas({ fileUrl, containerRef, onClick }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [pageSize, setPageSize] = useState({ width: 794, height: 1123 });

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  function onPageLoadSuccess({ width, height }) {
    if (autoOrientation) {
      // Set orientation based on PDF page dimensions
      setOrientation(width > height ? 'landscape' : 'portrait');
    }
    setPageSize({ width, height });
  }
  return (
    <>
      <div className="pdf-controls">
        <div className="zoom-control">
          <label>Zoom:</label>
          <button 
            className="control-button"
            onClick={() => setZoom(prev => Math.max(25, prev - 25))}
          >
            -
          </button>
          <span>{zoom}%</span>
          <button 
            className="control-button"
            onClick={() => setZoom(prev => Math.min(400, prev + 25))}
          >
            +
          </button>
        </div>
        <div className="rotate-control">
          <label>Rotate:</label>
          <button 
            className="control-button"
            onClick={() => setRotation(prev => (prev + 90) % 360)}
          >
            <span style={{ display: 'inline-block', transform: 'rotate(90deg)' }}>↻</span>
          </button>
          <button 
            className="control-button"
            onClick={() => setRotation(0)}
          >
            Reset
          </button>
        </div>
      </div>
      <div className="pdf-view-container">
        <div 
          ref={containerRef} 
          className="pdf-canvas"
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: 'center center'
          }}
          onClick={e => {
            if (!containerRef.current) return;
            const rect = e.target.getBoundingClientRect();
            const rotationRad = (rotation * Math.PI) / 180;
            
            // Get click coordinates relative to the center of the element
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const relativeX = e.clientX - centerX;
            const relativeY = e.clientY - centerY;
            
            // Apply inverse rotation to get original coordinates
            const rotatedX = relativeX * Math.cos(-rotationRad) - relativeY * Math.sin(-rotationRad);
            const rotatedY = relativeX * Math.sin(-rotationRad) + relativeY * Math.cos(-rotationRad);
            
            // Convert back to normalized coordinates
            const nx = (rotatedX / rect.width) + 0.5;
            const ny = (rotatedY / rect.height) + 0.5;
            
            onClick({ nx, ny });
          }}
      >
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div>Loading PDF...</div>}
          error={<div>Error loading PDF!</div>}
        >
          <Page 
            pageNumber={pageNumber}
            className="pdf-page"
            width={794} // A4 width in pixels
            renderTextLayer={true}
            renderAnnotationLayer={true}
            loading={<div>Loading page...</div>}
            error={<div>Error loading page...</div>}
            onLoadSuccess={onPageLoadSuccess}
          />
        </Document>
        <div className="page-info">
          {numPages && <p>Page {pageNumber} of {numPages}</p>}
        </div>
      </div>
    </>
  )
}
