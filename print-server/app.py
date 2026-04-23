import os
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
import logging
import io
import json
import platform
import datetime
import uuid
import subprocess
import sys
from urllib.parse import urlencode
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode import code128
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader

# Import services (we'll create this next)
from services import PDFProcessingService, PrintService

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# Enable CORS for all domains (essential for Cloudflare hosted frontend)
CORS(app, resources={r"/*": {"origins": "*"}})

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB limit

# Initialize services
pdf_service = PDFProcessingService(upload_folder=UPLOAD_FOLDER)
print_service = PrintService(pdf_service)

DEFAULT_GLOBAL_LAYOUT = {
    'width_in': 1.0,
    'total_height_in': 1.5,
    'top_printable_height_in': 0.5
}

DEFAULT_TEMPLATE_LAYOUTS = {
    'template_1': {
        'logo_x_in': 0.30,
        'logo_top_in': 0.01,
        'logo_width_in': 0.40,
        'logo_height_in': 0.0,
        'line1_font_name': 'Helvetica-Bold',
        'line1_font_size': 6.7,
        'line1_y_in': 0.235,
        'line2_font_name': 'Helvetica-Bold',
        'line2_font_size': 8.5,
        'line2_y_in': 0.145,
        'text_max_width_in': 0.92,
        'barcode_y_in': 0.02,
        'barcode_height_in': 0.08,
        'barcode_bar_width_in': 0.009
    },
    'template_2': {
        'logo_x_in': 0.05,
        'logo_top_in': 0.01,
        'logo_width_in': 0.32,
        'logo_height_in': 0.0,
        'line1_font_name': 'Helvetica-Bold',
        'line1_font_size': 6.5,
        'line1_y_in': 0.225,
        'line2_font_name': 'Helvetica-Bold',
        'line2_font_size': 8.3,
        'line2_y_in': 0.125,
        'text_max_width_in': 0.92,
        'barcode_y_in': 0.02,
        'barcode_height_in': 0.075,
        'barcode_bar_width_in': 0.008
    }
}

ALLOWED_FONT_NAMES = {
    'Helvetica',
    'Helvetica-Bold',
    'Times-Roman',
    'Times-Bold',
    'Courier',
    'Courier-Bold'
}

LOGO_PATH = os.path.join(os.path.dirname(__file__), '..', 'media', 'logo.jpeg')


def _candidate_logo_paths():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        LOGO_PATH,
        os.path.join(base_dir, 'media', 'logo.jpeg'),
        os.path.join(os.getcwd(), 'media', 'logo.jpeg')
    ]

    if getattr(sys, 'frozen', False):
        exe_dir = os.path.dirname(sys.executable)
        candidates.append(os.path.join(exe_dir, 'media', 'logo.jpeg'))

    meipass = getattr(sys, '_MEIPASS', None)
    if meipass:
        candidates.append(os.path.join(meipass, 'media', 'logo.jpeg'))

    seen = set()
    ordered = []
    for path in candidates:
        normalized = os.path.normpath(path)
        if normalized not in seen:
            ordered.append(normalized)
            seen.add(normalized)
    return ordered


def _resolve_logo_path():
    for candidate in _candidate_logo_paths():
        if os.path.exists(candidate):
            return candidate
    return None


def _clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def _normalize_template_type(value):
    candidate = str(value or '').strip().lower()
    if candidate in ('template_2', '2', 'template2'):
        return 'template_2'
    return 'template_1'


def _parse_scan_payload(raw_data):
    payload = (raw_data or '').replace('\n', '').replace('\r', '').strip()
    if not payload:
        raise ValueError('QR data is required')

    parts = payload.split('$')
    if len(parts) != 2:
        raise ValueError('Invalid scan format. Expected <line1>$<line2>.')

    line1 = parts[0].strip().upper()
    line2 = parts[1].strip()

    if not line1 or not line2:
        raise ValueError('Both line 1 and line 2 are required in QR data.')
    if len(line1) not in (15, 16):
        raise ValueError('Line 1 must be 15 or 16 characters.')
    if (not line2.isdigit()) or len(line2) != 10:
        raise ValueError('Line 2 must be exactly 10 digits.')

    return payload, line1, line2


def _to_float(raw, key, default, minimum, maximum):
    try:
        value = float(raw.get(key, default))
    except (TypeError, ValueError, AttributeError):
        value = float(default)
    return _clamp(value, minimum, maximum)


