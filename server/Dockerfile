FROM python:3.11-slim

# System deps for poppler (pdf2image) and tesseract
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    poppler-utils \
    libreoffice \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy the rest of the application
COPY . .

# Create uploads directory
RUN mkdir -p uploads && chmod 777 uploads

# Expose the port the app runs on
EXPOSE 5000

# Environment variables
ENV FLASK_APP=app.py
ENV FLASK_ENV=production

# Start with gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]