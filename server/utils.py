# server/utils.py
import os
import io
from pathlib import Path
import uuid

import fitz  # PyMuPDF

UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)


def ensure_upload_dir():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return UPLOAD_DIR


def save_uploaded_file(file_storage, filename=None):
    """
    file_storage: Werkzeug FileStorage (what Flask gives you)
    returns: path to saved file (Path)
    """
    ensure_upload_dir()
    if filename is None:
        ext = Path(file_storage.filename).suffix or ""
        filename = f"{uuid.uuid4().hex}{ext}"
    out_path = UPLOAD_DIR / filename
    file_storage.save(out_path)
    return out_path


def render_pdf_page_to_png_bytes(pdf_path, page_number=0, zoom=2.0):
    """
    Render page (0-indexed) to PNG bytes using PyMuPDF.
    zoom: scaling factor (2.0 => 200%).
    Returns: bytes (PNG)
    """
    doc = fitz.open(str(pdf_path))
    if page_number < 0 or page_number >= doc.page_count:
        raise IndexError("page_number out of range")
    page = doc.load_page(page_number)
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)  # alpha False gives RGB PNG
    png_bytes = pix.tobytes("png")
    doc.close()
    return png_bytes


def get_pdf_page_count(pdf_path):
    doc = fitz.open(str(pdf_path))
    try:
        return doc.page_count
    finally:
        doc.close()


def extract_text_blocks_mupdf(pdf_path, page_number=0):
    """
    Use PyMuPDF to extract text blocks with coordinates.
    Returns list of dicts: { 'x0','y0','x1','y1','text' }
    Coordinates are in PDF points (bottom-left origin for PDF; PyMuPDF returns top-left origin for text blocks).
    """
    doc = fitz.open(str(pdf_path))
    page = doc.load_page(page_number)
    blocks = page.get_text("blocks")  # list of (x0, y0, x1, y1, "text", block_no, block_type)
    results = []
    for b in blocks:
        x0, y0, x1, y1, text = b[0], b[1], b[2], b[3], b[4]
        # normalize text
        text = text.strip()
        if not text:
            continue
        results.append({"x0": x0, "y0": y0, "x1": x1, "y1": y1, "text": text})
    doc.close()
    return results
