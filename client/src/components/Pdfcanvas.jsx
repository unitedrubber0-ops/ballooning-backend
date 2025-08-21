import React, { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import "react-pdf/dist/Page/TextLayer.css"
import "react-pdf/dist/Page/AnnotationLayer.css"

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

export default function PdfCanvas({ fileUrl, containerRef, onClick }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [orientation, setOrientation] = useState('portrait');
  const [pageSize, setPageSize] = useState({ width: 794, height: 1123 });
  const [autoOrientation, setAutoOrientation] = useState(true);

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
        <div className="orientation-control">
          <label>Orientation:</label>
          <button
            className={`orientation-button ${orientation === 'portrait' ? 'active' : ''}`}
            onClick={() => {
              setOrientation('portrait');
              setAutoOrientation(false);
            }}
          >
            Portrait
          </button>
          <button
            className={`orientation-button ${orientation === 'landscape' ? 'active' : ''}`}
            onClick={() => {
              setOrientation('landscape');
              setAutoOrientation(false);
            }}
          >
            Landscape
          </button>
          <button
            className={`orientation-button ${autoOrientation ? 'active' : ''}`}
            onClick={() => setAutoOrientation(true)}
          >
            Auto
          </button>
        </div>
      </div>
      <div className="pdf-view-container">
        <div 
          ref={containerRef} 
          className={`pdf-canvas ${orientation}`} 
          onClick={e => {
          if (!containerRef.current) return;
          const r = containerRef.current.getBoundingClientRect();
          const rect = e.target.getBoundingClientRect();
          let nx, ny;
          
          if (orientation === 'landscape') {
            // Adjust coordinates for landscape orientation
            nx = (e.clientY - rect.top) / rect.height;
            ny = 1 - ((e.clientX - rect.left) / rect.width);
          } else {
            nx = (e.clientX - rect.left) / rect.width;
            ny = (e.clientY - rect.top) / rect.height;
          }
          
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
            width={containerRef.current ? 
              Math.min(1123, containerRef.current.offsetWidth - 80) : 794
            }
            renderTextLayer={true}
            renderAnnotationLayer={true}
            loading={<div>Loading page...</div>}
            error={<div>Error loading page!</div>}
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
