# server/ocr.py
import io
from PIL import Image
from pytesseract import image_to_data, Output
import fitz  # PyMuPDF

from .utils import render_pdf_page_to_png_bytes


def pil_image_from_pdf(pdf_path, page_number=0, zoom=2.0):
    """
    Render a page to a PIL image.
    """
    png_bytes = render_pdf_page_to_png_bytes(pdf_path, page_number=page_number, zoom=zoom)
    img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    return img


def image_to_ocr_boxes(pil_image, lang=None, config=None):
    """
    Run pytesseract on a PIL image and return list of boxes:
    [{'left':int,'top':int,'width':int,'height':int,'text':str,'conf':int}, ...]
    """
    data = image_to_data(pil_image, output_type=Output.DICT, lang=lang, config=config or "")
    n = len(data["level"])
    boxes = []
    for i in range(n):
        text = data["text"][i].strip()
        if not text:
            continue
        boxes.append({
            "left": int(data["left"][i]),
            "top": int(data["top"][i]),
            "width": int(data["width"][i]),
            "height": int(data["height"][i]),
            "text": text,
            "conf": int(float(data["conf"][i])) if data["conf"][i].strip() else -1
        })
    return boxes


def pdf_page_to_ocr_boxes(pdf_path, page_number=0, zoom=2.0, lang=None, config=None):
    """
    Render page to image then OCR -> return boxes.
    """
    img = pil_image_from_pdf(pdf_path, page_number=page_number, zoom=zoom)
    return image_to_ocr_boxes(img, lang=lang, config=config)
