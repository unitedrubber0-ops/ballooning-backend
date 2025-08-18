import fitz
from pdf2image import convert_from_path
import pytesseract
import os

# Return words with (x0,y0,x1,y1,text) in PDF coordinate space

def ocr_page_words(pdf_path, page_index=0, dpi=300, tesseract_cmd=None):
    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    # Render page to image
    doc = fitz.open(pdf_path)
    page = doc[page_index]
    pix = page.get_pixmap(dpi=dpi)
    img_w, img_h = pix.width, pix.height
    # Save to temp in-memory-like path via PIL-free route: use pdf2image for better fidelity
    images = convert_from_path(pdf_path, dpi=dpi, first_page=page_index+1, last_page=page_index+1)
    if len(images) == 0:
        raise RuntimeError("Failed to rasterize PDF page for OCR")
    img = images[0]

    data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    words = []
    for i in range(len(data["text"])):
        txt = data["text"][i]
        if not txt.strip():
            continue
        x, y, w, h = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
        # map image pixels back to PDF points
        pdf_x0 = x * (page.rect.width / img_w)
        pdf_y0 = y * (page.rect.height / img_h)
        pdf_x1 = (x + w) * (page.rect.width / img_w)
        pdf_y1 = (y + h) * (page.rect.height / img_h)
        words.append({
            "x0": pdf_x0, "y0": pdf_y0, "x1": pdf_x1, "y1": pdf_y1,
            "text": txt, "cx": (pdf_x0 + pdf_x1)/2, "cy": (pdf_y0 + pdf_y1)/2
        })
    return {"page_width": page.rect.width, "page_height": page.rect.height, "spans": words}