def _sanitize_font_name(value, default):
    candidate = str(value or '').strip()
    return candidate if candidate in ALLOWED_FONT_NAMES else default


def _sanitize_template_layout(template_type, raw_layout):
    defaults = DEFAULT_TEMPLATE_LAYOUTS[template_type]
    raw = raw_layout if isinstance(raw_layout, dict) else {}

    return {
        'logo_x_in': _to_float(raw, 'logo_x_in', defaults['logo_x_in'], 0.0, 0.95),
        'logo_top_in': _to_float(raw, 'logo_top_in', defaults['logo_top_in'], 0.0, 0.49),
        'logo_width_in': _to_float(raw, 'logo_width_in', defaults['logo_width_in'], 0.05, 1.0),
        'logo_height_in': _to_float(raw, 'logo_height_in', defaults['logo_height_in'], 0.0, 0.49),
        'line1_font_name': _sanitize_font_name(raw.get('line1_font_name'), defaults['line1_font_name']),
        'line1_font_size': _to_float(raw, 'line1_font_size', defaults['line1_font_size'], 4.0, 24.0),
        'line1_y_in': _to_float(raw, 'line1_y_in', defaults['line1_y_in'], 0.01, 0.49),
        'line2_font_name': _sanitize_font_name(raw.get('line2_font_name'), defaults['line2_font_name']),
        'line2_font_size': _to_float(raw, 'line2_font_size', defaults['line2_font_size'], 4.0, 24.0),
        'line2_y_in': _to_float(raw, 'line2_y_in', defaults['line2_y_in'], 0.01, 0.49),
        'text_max_width_in': _to_float(raw, 'text_max_width_in', defaults['text_max_width_in'], 0.20, 1.0),
        'barcode_y_in': _to_float(raw, 'barcode_y_in', defaults['barcode_y_in'], 0.0, 0.49),
        'barcode_height_in': _to_float(raw, 'barcode_height_in', defaults['barcode_height_in'], 0.01, 0.30),
        'barcode_bar_width_in': _to_float(raw, 'barcode_bar_width_in', defaults['barcode_bar_width_in'], 0.001, 0.03)
    }


def _sanitize_global_layout(raw_layout):
    raw = raw_layout if isinstance(raw_layout, dict) else {}
    fallback_width = raw.get('width', DEFAULT_GLOBAL_LAYOUT['width_in'])
    fallback_height = raw.get('height', DEFAULT_GLOBAL_LAYOUT['total_height_in'])
    return {
        'width_in': _to_float(raw, 'width_in', fallback_width, 0.5, 8.5),
        'total_height_in': _to_float(raw, 'total_height_in', fallback_height, 0.5, 11.0),
        'top_printable_height_in': _to_float(raw, 'top_printable_height_in', DEFAULT_GLOBAL_LAYOUT['top_printable_height_in'], 0.1, 2.0)
    }


def _build_layout_settings(template_type, label_settings):
    base = label_settings if isinstance(label_settings, dict) else {}
    template_specific = base.get(template_type)
    if isinstance(template_specific, dict):
        merged_raw = {**base, **template_specific}
    else:
        merged_raw = dict(base)

    global_layout = _sanitize_global_layout(merged_raw)
    template_layout = _sanitize_template_layout(template_type, merged_raw)
    return global_layout, template_layout


def _draw_logo(c, template_layout, page_width, top_area_y, top_area_height):
    logo_path = _resolve_logo_path()
    if not logo_path:
        logger.warning("Logo file not found in expected paths: %s", ', '.join(_candidate_logo_paths()))
        return

    try:
        logo = ImageReader(logo_path)
        source_w, source_h = logo.getSize()
        source_ratio = source_h / source_w if source_w else 1.0

        target_w = min(template_layout['logo_width_in'] * inch, page_width)
        configured_h = template_layout['logo_height_in'] * inch
        target_h = configured_h if configured_h > 0 else (target_w * source_ratio)
        target_h = min(target_h, top_area_height)
        if target_w <= 0 or target_h <= 0:
            return
        x = template_layout['logo_x_in'] * inch
        y = top_area_y + top_area_height - (template_layout['logo_top_in'] * inch) - target_h
        x = _clamp(x, 0.0, max(0.0, page_width - target_w))
        y = _clamp(y, top_area_y, top_area_y + top_area_height - target_h)

        c.drawImage(
            logo,
            x,
            y,
            width=target_w,
            height=target_h,
            mask='auto',
            preserveAspectRatio=True
        )
    except Exception as exc:
        logger.warning(f"Failed to draw logo: {exc}")


