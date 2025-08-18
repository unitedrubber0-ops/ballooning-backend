import React, { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import "react-pdf/dist/Page/TextLayer.css"
import "react-pdf/dist/Page/AnnotationLayer.css"

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

export default function PdfCanvas({ fileUrl, containerRef, onClick }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }
  return (
    <div ref={containerRef} className="pdf-canvas" onClick={e => {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect()
      onClick({ nx: (e.clientX - r.left) / r.width, ny: (e.clientY - r.top) / r.height })
    }}>
      <Document
        file={fileUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={<div>Loading PDF...</div>}
        error={<div>Error loading PDF!</div>}
      >
        <Page 
          pageNumber={pageNumber} 
          width={800} 
          renderTextLayer={true}
          renderAnnotationLayer={true}
          loading={<div>Loading page...</div>}
          error={<div>Error loading page!</div>}
        />
      </Document>
      <div className="page-info">
        {numPages && <p>Page {pageNumber} of {numPages}</p>}
      </div>
    </div>
  )
}
