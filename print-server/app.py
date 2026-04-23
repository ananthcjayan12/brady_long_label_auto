import os
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
import logging
import io
import platform
import datetime
import uuid
import subprocess
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode import qr as qrbarcode
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

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


def _clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def generate_qr_label_pdf(data, label, label_settings=None):
    if label_settings is None:
        label_settings = {}

    width = _clamp(float(label_settings.get('width', 3.94)), 1.0, 8.5)
    height = _clamp(float(label_settings.get('height', 2.0)), 1.0, 11.0)

    data = (data or '').strip()
    label = (label or '').strip()
    if not data:
        raise ValueError('QR data is required')

    packet = io.BytesIO()
    c = canvas.Canvas(packet, pagesize=(width * inch, height * inch))

    margin = 0.12 * inch
    label_height = 0.26 * inch if label else 0
    available_width = (width * inch) - (2 * margin)
    available_height = (height * inch) - (2 * margin) - label_height

    qr_size = min(available_width, available_height)
    qr_x = ((width * inch) - qr_size) / 2
    qr_y = margin + (available_height - qr_size) / 2

    qr_widget = qrbarcode.QrCodeWidget(data)
    bounds = qr_widget.getBounds()
    qr_drawing = Drawing(qr_size, qr_size, transform=[
        qr_size / (bounds[2] - bounds[0]),
        0,
        0,
        qr_size / (bounds[3] - bounds[1]),
        -bounds[0] * qr_size / (bounds[2] - bounds[0]),
        -bounds[1] * qr_size / (bounds[3] - bounds[1])
    ])
    qr_drawing.add(qr_widget)
    renderPDF.draw(qr_drawing, c, qr_x, qr_y)

    if label:
        c.setFont('Helvetica', 9)
        c.drawCentredString((width * inch) / 2, margin * 0.6, label[:80])

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
        label = request.args.get('label', '')
        label_settings = {
            'width': request.args.get('width', 3.94),
            'height': request.args.get('height', 2.0)
        }
        pdf_bytes = generate_qr_label_pdf(data, label, label_settings)
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
    printer_name = data.get('printer_name')
    label_settings = data.get('label_settings') or {}
    username = data.get('username', 'Unknown')

    if not qr_data:
        return jsonify({'success': False, 'error': 'QR data is required'}), 400

    job_id = str(uuid.uuid4())
    temp_filename = f"qr_print_{job_id}.pdf"
    timestamp = datetime.datetime.now().isoformat()

    try:
        pdf_bytes = generate_qr_label_pdf(qr_data, label, label_settings)

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
                'message': 'Preview generated'
            })
            return jsonify({
                'success': True,
                'mode': 'preview',
                'message': 'macOS dev mode: preview generated (no physical print).',
                'preview_url': '/api/qr/preview'
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