def _draw_centered_fit_text(c, text, y, page_width, max_width, font_name='Helvetica-Bold', font_size=8.0, min_size=4.0):
    clipped = (text or '')[:40]
    if not clipped:
        return

    current_size = float(font_size)
    while current_size > min_size and c.stringWidth(clipped, font_name, current_size) > max_width:
        current_size -= 0.2

    c.setFillColor(colors.black)
    c.setFont(font_name, current_size)
    c.drawCentredString(page_width / 2, y, clipped)


def generate_qr_label_pdf(data, _label='', label_settings=None, template_type='template_1'):
    if label_settings is None:
        label_settings = {}

    payload, line1, line2 = _parse_scan_payload(data)
    template = _normalize_template_type(template_type)
    global_layout, template_layout = _build_layout_settings(template, label_settings)

    page_width = global_layout['width_in'] * inch
    page_height = global_layout['total_height_in'] * inch
    top_printable_height = min(global_layout['top_printable_height_in'] * inch, page_height)
    top_area_y = page_height - top_printable_height

    packet = io.BytesIO()
    c = canvas.Canvas(packet, pagesize=(page_width, page_height))

    # Full white background ensures transparent-sticker reserved section gets no print content.
    c.setFillColor(colors.white)
    c.rect(0, 0, page_width, page_height, stroke=0, fill=1)

    # Explicitly preserve lower section as blank white (no content area).
    c.setFillColor(colors.white)
    c.rect(0, 0, page_width, top_area_y, stroke=0, fill=1)

    _draw_logo(c, template_layout, page_width, top_area_y, top_printable_height)

    text_max_width = min(template_layout['text_max_width_in'] * inch, max(0.1 * inch, page_width - (0.04 * inch)))
    max_text_y = top_area_y + max(2.0, top_printable_height - 2.0)
    min_text_y = top_area_y + 2.0

    line1_y = _clamp(top_area_y + (template_layout['line1_y_in'] * inch), min_text_y, max_text_y)
    line2_y = _clamp(top_area_y + (template_layout['line2_y_in'] * inch), min_text_y, max_text_y)
    _draw_centered_fit_text(
        c,
        line1,
        line1_y,
        page_width,
        text_max_width,
        font_name=template_layout['line1_font_name'],
        font_size=template_layout['line1_font_size']
    )
    _draw_centered_fit_text(
        c,
        line2,
        line2_y,
        page_width,
        text_max_width,
        font_name=template_layout['line2_font_name'],
        font_size=template_layout['line2_font_size']
    )

    barcode_height = template_layout['barcode_height_in'] * inch
    barcode_base_width = template_layout['barcode_bar_width_in']

    barcode = code128.Code128(line2, barHeight=barcode_height, barWidth=barcode_base_width, humanReadable=False)
    max_barcode_width = max(0.1 * inch, text_max_width)
    if barcode.width > max_barcode_width:
        ratio = max_barcode_width / barcode.width
        barcode = code128.Code128(
            line2,
            barHeight=barcode_height,
            barWidth=max(0.004, barcode_base_width * ratio),
            humanReadable=False
        )

    barcode_x = (page_width - barcode.width) / 2
    barcode_y = _clamp(
        top_area_y + (template_layout['barcode_y_in'] * inch),
        top_area_y,
        top_area_y + max(0.0, top_printable_height - barcode_height)
    )
    barcode.drawOn(c, barcode_x, barcode_y)

    c.setAuthor('QR Label Print Template')
    c.setTitle(f'{template}:{payload}')
    c.showPage()
    c.save()
    packet.seek(0)
    return packet.read()

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'Print Server is running'})

