import os
import json
import fitz  # PyMuPDF
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from docx import Document
import tempfile
import traceback

# --- App Configuration ---

# Serve static files from the React build directory
app = Flask(__name__, static_folder='../client/dist', static_url_path='/')
CORS(app)

# --- Helper Functions (from your original code) ---

def extract_words_from_pdf(pdf_path, page_no=0):
    doc = fitz.open(pdf_path)
    page = doc[page_no]
    words = page.get_text("words")
    spans = []
    for w in words:
        spans.append({
            "x0": w[0], "y0": w[1], 
            "x1": w[2], "y1": w[3],
            "text": w[4],
            "cx": (w[0] + w[2]) / 2,
            "cy": (w[1] + w[3]) / 2
        })
    return spans

def find_nearby_text(spans, x, y, maxdist=50):
    nearby = []
    for span in spans:
        dx = span["cx"] - x
        dy = span["cy"] - y
        dist = (dx*dx + dy*dy) ** 0.5
        if dist <= maxdist:
            nearby.append(span["text"])
    return nearby

# --- API Endpoints ---

@app.route('/api/resolve-balloon', methods=['POST'])
def resolve_balloon():
    """
    Receives a PDF and coordinates, and returns the closest text.
    (This is your well-structured function, kept as is)
    """
    try:
        if 'pdf' not in request.files:
            return jsonify({'error': 'No PDF file provided'}), 400
        
        pdf_file = request.files['pdf']
        x = float(request.form['x'])
        y = float(request.form['y'])
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
            pdf_path = tmp.name
            pdf_file.save(pdf_path)
        
        spans = extract_words_from_pdf(pdf_path)
        nearby = find_nearby_text(spans, x, y)
        
        os.unlink(pdf_path) # Clean up the temporary file
            
        return jsonify({'nearby': nearby})

    except Exception as e:
        print(f"[ERROR] in /api/resolve-balloon: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-report', methods=['POST'])
def generate_report():
    """
    Receives balloon data and populates a .docx template dynamically.
    (This replaces your /fill-doc-template with the robust 'Idea 1' logic)
    """
    output_filename = None # Define to ensure it exists for the finally block
    try:
        # --- 1. Get Data from Frontend ---
        balloons_json = request.form.get('balloons')
        if not balloons_json:
            return jsonify({"error": "No balloon data provided"}), 400
        
        balloon_data = json.loads(balloons_json)
        
        # You can expand this later to get metadata from the frontend too
        metadata = {
            'customer_name': 'POLARIS',
            'part_number': '5419070',
            'report_date': '04/04/2025',
            'quantity': str(len(balloon_data)),
            'prepared_by': 'Sudesh',
            'verified_by': 'Dr. Sushant Maity'
        }

        # --- 2. Load and Prepare the Document ---
        template_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'report_template.docx')
        if not os.path.exists(template_path):
             return jsonify({"error": f"Template file not found at {template_path}"}), 500
        
        doc = Document(template_path)

        # --- 3. Replace Header/Footer Placeholders ---
        for key, value in metadata.items():
            placeholder = f"{{{{{key}}}}}"
            # Replace in all paragraphs
            for p in doc.paragraphs:
                if placeholder in p.text:
                    inline = p.runs
                    for i in range(len(inline)):
                        if placeholder in inline[i].text:
                            inline[i].text = inline[i].text.replace(placeholder, value)
            # Replace in all tables
            for table in doc.tables:
                for row in table.rows:
                    for cell in row.cells:
                        for p in cell.paragraphs:
                            if placeholder in p.text:
                                inline = p.runs
                                for i in range(len(inline)):
                                    if placeholder in inline[i].text:
                                        inline[i].text = inline[i].text.replace(placeholder, value)

        # --- 4. Populate the Dynamic Table ---
        if doc.tables:
            table = doc.tables[0]
            template_row = table.rows[1] # The row with placeholders (e.g., {{id}})
            
            for balloon in balloon_data:
                new_row = table.add_row()
                new_row.cells[0].text = str(balloon.get('id', ''))
                new_row.cells[1].text = balloon.get('text', 'N/A')
                # Add other cells based on your template structure
                new_row.cells[2].text = "Checking Fixture" # Example for Inspection Method
                new_row.cells[3].text = balloon.get('type', '') # Example for Remarks
            
            # Delete the original template row
            tbl = table._tbl
            tr_to_remove = template_row._tr
            tbl.remove(tr_to_remove)

        # --- 5. Save and Send the Final Document ---
        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp:
            output_filename = tmp.name
            doc.save(output_filename)

        return send_file(
            output_filename,
            as_attachment=True,
            download_name='generated_report.docx',
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )

    except Exception as e:
        print(f"[ERROR] in /api/generate-report: {traceback.format_exc()}")
        return jsonify({"error": "An internal server error occurred"}), 500
    finally:
        # Clean up the generated file after sending it
        if output_filename and os.path.exists(output_filename):
            os.remove(output_filename)

# --- Serving the Frontend Application ---

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    """Serves the React frontend. Must be the last route."""
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

# --- Main Execution ---

if __name__ == '__main__':
    # Use 0.0.0.0 to be accessible on the network
    app.run(host='0.0.0.0', port=5000, debug=True)