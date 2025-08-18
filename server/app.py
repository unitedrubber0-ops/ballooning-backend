
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import os
import re
import uuid
import json
import shutil
import tempfile
import traceback
from docx import Document
import fitz  # PyMuPDF
from pathlib import Path

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})

def validate_doc_template(path):
    """Validate that the template file has the expected structure."""
    try:
        doc = Document(path)
        if not doc.tables:
            return False, "Template has no tables"
        table = doc.tables[0]
        if len(table.rows) < 2:
            return False, "Table has insufficient rows"
        if any(len(row.cells) < 2 for row in table.rows):
            return False, "Some rows have insufficient cells"
        return True, None
    except Exception as e:
        return False, f"Failed to read template: {str(e)}"

def extract_words_from_pdf(pdf_path, page_no=0):
    doc = fitz.open(pdf_path)
    page = doc[page_no]
    words = page.get_text("words")  # list of tuples -> (x0, y0, x1, y1, "word", block_no, line_no, word_no)
    spans = []
    for w in words:
        spans.append({
            "x0": w[0], "y0": w[1], 
            "x1": w[2], "y1": w[3],
            "text": w[4],
            "cx": (w[0]+w[2])/2,
            "cy": (w[1]+w[3])/2
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

@app.route('/api/resolve-balloon', methods=['POST'])
def resolve_balloon():
    try:
        print("[INFO] Received resolve-balloon request")
        if 'pdf' not in request.files:
            return jsonify({'error': 'No PDF file'}), 400
        
        pdf_file = request.files['pdf']
        x = float(request.form['x'])
        y = float(request.form['y'])
        
        # Save PDF temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
            pdf_file.save(tmp.name)
            spans = extract_words_from_pdf(tmp.name)
            nearby = find_nearby_text(spans, x, y)
            os.unlink(tmp.name)
            
        return jsonify({'nearby': nearby})
    except Exception as e:
        print("[ERROR] Exception in resolve_balloon:")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# ...existing code...


@app.route('/api/fill-doc-template', methods=['POST'])
def fill_doc_template():
    temp_files = []  # Keep track of temporary files to clean up
    try:
        print("[INFO] Received request to /api/fill-doc-template")
        
        # Get and parse balloon data
        balloons_raw = request.form.get('balloons')
        if not balloons_raw:
            print("[ERROR] No balloon data provided")
            return jsonify({'error': 'No balloon data provided'}), 400
            
        try:
            balloons = json.loads(balloons_raw)
            print(f"[INFO] Parsed balloons: {json.dumps(balloons, indent=2)}")
        except json.JSONDecodeError as e:
            print(f"[ERROR] Failed to parse balloon data: {e}")
            return jsonify({'error': 'Invalid balloon data format'}), 400
        
        # Look for template file
        root_dir = Path(__file__).parent.parent
        template_files = [
            root_dir / 'Dimensional report-.doc',
            root_dir / 'Dimensional Report - 1244890.doc'
        ]
        
        # Find and validate template
        template_path = None
        template_error = None
        
        for path in template_files:
            print(f"[INFO] Checking template at: {path}")
            if path.exists():
                is_valid, error = validate_doc_template(str(path))
                if is_valid:
                    template_path = path
                    print(f"[INFO] Found valid template at: {path}")
                    break
                else:
                    template_error = error
                    print(f"[WARNING] Invalid template at {path}: {error}")

        if not template_path:
            error_msg = template_error or "Template file not found"
            print(f"[ERROR] {error_msg}")
            return jsonify({'error': error_msg}), 404

        print(f"[INFO] Using template: {template_path}")
        
        # Create working copy with .docx extension if needed
        work_path = Path(tempfile.gettempdir()) / f"template_{uuid.uuid4()}"
        if template_path.suffix.lower() == '.doc':
            work_path = work_path.with_suffix('.docx')
            # Convert .doc to .docx using python-docx
            doc = Document(str(template_path))
            doc.save(str(work_path))
        else:
            work_path = work_path.with_suffix(template_path.suffix)
            shutil.copy2(template_path, work_path)
        
        temp_files.append(work_path)
        print(f"[INFO] Created working copy at: {work_path}")
        
        # Create output path
        output_path = Path(tempfile.gettempdir()) / f"filled_{uuid.uuid4()}.docx"
        print(f"[INFO] Will save output to: {output_path}")
        
        try:
            # Load and process the document
            doc = Document(str(work_path))
            
            # Map balloon id to text
            balloon_map = {str(b['id']): b.get('text', '') for b in balloons}
            print(f"[INFO] Processing balloons: {balloon_map}")
            
            if not doc.tables:
                print("[ERROR] No tables found in template")
                return jsonify({'error': 'Template has no tables'}), 400
                
            # Get the first table
            table = doc.tables[0]
            print(f"[INFO] Found table with {len(table.rows)} rows")
            
            # Process each row after the header
            for i, row in enumerate(table.rows[1:], 1):
                try:
                    # Ensure row has at least 2 cells
                    if len(row.cells) < 2:
                        print(f"[WARNING] Row {i} has insufficient cells, skipping")
                        continue
                        
                    # Get the cells we need
                    id_cell = row.cells[0]
                    value_cell = row.cells[1]
                    
                    # Clean the ID cell text
                    id_text = id_cell.text.strip()
                    print(f"[INFO] Processing row {i}, ID text: {id_text}")
                    
                    # Try to match with a balloon
                    if id_text in balloon_map:
                        value_cell.text = balloon_map[id_text]
                        print(f"[INFO] Matched balloon {id_text} -> {balloon_map[id_text]}")
                    else:
                        # Try to extract a number and match that
                        numbers = re.findall(r'\d+', id_text)
                        if numbers and numbers[0] in balloon_map:
                            value_cell.text = balloon_map[numbers[0]]
                            print(f"[INFO] Matched number {numbers[0]} -> {balloon_map[numbers[0]]}")
                        else:
                            print(f"[INFO] No match for ID: {id_text}")
                            
                except Exception as cell_error:
                    print(f"[WARNING] Error processing row {i}: {cell_error}")
                    continue

            # Save the modified document
            doc.save(str(output_path))
            temp_files.append(output_path)
            
            # Return the file
            print(f"[INFO] Sending filled document: {output_path}")
            response = send_file(
                str(output_path),
                mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                as_attachment=True,
                download_name='filled_report.docx'
            )
            
            # Clean up temporary files after sending
            for temp_file in temp_files:
                try:
                    if temp_file.exists():
                        temp_file.unlink()
                        print(f"[INFO] Cleaned up temporary file: {temp_file}")
                except Exception as cleanup_error:
                    print(f"[WARNING] Failed to clean up {temp_file}: {cleanup_error}")
            
            return response
            
        except Exception as doc_error:
            print(f"[ERROR] Failed to process document: {doc_error}")
            traceback.print_exc()
            return jsonify({'error': str(doc_error)}), 500
            
    except Exception as e:
        print(f"[ERROR] Main exception in fill_doc_template: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        # Clean up temporary files
        for temp_file in temp_files:
            try:
                if temp_file.exists():
                    temp_file.unlink()
                    print(f"[INFO] Cleaned up temporary file: {temp_file}")
            except Exception as cleanup_error:
                print(f"[WARNING] Failed to clean up {temp_file}: {cleanup_error}")

if __name__ == '__main__':
    print("Starting Flask server...")
    app.run(host='127.0.0.1', port=5000, debug=True)

# Helper function to convert .doc to .docx if needed
def convert_doc_to_docx(path):
    # requires libreoffice soffice on server
    if path.lower().endswith('.doc'):
        out = os.path.splitext(path)[0] + '.docx'
        subprocess.run(['soffice', '--headless', '--convert-to', 'docx', path, '--outdir', os.path.dirname(path)], check=True)
        return out
    return path

def extract_words_from_pdf(pdf_path, page_no=0):
    doc = fitz.open(pdf_path)
    page = doc[page_no]
    words = page.get_text("words")  # list of tuples -> (x0, y0, x1, y1, "word", block_no, line_no, word_no)
    # convert to dicts
    spans = []
    for w in words:
        spans.append({
            "x0": w[0], "y0": w[1], "x1": w[2], "y1": w[3],
            "text": w[4],
            "cx": (w[0]+w[2])/2,
            "cy": (w[1]+w[3])/2
        })
    page_width = page.rect.width
    page_height = page.rect.height
    return {"page_width": page_width, "page_height": page_height, "spans": spans}

def find_nearby_text(spans, x, y, maxdist=50):
    # x,y are PDF coordinates (points)
    def dist(s):
        dx = s["cx"] - x
        dy = s["cy"] - y
        return (dx*dx + dy*dy)**0.5
    spans_sorted = sorted(spans, key=lambda s: dist(s))
    # return top few within maxdist
    result = [s for s in spans_sorted if dist(s) <= maxdist]
    if not result and spans_sorted:
        # fallback to top 3
        result = spans_sorted[:3]
    return result

def parse_dimensional_doc(doc_path):
    # convert .doc -> .docx first if needed
    docx_path = convert_doc_to_docx(doc_path)
    doc = Document(docx_path)
    # this simple parser extracts any numeric tokens from paragraphs/tables
    numbers = []
    for table in doc.tables:
        # iterate table to try to find columns: 'Sr. No', 'Description', 'Observed values'
        for r in table.rows:
            row_text = [c.text.strip() for c in r.cells]
            numbers.append(" | ".join(row_text))
    for p in doc.paragraphs:
        if re.search(r'\d+(\.\d+)?', p.text):
            numbers.append(p.text.strip())
    return numbers

@app.route('/upload', methods=['POST'])
def upload():
    f_pdf = request.files.get('pdf')
    f_doc = request.files.get('template')
    if not f_pdf or not f_doc:
        return jsonify({"error": "pdf and template required"}), 400
    pdf_name = os.path.join(UPLOAD_DIR, str(uuid.uuid4()) + "_" + f_pdf.filename)
    doc_name = os.path.join(UPLOAD_DIR, str(uuid.uuid4()) + "_" + f_doc.filename)
    f_pdf.save(pdf_name)
    f_doc.save(doc_name)
    return jsonify({"pdf": pdf_name, "doc": doc_name})

@app.route('/spans', methods=['GET'])
def spans():
    pdf = request.args.get('pdf')
    page = int(request.args.get('page', 0))
    data = extract_words_from_pdf(pdf, page)
    return jsonify(data)

@app.route('/place_balloon', methods=['POST'])
def place_balloon():
    # frontend sends normalized coords nx, ny (0..1), page, pdf path, balloon_label
    body = request.json
    pdf = body['pdf']
    page_no = int(body.get('page', 0))
    nx = float(body['nx'])
    ny = float(body['ny'])
    balloon = body.get('label', None)
    # get page dims
    data = extract_words_from_pdf(pdf, page_no)
    w = data['page_width']; h = data['page_height']
    px = nx * w
    py = ny * h
    nearby = find_nearby_text(data['spans'], px, py, maxdist=max(w,h)*0.03)  # scaled tolerance
    nearby_text = [s['text'] for s in nearby]
    return jsonify({"px": px, "py": py, "nearby": nearby_text, "balloon": balloon})

@app.route('/generate_doc', methods=['POST'])
def generate_doc():
    body = request.json
    template_path = body['template_path']
    mappings = body.get('mappings', {})  # e.g. {"B1": "14.76", "B2": "7.72"}
    # convert template if .doc
    docx_path = convert_doc_to_docx(template_path)
    out_path = os.path.join(UPLOAD_DIR, "filled_" + str(uuid.uuid4()) + ".docx")
    doc = Document(docx_path)
    # naive replace in paragraphs and tables
    def replace_in_paragraph(paragraph, old, new):
        for run in paragraph.runs:
            if old in run.text:
                run.text = run.text.replace(old, new)
    for para in doc.paragraphs:
        for k, v in mappings.items():
            if k in para.text:
                replace_in_paragraph(para, k, v)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for k, v in mappings.items():
                    if k in cell.text:
                        cell.text = cell.text.replace(k, v)
    doc.save(out_path)
    return jsonify({"out_path": out_path})

@app.route('/download', methods=['GET'])
def download():
    path = request.args.get('path')
    return send_file(path, as_attachment=True)

@app.route('/')
def index():
    return "Welcome to the Ballooning App!"


if __name__ == '__main__':
    app.run(debug=True)