@app.route('/api/printers', methods=['GET'])
def list_printers():
    """List available system printers"""
    try:
        import subprocess
        import platform
        
        printers = []
        default_printer = None
        system = platform.system()
        
        if system == 'Darwin':  # macOS
            # Get list of printers
            result = subprocess.run(['lpstat', '-p'], capture_output=True, text=True)
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    if line.startswith('printer'):
                        parts = line.split()
                        if len(parts) >= 2:
                            printers.append(parts[1])
            
            # Get default printer
            result = subprocess.run(['lpstat', '-d'], capture_output=True, text=True)
            if result.returncode == 0 and 'system default destination:' in result.stdout:
                default_printer = result.stdout.split(':')[-1].strip()
                
        elif system == 'Windows':
            try:
                import win32print
                for p in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS):
                    printers.append(p[2])
                default_printer = win32print.GetDefaultPrinter()
            except ImportError:
                # Fallback to PowerShell
                result = subprocess.run(
                    ['powershell', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name'],
                    capture_output=True, text=True
                )
                if result.returncode == 0:
                    printers = [p.strip() for p in result.stdout.strip().split('\n') if p.strip()]
        else:  # Linux
            result = subprocess.run(['lpstat', '-p'], capture_output=True, text=True)
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    if line.startswith('printer'):
                        parts = line.split()
                        if len(parts) >= 2:
                            printers.append(parts[1])
        
        return jsonify({
            'success': True,
            'printers': printers,
            'default_printer': default_printer
        })
    except Exception as e:
        logger.error(f"Failed to list printers: {e}")
        return jsonify({'success': False, 'error': str(e), 'printers': []})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and file.filename.lower().endswith('.pdf'):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Process PDF
        try:
            result = pdf_service.process_pdf(filepath, filename)
            
            if result.get('is_duplicate'):
                pass # You can decide to treat as error or success with warning
                # For now returning success but with existing ID
                
            return jsonify({
                'success': True,
                'message': 'File uploaded and processed' if not result.get('is_duplicate') else 'File already exists',
                'file_id': result['id'],
                'stats': result['stats'],
                'is_duplicate': result.get('is_duplicate', False)
            })
        except Exception as e:
            logger.error(f"Processing error: {e}")
            return jsonify({'error': str(e)}), 500
            
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/api/documents', methods=['GET'])
def get_documents():
    docs = pdf_service.get_all_documents()
    return jsonify({'success': True, 'documents': docs})

@app.route('/api/documents/<file_id>', methods=['GET', 'DELETE'])
def document_operations(file_id):
    if request.method == 'GET':
        details = pdf_service.get_document_details(file_id)
        if details:
            return jsonify({'success': True, 'details': details})
        return jsonify({'error': 'Document not found'}), 404
        
    elif request.method == 'DELETE':
        success = pdf_service.delete_document(file_id)
        if success:
            return jsonify({'success': True, 'message': 'Document deleted'})
        return jsonify({'error': 'Document not found'}), 404

@app.route('/api/history', methods=['GET'])
def get_history():
    history = pdf_service.get_print_history()
    return jsonify({'success': True, 'history': history})

@app.route('/api/scan/<barcode>', methods=['GET'])
def scan_barcode(barcode):
    try:
        # Search for barcode
        matched_barcode, result = pdf_service.resolve_barcode(barcode)
        if result:
            # Check if this barcode was printed before
            print_count = pdf_service.get_barcode_print_count(barcode)
            last_print = pdf_service.get_last_print_for_barcode(barcode)
            
            return jsonify({
                'success': True,
                'found': True,
                'matched_barcode': matched_barcode,
                'mapping': result,
                'print_count': print_count,
                'last_print': last_print
            })
        else:
            return jsonify({
                'success': True,
                'found': False,
                'message': 'Barcode not found'
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    if not username or not password:
        return jsonify({'success': False, 'error': 'Username and password are required'}), 400

    user = pdf_service.authenticate_user(username, password)
    if not user:
        return jsonify({'success': False, 'error': 'Invalid username or password'}), 401

    return jsonify({'success': True, 'user': user})

@app.route('/api/users', methods=['GET', 'POST'])
def users_collection():
    if request.method == 'GET':
        return jsonify({'success': True, 'users': pdf_service.get_public_users()})

    data = request.json or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    role = data.get('role') or 'user'

    if not username or not password:
        return jsonify({'success': False, 'error': 'Username and password are required'}), 400

    success, error = pdf_service.add_user(username, password, role)
    if not success:
        return jsonify({'success': False, 'error': error}), 400

    return jsonify({'success': True, 'users': pdf_service.get_public_users()})

@app.route('/api/users/<username>', methods=['DELETE'])
def delete_user(username):
    success, error = pdf_service.delete_user(username)
    if not success:
        return jsonify({'success': False, 'error': error}), 400
    return jsonify({'success': True, 'users': pdf_service.get_public_users()})

@app.route('/api/users/<username>/password', methods=['PUT'])
def reset_user_password(username):
    data = request.json or {}
    new_password = data.get('new_password') or ''

    if not new_password:
        return jsonify({'success': False, 'error': 'New password is required'}), 400

    success, error = pdf_service.reset_user_password(username, new_password)
    if not success:
        return jsonify({'success': False, 'error': error}), 400
    return jsonify({'success': True})

@app.route('/api/users/<username>/change-password', methods=['PUT'])
def change_user_password(username):
    data = request.json or {}
    current_password = data.get('current_password') or ''
    new_password = data.get('new_password') or ''

    if not current_password or not new_password:
        return jsonify({'success': False, 'error': 'Current and new password are required'}), 400

    success, error = pdf_service.change_user_password(username, current_password, new_password)
    if not success:
        return jsonify({'success': False, 'error': error}), 400
    return jsonify({'success': True})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get dashboard statistics"""
    try:
        stats = pdf_service.get_dashboard_stats()
        return jsonify({'success': True, 'stats': stats})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/documents/<file_id>/print-stats', methods=['GET'])
def get_document_print_stats(file_id):
    """Get print statistics for a specific document"""
    try:
        stats = pdf_service.get_document_print_stats(file_id)
        if stats:
            return jsonify({'success': True, 'stats': stats})
        return jsonify({'error': 'Document not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/preview/<file_id>/<int:page_num>', methods=['GET'])
def preview_page(file_id, page_num):
    try:
        # Get label settings from query params (for live preview)
        label_settings = {
            'width': float(request.args.get('width', 3.94)),
            'height': float(request.args.get('height', 1.5)),
            'offsetX': float(request.args.get('offsetX', 0)),
            'offsetY': float(request.args.get('offsetY', 0)),
            'scale': float(request.args.get('scale', 100))
        }
        
        # Get processed and/or cropped page image/pdf
        image_bytes = pdf_service.get_page_image(file_id, page_num, label_settings)
        return send_file(
            io.BytesIO(image_bytes),
            mimetype='application/pdf',
            as_attachment=False,
            download_name=f'preview_{page_num}.pdf'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 404

@app.route('/api/print', methods=['POST'])
def print_label():
    data = request.json
    file_id = data.get('file_id')
    page_num = data.get('page_num')
    printer_name = data.get('printer_name')
    label_settings = data.get('label_settings', {})
    username = data.get('username', 'Unknown') # Get username
    
    if not file_id or not page_num:
        return jsonify({'error': 'Missing file_id or page_num'}), 400
        
    try:
        # macOS development mode: do not print physically, only provide preview link
        if platform.system() == 'Darwin':
            doc = pdf_service.documents.get(file_id)
            if not doc:
                return jsonify({'error': 'Document not found'}), 404

            # Validate preview generation for this page/settings
            pdf_service.get_page_image(file_id, page_num, label_settings)

            # Log simulated successful print for testing flow consistency
            pdf_service.log_print_job({
                'id': str(uuid.uuid4()),
                'file_id': file_id,
                'doc_name': doc.get('name', 'Unknown Document'),
                'page_num': page_num,
                'printer': 'Preview (macOS)',
                'status': 'success',
                'timestamp': datetime.datetime.now().isoformat(),
                'error': None,
                'username': username
            })

            return jsonify({
                'success': True,
                'mode': 'preview',
                'message': 'macOS dev mode: preview generated (no physical print).',
                'preview_url': f'/api/preview/{file_id}/{page_num}'
            })

        # Pass username to print service
        success, message = print_service.print_page(file_id, page_num, printer_name, label_settings, username)
        if success:
            return jsonify({'success': True, 'message': message})
        else:
            return jsonify({'success': False, 'error': message}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports/download', methods=['GET'])
def download_report():
    """Generate and download CSV report of print history"""
    try:
        import csv
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow(['Date', 'Time', 'Document', 'Barcode', 'Page', 'User', 'Printer', 'Status', 'Message'])
        
        # Data
        history = pdf_service.get_print_history()
        for job in history:
            timestamp = job.get('timestamp', '')
            date_str = ''
            time_str = ''
            if 'T' in timestamp:
                parts = timestamp.split('T')
                date_str = parts[0]
                time_str = parts[1].split('.')[0]
                
            writer.writerow([
                date_str,
                time_str,
                job.get('filename', 'Unknown'),
                job.get('barcode', 'N/A'),
                job.get('page_num', ''),
                job.get('username', 'Unknown'), # Include username
                job.get('printer', 'Default'),
                job.get('status', ''),
                job.get('message', '')
            ])
            
        output.seek(0)
        
        # Convert string to bytes for send_file
        mem = io.BytesIO()
        mem.write(output.getvalue().encode('utf-8'))
        mem.seek(0)
        
        return send_file(
            mem,
            mimetype='text/csv',
            as_attachment=True,
            download_name='print_history_report.csv'
        )
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/qr/preview', methods=['GET'])
def qr_preview():
    try:
        data = request.args.get('data', '')
        template_type = _normalize_template_type(request.args.get('template_type'))
        raw_layout = request.args.get('layout', '')
        label_settings = {}
        if raw_layout:
            try:
                decoded_layout = json.loads(raw_layout)
                if isinstance(decoded_layout, dict):
                    label_settings = decoded_layout
            except Exception:
                label_settings = {}
        else:
            label_settings = {
                'width_in': request.args.get('width', DEFAULT_GLOBAL_LAYOUT['width_in']),
                'total_height_in': request.args.get('height', DEFAULT_GLOBAL_LAYOUT['total_height_in']),
                'top_printable_height_in': request.args.get('top_printable_height', DEFAULT_GLOBAL_LAYOUT['top_printable_height_in'])
            }
        pdf_bytes = generate_qr_label_pdf(data, label_settings=label_settings, template_type=template_type)
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=False,
            download_name='qr_preview.pdf'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/qr/print', methods=['POST'])
def print_qr_label():
    data = request.json or {}
    qr_data = (data.get('data') or '').strip()
    label = (data.get('label') or '').strip()
    template_type = _normalize_template_type(data.get('template_type'))
    printer_name = data.get('printer_name')
    label_settings = data.get('label_settings') or {}
    username = data.get('username', 'Unknown')

    if not qr_data:
        return jsonify({'success': False, 'error': 'QR data is required'}), 400

    try:
        _parse_scan_payload(qr_data)
    except ValueError as validation_error:
        return jsonify({'success': False, 'error': str(validation_error)}), 400

    job_id = str(uuid.uuid4())
    temp_filename = f"qr_print_{job_id}.pdf"
    timestamp = datetime.datetime.now().isoformat()

    preview_params = urlencode({
        'data': qr_data,
        'template_type': template_type,
        'layout': json.dumps(label_settings)
    })
    preview_url = f"/api/qr/preview?{preview_params}"

    try:
        pdf_bytes = generate_qr_label_pdf(qr_data, label_settings=label_settings, template_type=template_type)

        if platform.system() == 'Darwin':
            pdf_service.log_print_job({
                'id': job_id,
                'file_id': 'qr-template',
                'doc_name': label or 'QR Label',
                'page_num': 1,
                'printer': 'Preview (macOS)',
                'status': 'success',
                'timestamp': timestamp,
                'error': None,
                'username': username,
                'barcode': qr_data,
                'template_type': template_type,
                'message': 'Preview generated'
            })
            return jsonify({
                'success': True,
                'mode': 'preview',
                'message': 'macOS dev mode: preview generated (no physical print).',
                'preview_url': preview_url
            })

        with open(temp_filename, 'wb') as temp_file:
            temp_file.write(pdf_bytes)

        quality_settings = {
            'dpi': label_settings.get('dpi', 600),
            'color_mode': label_settings.get('color_mode', 'grayscale'),
            'sharpening': label_settings.get('sharpening', True),
            'resampling': label_settings.get('resampling', 'lanczos'),
            'contrast': label_settings.get('contrast', 1.0),
            'threshold': label_settings.get('threshold', 128)
        }

        system = platform.system()
        if system == 'Windows':
            if getattr(print_service, '_print_windows_native', None):
                success, message = print_service._print_windows_native(temp_filename, printer_name, quality_settings)
            else:
                success, message = print_service._print_windows_powershell(temp_filename, printer_name)
        else:
            cmd = ['lpr']
            if printer_name:
                cmd.extend(['-P', printer_name])
            cmd.append(temp_filename)
            result = subprocess.run(cmd, capture_output=True, text=True)
            success = result.returncode == 0
            message = 'Printed successfully' if success else f"LPR failed: {result.stderr}"

        pdf_service.log_print_job({
            'id': job_id,
            'file_id': 'qr-template',
            'doc_name': label or 'QR Label',
            'page_num': 1,
            'printer': printer_name or 'Default',
            'status': 'success' if success else 'failed',
            'timestamp': timestamp,
            'error': None if success else message,
            'username': username,
            'barcode': qr_data,
            'template_type': template_type,
            'message': message
        })

        if not success:
            return jsonify({'success': False, 'error': message}), 500
        return jsonify({'success': True, 'message': message})

    except Exception as e:
        logger.error(f"QR print error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        if os.path.exists(temp_filename):
            try:
                os.remove(temp_filename)
            except Exception:
                pass

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
