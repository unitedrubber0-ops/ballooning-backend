import os
import json
import fitz  # PyMuPDF
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from docx import Document
from docx.table import _Row
from docx.oxml.ns import qn
import tempfile
import traceback

# --- App Configuration ---
app = Flask(__name__, static_folder='../client/dist', static_url_path='/')
CORS(app)

# --- Helper Functions ---

def extract_words_from_pdf(pdf_path, page_no=0):
    # This function is working well, no changes needed.
    doc = fitz.open(pdf_path); page = doc[page_no]; words = page.get_text("words")
    spans = [{"x0": w[0], "y0": w[1], "x1": w[2], "y1": w[3], "text": w[4], "cx": (w[0] + w[2]) / 2, "cy": (w[1] + w[3]) / 2} for w in words]
    return spans

def find_nearby_text(spans, x, y, maxdist=50):
    # This function is working well, no changes needed.
    nearby = [span["text"] for span in spans if ((span["cx"] - x)**2 + (span["cy"] - y)**2)**0.5 <= maxdist]
    return nearby

# --- API Endpoints ---

@app.route('/api/resolve-balloon', methods=['POST'])
def resolve_balloon():
    # This endpoint is working well, no changes needed.
    try:
        if 'pdf' not in request.files: return jsonify({'error': 'No PDF file provided'}), 400
        pdf_file = request.files['pdf']; x = float(request.form['x']); y = float(request.form['y'])
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
            pdf_path = tmp.name; pdf_file.save(pdf_path)
        spans = extract_words_from_pdf(pdf_path)
        nearby = find_nearby_text(spans, x, y)
        os.unlink(pdf_path)
        return jsonify({'nearby': nearby})
    except Exception as e:
        print(f"[ERROR] in /api/resolve-balloon: {traceback.format_exc()}"); return jsonify({'error': str(e)}), 500

# In server/app.py, replace the existing generate_report function with this one.

# In server/app.py, replace the existing generate_report function with this one.

@app.route('/api/generate-report', methods=['POST'])
def generate_report():
    output_filename = None
    try:
        print("\n--- [INFO] Received /api/generate-report request ---")
        
        balloons_json = request.form.get('balloons')
        if not balloons_json:
            print("[ERROR] No balloon data received."); return jsonify({"error": "No balloon data provided"}), 400
        
        balloon_data = json.loads(balloons_json)
        print(f"[DEBUG] Received {len(balloon_data)} balloons.")

        template_path = "report_template.docx"
        if not os.path.exists(template_path):
             print(f"[ERROR] Template file not found at: {template_path}"); return jsonify({"error": "Template not found"}), 500
        
        doc = Document(template_path)
        print(f"[INFO] Loaded template: {template_path}")

        table = doc.tables[0]
        template_row = table.rows[1]
        
        print(f"[INFO] Found table. Template row has {len(template_row.cells)} cells.")

        for balloon in balloon_data:
            new_row = table.add_row()
            # Copy cells to preserve structure, formatting, AND the static text
            for i, cell in enumerate(template_row.cells):
                for paragraph in cell.paragraphs:
                    # This copies everything from the template cell, including "OK"
                    new_para = new_row.cells[i].add_paragraph(paragraph.text)

            # Define ONLY the replacements for the dynamic placeholders
            replacements = {
                '{{id}}': str(balloon.get('id', '')),
                '{{text}}': balloon.get('text', 'N/A'),
                '{{spec}}': "As per Drg.",
                '{{spec_drg}}': "As per Drg.",
                '{{UOM}}': "mm"
            }
            
            # Replace placeholders in the newly created row
            for cell in new_row.cells:
                for key, value in replacements.items():
                    for p in cell.paragraphs:
                        if key in p.text:
                            inline = p.runs
                            for i in range(len(inline)):
                                if key in inline[i].text:
                                    inline[i].text = inline[i].text.replace(key, value)
        
        # Delete the original template row
        tr_to_remove = template_row._element
        tr_to_remove.getparent().remove(tr_to_remove)
        print(f"[INFO] Populated table with {len(balloon_data)} new rows.")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp:
            output_filename = tmp.name
            doc.save(output_filename)

        return send_file(
            output_filename, as_attachment=True, download_name='generated_report.docx',
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )

    except Exception as e:
        print(f"[FATAL ERROR] in /api/generate-report: {traceback.format_exc()}"); return jsonify({"error": "Server error"}), 500
    finally:
        if output_filename and os.path.exists(output_filename):
            os.remove(output_filename)
        print("--- [INFO] Request finished. ---\n")

# --- Serving the Frontend ---
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

# --- Main Execution ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)