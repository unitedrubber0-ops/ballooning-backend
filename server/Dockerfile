FROM python:3.11-slim

# System deps for poppler (pdf2image) and tesseract
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    poppler-utils \
    libreoffice \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000
ENV FLASK_ENV=production
CMD ["python", "app.py"]