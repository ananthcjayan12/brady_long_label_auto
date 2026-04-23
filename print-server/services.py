import os
import logging
import re
import io
import json
import uuid
import pypdf
import platform
import subprocess
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from PIL import Image, ImageFilter, ImageEnhance
import threading
import datetime
import hashlib

# Windows-specific imports for native printing
WINDOWS_PRINT_AVAILABLE = False
if platform.system() == 'Windows':
    try:
        import win32print
        import win32ui
        import win32con
        from PIL import ImageWin
        WINDOWS_PRINT_AVAILABLE = True
    except ImportError:
        logging.warning("win32print not available. Install pywin32 for native Windows printing.")

logger = logging.getLogger(__name__)

class PDFProcessingService:
    def __init__(self, upload_folder):
        self.upload_folder = upload_folder
        self.documents = {}  # In-memory store for now, or load from JSON
        self.mappings = {}   # Map barcode -> {file_id, page_num, etc}
        self.hashes = {}     # Map hash -> file_id
        self.print_jobs = [] # List of print jobs
        self.users = []      # List of user accounts
        self.db_path = os.path.join(upload_folder, 'db.json')
        self.load_db()
        self.ensure_default_admin()

    def load_db(self):
        if os.path.exists(self.db_path):
            try:
                with open(self.db_path, 'r') as f:
                    data = json.load(f)
                    self.documents = data.get('documents', {})
                    self.mappings = data.get('mappings', {})
                    self.print_jobs = data.get('print_jobs', [])
                    self.users = data.get('users', [])
                    # Rebuild hash map
                    self.hashes = {doc['hash']: doc_id for doc_id, doc in self.documents.items() if 'hash' in doc}
            except Exception as e:
                logger.error(f"Failed to load DB: {e}")

    def save_db(self):
        try:
            with open(self.db_path, 'w') as f:
                json.dump({
                    'documents': self.documents,
                    'mappings': self.mappings,
                    'print_jobs': self.print_jobs,
                    'users': self.users
                }, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save DB: {e}")

    def ensure_default_admin(self):
        if not self.users:
            self.users = [
                {
                    'username': 'admin',
                    'password': 'admin',
                    'role': 'admin'
                }
            ]
            self.save_db()

    def get_public_users(self):
        return [
            {
                'username': user.get('username', ''),
                'role': user.get('role', 'user')
            }
            for user in self.users
        ]

    def find_user(self, username):
        for user in self.users:
            if user.get('username') == username:
                return user
        return None

    def add_user(self, username, password, role):
        if self.find_user(username):
            return False, 'Username already exists'

        self.users.append({
            'username': username,
            'password': password,
            'role': role or 'user'
        })
        self.save_db()
        return True, None

    def delete_user(self, username):
        user = self.find_user(username)
        if not user:
            return False, 'User not found'

        if user.get('role') == 'admin':
            admin_count = sum(1 for u in self.users if u.get('role') == 'admin')
            if admin_count <= 1:
                return False, 'Cannot delete the last admin'

        self.users = [u for u in self.users if u.get('username') != username]
        self.save_db()
        return True, None

    def reset_user_password(self, username, new_password):
        user = self.find_user(username)
        if not user:
            return False, 'User not found'

        user['password'] = new_password
        self.save_db()
        return True, None

    def change_user_password(self, username, current_password, new_password):
        user = self.find_user(username)
        if not user:
            return False, 'User not found'

        if user.get('password') != current_password:
            return False, 'Current password is incorrect'

        user['password'] = new_password
        self.save_db()
        return True, None

    def authenticate_user(self, username, password):
        user = self.find_user(username)
        if not user:
            return None

        if user.get('password') != password:
            return None

        return {
            'username': user.get('username', ''),
            'role': user.get('role', 'user')
        }

    def log_print_job(self, job_data):
        self.print_jobs.append(job_data)
        self.save_db()

    def get_print_history(self):
        # Return sorted by timestamp desc
        return sorted(self.print_jobs, key=lambda x: x['timestamp'], reverse=True)

    def get_barcode_print_count(self, barcode):
        """Count how many times a barcode was printed"""
        count = 0
        # Find the mapping for this barcode to get file_id and page_num
        _matched, mapping = self.resolve_barcode(barcode)
        if not mapping:
            return 0
        
        file_id = mapping['file_id']
        page_num = mapping['page_num']
        
        for job in self.print_jobs:
            if job['file_id'] == file_id and job['page_num'] == page_num and job['status'] == 'success':
                count += 1
        return count

    def get_last_print_for_barcode(self, barcode):
        """Get the last successful print job for a barcode"""
        _matched, mapping = self.resolve_barcode(barcode)
        if not mapping:
            return None
        
        file_id = mapping['file_id']
        page_num = mapping['page_num']
        
        # Sort jobs by timestamp desc and find first matching
        sorted_jobs = sorted(self.print_jobs, key=lambda x: x['timestamp'], reverse=True)
        for job in sorted_jobs:
            if job['file_id'] == file_id and job['page_num'] == page_num and job['status'] == 'success':
                return {
                    'timestamp': job['timestamp'],
                    'printer': job.get('printer', 'Default')
                }
        return None

    def get_dashboard_stats(self):
        """Get overall dashboard statistics"""
        total_documents = len(self.documents)
        total_barcodes = len(self.mappings)
        total_pages = sum(doc.get('pages', 0) for doc in self.documents.values())
        
        # Print statistics
        total_prints = len([j for j in self.print_jobs if j['status'] == 'success'])
        failed_prints = len([j for j in self.print_jobs if j['status'] == 'failed'])
        
        # Pending prints (barcodes that have never been printed)
        printed_pages = set()
        for job in self.print_jobs:
            if job['status'] == 'success':
                printed_pages.add((job['file_id'], job['page_num']))
        
        pending_prints = 0
        for barcode, mapping in self.mappings.items():
            key = (mapping['file_id'], mapping['page_num'])
            if key not in printed_pages:
                pending_prints += 1
        
        return {
            'total_documents': total_documents,
            'total_barcodes': total_barcodes,
            'total_pages': total_pages,
            'total_prints': total_prints,
            'failed_prints': failed_prints,
            'pending_prints': pending_prints
        }

    def get_document_print_stats(self, file_id):
        """Get print statistics for a specific document"""
        if file_id not in self.documents:
            return None
        
        doc = self.documents[file_id]
        
        # Get mappings for this document
        doc_mappings = [
            {'barcode': k, **v}
            for k, v in self.mappings.items()
            if v['file_id'] == file_id
        ]
        
        # Count prints per page
        page_print_counts = {}
        for job in self.print_jobs:
            if job['file_id'] == file_id and job['status'] == 'success':
                page_num = job['page_num']
                page_print_counts[page_num] = page_print_counts.get(page_num, 0) + 1
        
        # Calculate printed and pending
        printed_pages = set(page_print_counts.keys())
        all_barcode_pages = set(m['page_num'] for m in doc_mappings)
        
        pending_pages = all_barcode_pages - printed_pages
        
        return {
            'document': doc,
            'total_barcodes': len(doc_mappings),
            'printed_count': len(printed_pages),
            'pending_count': len(pending_pages),
            'pending_pages': list(pending_pages),
            'page_print_counts': page_print_counts,
            'mappings': doc_mappings
        }

    def calculate_file_hash(self, file_path):
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def process_pdf(self, file_path, original_filename):
        # Calculate Hash
        file_hash = self.calculate_file_hash(file_path)
        
        # Check for duplicates
        if file_hash in self.hashes:
            existing_id = self.hashes[file_hash]
            logger.info(f"Duplicate file uploaded. Returning existing ID: {existing_id}")
            return {
                'id': existing_id,
                'stats': {
                    'pages': self.documents[existing_id]['pages'],
                    'barcodes': self.documents[existing_id]['barcodes_found']
                },
                'is_duplicate': True
            }

        file_id = str(uuid.uuid4())
        
        doc_info = {
            'id': file_id,
            'name': original_filename,
            'path': file_path,
            'uploaded_at': datetime.datetime.now().isoformat(),
            'pages': 0,
            'barcodes_found': 0,
            'hash': file_hash
        }

        # Process PDF
        reader = pypdf.PdfReader(file_path)
        doc_info['pages'] = len(reader.pages)
        
        # Text Extraction Service Logic Integrated here
        text_service = TextExtractionService()
        
        for i, page in enumerate(reader.pages):
            page_num = i + 1
            extracted_texts = []

            text = page.extract_text()
            if text:
                extracted_texts.append(text)

            # Fallback for PDFs where the default extractor drops/reshapes text
            # differently on some platforms/fonts.
            try:
                layout_text = page.extract_text(extraction_mode='layout')
                if layout_text and layout_text not in extracted_texts:
                    extracted_texts.append(layout_text)
            except Exception:
                pass

            serials = text_service.extract_serial_numbers('\n'.join(extracted_texts))
            
            for serial in serials:
                barcode = serial['text']
                # Store mapping (normalize barcode logic if needed)
                self.mappings[barcode] = {
                    'file_id': file_id,
                    'page_num': page_num,
                    'type': serial['type'],
                    'confidence': serial['confidence'],
                    'doc_name': original_filename
                }
                doc_info['barcodes_found'] += 1
                logger.info(f"Found {barcode} on page {page_num}")

        self.documents[file_id] = doc_info
        self.hashes[file_hash] = file_id  # Store hash
        self.save_db()
        
        return {
            'id': file_id, 
            'stats': {
                'pages': doc_info['pages'], 
                'barcodes': doc_info['barcodes_found']
            },
            'is_duplicate': False
        }

    def delete_document(self, file_id):
        if file_id in self.documents:
            doc = self.documents[file_id]
            # Remove from mappings
            self.mappings = {k: v for k, v in self.mappings.items() if v['file_id'] != file_id}
            # Remove from hashes
            if 'hash' in doc and doc['hash'] in self.hashes:
                del self.hashes[doc['hash']]
            
            # Try to remove file
            try:
                if os.path.exists(doc['path']):
                    os.remove(doc['path'])
            except Exception as e:
                logger.error(f"Error removing file: {e}")
                
            del self.documents[file_id]
            self.save_db()
            return True
        return False

    def get_all_documents(self):
        # Convert dict to sorted list
        docs_list = list(self.documents.values())
        return sorted(docs_list, key=lambda x: x['uploaded_at'], reverse=True)

    def get_document_details(self, file_id):
        if file_id not in self.documents:
            return None
        
        doc = self.documents[file_id]
        # Get all mappings for this doc
        doc_mappings = [
            {'barcode': k, **v} 
            for k, v in self.mappings.items() 
            if v['file_id'] == file_id
        ]
        
        # Sort mappings by page number
        doc_mappings.sort(key=lambda x: x['page_num'])
        
        return {
            'document': doc,
            'mappings': doc_mappings
        }

    def _normalize_barcode(self, value):
        """Normalize barcode strings for reliable matching.

        - Uppercase
        - Strip leading/trailing whitespace
        - Remove ASCII control characters (common in DataMatrix/GS1 scanner output)
        """
        if value is None:
            return ''
        s = str(value).strip().upper()
        # Remove control characters (0x00-0x1F and 0x7F)
        return ''.join(ch for ch in s if (ord(ch) >= 32 and ord(ch) != 127))

    def resolve_barcode(self, barcode):
        """Resolve a scanned barcode to a stored mapping.

        IMPORTANT: Many scanners output composite strings (e.g. DataMatrix payloads)
        that contain multiple identifiers (PN, SN, internal IDs). The previous
        implementation returned the *first* substring match based on dict order,
        which could map to the wrong page and print the wrong unit.

        Strategy:
        1) Exact match (after normalization)
        2) If multiple partial matches exist, choose the most specific (longest)
        3) Deterministic tie-breakers

        Returns: (matched_barcode_key, mapping_dict) or (None, None)
        """
        raw = self._normalize_barcode(barcode)
        if not raw:
            return None, None

        # Fast path: exact match by normalized key
        for known_key in self.mappings.keys():
            if self._normalize_barcode(known_key) == raw:
                return known_key, self.mappings[known_key]

        # Collect partial-match candidates
        candidates = []
        for known_key in self.mappings.keys():
            known_norm = self._normalize_barcode(known_key)
            if len(known_norm) < 6:
                continue
            if known_norm in raw or raw in known_norm:
                candidates.append((known_key, known_norm))

        if not candidates:
            return None, None

        # Prefer candidates contained within the scanned raw string (common case)
        def sort_key(item):
            known_key, known_norm = item
            contained_in_scan = 1 if known_norm in raw else 0
            return (len(known_norm), contained_in_scan)

        best_key, _best_norm = max(candidates, key=sort_key)
        return best_key, self.mappings[best_key]

    def find_barcode(self, barcode):
        _, mapping = self.resolve_barcode(barcode)
        return mapping

    def get_page_image(self, file_id, page_num, label_settings=None):
        # In a real implementation, we render PDF page to image for preview
        # simplified here to return specific page bytes as PDF for browser
        # But user wants IMAGE preview in React usually
        
        # NOTE: For true image preview, we need pdf2image (poppler)
        # For now, we will extract the page as a single-page PDF and return that bytes
        # Frontend can use an iframe or pdf.js to show it, or we try to convert 
        
        # Fallback: Extraction logic from original service
        doc = self.documents.get(file_id)
        if not doc:
            raise Exception("Document not found")
            
        return self._extract_page_bytes(doc['path'], page_num, label_settings)

    def _extract_page_bytes(self, pdf_path, page_num, label_settings=None):
        # Cropping Logic from original app (now configurable via label_settings)
        with open(pdf_path, 'rb') as file:
            pdf_reader = pypdf.PdfReader(file)
            if page_num < 1 or page_num > len(pdf_reader.pages):
                raise Exception("Invalid page number")
            
            original_page = pdf_reader.pages[page_num - 1]
            
            # Get dimensions from settings with defaults
            if label_settings is None:
                label_settings = {}
            
            # Scale: 100 = 100% (no change), 50 = shrink to 50%, 200 = expand to 200%
            scale = label_settings.get('scale', 100) / 100.0
            
            # Apply scale transformation to page
            if scale != 1.0:
                original_page.scale_by(scale)
            
            # Get page dimensions after scaling
            orig_height = float(original_page.mediabox.height)
            orig_width = float(original_page.mediabox.width)
            
            label_width = label_settings.get('width', 3.94) * inch
            label_height = label_settings.get('height', 1.5) * inch
            offset_x = label_settings.get('offsetX', 0) * inch
            offset_y = label_settings.get('offsetY', 0) * inch
            
            # Crop from top-left (0,0 in PDF is bottom-left)
            lower_left_x = offset_x
            lower_left_y = orig_height - offset_y - label_height
            upper_right_x = offset_x + label_width
            upper_right_y = orig_height - offset_y
            
            # Clamp to page bounds
            lower_left_x = max(0, lower_left_x)
            lower_left_y = max(0, lower_left_y)
            upper_right_x = min(orig_width, upper_right_x)
            upper_right_y = min(orig_height, upper_right_y)
            
            original_page.mediabox.lower_left = (lower_left_x, lower_left_y)
            original_page.mediabox.upper_right = (upper_right_x, upper_right_y)
            
            pdf_writer = pypdf.PdfWriter()
            pdf_writer.add_page(original_page)
            
            output_buffer = io.BytesIO()
            pdf_writer.write(output_buffer)
            output_buffer.seek(0)
            return output_buffer.getvalue()

class TextExtractionService:
    def _clean_text(self, value):
        # Normalize control chars that frequently appear in extracted PDF text
        # (platform/parser dependent), while preserving newlines for regex context.
        if not value:
            return ''
        return ''.join(ch if (ch == '\n' or ord(ch) >= 32) else ' ' for ch in str(value))

    def extract_serial_numbers(self, text):
        if not text:
            return []
        
        serial_numbers = []
        seen_values = set()

        base_text = self._clean_text(text)
        condensed_text = re.sub(r'(?<=\w)\s+(?=\w)', '', base_text)
        candidate_texts = [base_text]
        if condensed_text != base_text:
            candidate_texts.append(condensed_text)

        # PORTED REGEX PATTERNS
        patterns = [
            (r'\[\)>.*?S([A-Z][0-9]{10})[0-9]*[A-Z]', 'BARCODE_K'),
            (r'\[\)>.*?S([0-9][A-Z][0-9]{9,12})[0-9]*[A-Z]', 'BARCODE_NUM'),
            (r'S/?N[:\s;\.\-]+([A-Z0-9]{8,15})', 'GENERIC_SN'),
            (r'SN[:\s;\.\-]+([A-Z0-9]{8,15})', 'GENERIC_SN'),
            (r'\b([A-Z]{1,2}[0-9]{8,12})\b', 'ALPHANUMERIC_ID')
        ]
        
        for candidate in candidate_texts:
            for pattern, label_type in patterns:
                matches = re.finditer(pattern, candidate, re.IGNORECASE)
                for match in matches:
                    try:
                        val = re.sub(r'\s+', '', match.group(1).upper())
                        if len(val) < 6:
                            continue
                        dedupe_key = (val, label_type)
                        if dedupe_key in seen_values:
                            continue
                        seen_values.add(dedupe_key)
                        serial_numbers.append({'text': val, 'type': label_type, 'confidence': 1.0})
                    except Exception:
                        pass
                
        return serial_numbers

class PrintService:
    def __init__(self, pdf_service):
        self.pdf_service = pdf_service
        
    def print_page(self, file_id, page_num, printer_name=None, label_settings=None, username='Unknown'):
        job_id = str(uuid.uuid4())
        timestamp = datetime.datetime.now().isoformat()
        status = "failed"
        message = ""
        
        # Default label settings
        if label_settings is None:
            label_settings = {}
        
        try:
            # Get document name for logs
            doc = self.pdf_service.documents.get(file_id, {})
            doc_name = doc.get('name', 'Unknown Document')
            
            # 1. Get cropped PDF bytes (pass label settings for custom crop)
            pdf_bytes = self.pdf_service.get_page_image(file_id, page_num, label_settings)
            
            # 2. Save to temp file
            temp_filename = f"print_job_{job_id}.pdf"
            with open(temp_filename, 'wb') as f:
                f.write(pdf_bytes)
                
            # 3. Extract quality settings from label_settings
            quality_settings = {
                'dpi': label_settings.get('dpi', 600),
                'color_mode': label_settings.get('color_mode', 'grayscale'),
                'sharpening': label_settings.get('sharpening', True),
                'resampling': label_settings.get('resampling', 'lanczos'),
                'contrast': label_settings.get('contrast', 1.0),
                'threshold': label_settings.get('threshold', 128)
            }
            logger.info(f"Print quality settings: {quality_settings}")
            
            # 4. Send to printer (platform specific)
            system = platform.system()
            
            if system == 'Windows':
                if WINDOWS_PRINT_AVAILABLE:
                    # Use native win32print for reliable Windows printing
                    success, message = self._print_windows_native(temp_filename, printer_name, quality_settings)
                else:
                    # Fallback to Powershell
                    success, message = self._print_windows_powershell(temp_filename, printer_name)
                
                if success:
                    status = "success"
                else:
                    raise Exception(message)
            else:
                # Mac/Linux LPR
                cmd = ['lpr']
                if printer_name:
                    cmd.extend(['-P', printer_name])
                cmd.append(temp_filename)
                
                logger.info(f"Executing Unix Print: {' '.join(cmd)}")
                result = subprocess.run(cmd, capture_output=True, text=True)
                
                if result.returncode != 0:
                     raise Exception(f"LPR failed: {result.stderr}")
                
                status = "success"
                message = "Printed successfully"
            
            # Cleanup temp file
            try:
                os.remove(temp_filename)
            except: pass

            self._log_job(job_id, file_id, doc_name, page_num, printer_name, status, timestamp, username=username)
            return True, message
                
        except Exception as e:
            logger.error(f"Print error: {e}")
            message = str(e)
            self._log_job(job_id, file_id, doc_name if 'doc_name' in locals() else 'Unknown', page_num, printer_name, status, timestamp, message, username=username)
            return False, message

    def _print_windows_native(self, pdf_path, printer_name=None, quality_settings=None):
        """Print using win32print (native GDI) - Most Reliable Method
        
        quality_settings can include:
        - dpi: 150, 300, 600 (default: 600 for best quality)
        - color_mode: 'rgb', 'grayscale', 'monochrome' (default: 'grayscale')
        - sharpening: True/False (default: True)
        - resampling: 'lanczos', 'bicubic', 'bilinear' (default: 'lanczos')
        """
        if quality_settings is None:
            quality_settings = {}
        
        try:
            # Convert PDF to Image first with quality settings
            image = self._pdf_to_image(pdf_path, quality_settings)
            if image is None:
                # Fallback to Powershell if conversion fails
                logger.warning("PDF to Image conversion failed, falling back to Powershell")
                return self._print_windows_powershell(pdf_path, printer_name)
            
            # Apply image quality enhancements
            image = self._apply_quality_enhancements(image, quality_settings)
            
            # Get printer
            if not printer_name:
                printer_name = win32print.GetDefaultPrinter()
            
            # GDI Printing (from working project)
            hDC = win32ui.CreateDC()
            hDC.CreatePrinterDC(printer_name)
            
            printable_area = (hDC.GetDeviceCaps(win32con.HORZRES), hDC.GetDeviceCaps(win32con.VERTRES))
            ratio = min(printable_area[0] / image.size[0], printable_area[1] / image.size[1])
            scaled_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
            
            # Use high-quality resampling based on settings
            resampling_mode = self._get_resampling_mode(quality_settings.get('resampling', 'lanczos'))
            bmp = image.resize(scaled_size, resampling_mode)
            
            # Convert to RGB for DIB if in grayscale/monochrome mode
            if bmp.mode == '1':
                bmp = bmp.convert('L').convert('RGB')
            elif bmp.mode == 'L':
                bmp = bmp.convert('RGB')
            
            dib = ImageWin.Dib(bmp)
            
            hDC.StartDoc("Barcode Label")
            hDC.StartPage()
            x = (printable_area[0] - scaled_size[0]) // 2
            y = (printable_area[1] - scaled_size[1]) // 2
            dib.draw(hDC.GetHandleOutput(), (x, y, x + scaled_size[0], y + scaled_size[1]))
            hDC.EndPage()
            hDC.EndDoc()
            hDC.DeleteDC()
            
            return True, f"Printed to {printer_name}"
            
        except Exception as e:
            logger.error(f"Native Windows print failed: {e}")
            # Fallback to Powershell
            return self._print_windows_powershell(pdf_path, printer_name)

    def _get_resampling_mode(self, mode_name):
        """Get PIL resampling filter from name"""
        modes = {
            'lanczos': Image.Resampling.LANCZOS,
            'bicubic': Image.Resampling.BICUBIC,
            'bilinear': Image.Resampling.BILINEAR,
            'nearest': Image.Resampling.NEAREST
        }
        return modes.get(mode_name.lower(), Image.Resampling.LANCZOS)
    
    def _apply_quality_enhancements(self, image, quality_settings):
        """Apply quality enhancements to the image before printing"""
        if quality_settings is None:
            quality_settings = {}
        
        # Apply sharpening if enabled (default: True for label printers)
        if quality_settings.get('sharpening', True):
            # Use UnsharpMask for better results on barcodes
            image = image.filter(ImageFilter.UnsharpMask(radius=1, percent=50, threshold=3))
        
        # Apply contrast enhancement if specified
        contrast = quality_settings.get('contrast', 1.0)
        if contrast != 1.0:
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(contrast)
        
        # Convert to appropriate color mode
        color_mode = quality_settings.get('color_mode', 'grayscale')
        if color_mode == 'monochrome':
            # Convert to pure black and white - best for thermal printers
            image = image.convert('L')  # First to grayscale
            # Apply threshold for crisp black/white
            threshold = quality_settings.get('threshold', 128)
            image = image.point(lambda x: 0 if x < threshold else 255, '1')
        elif color_mode == 'grayscale':
            if image.mode != 'L':
                image = image.convert('L')
        # else keep as RGB
        
        return image
    
    def _pdf_to_image(self, pdf_path, quality_settings=None):
        """Convert first page of PDF to PIL Image with quality settings"""
        if quality_settings is None:
            quality_settings = {}
        
        try:
            from pdf2image import convert_from_path
            import sys
            
            # Determine Poppler path (bundled with EXE or system PATH)
            poppler_path = None
            if getattr(sys, 'frozen', False):
                # Running as PyInstaller EXE - Poppler is bundled in 'poppler' subfolder
                bundle_dir = sys._MEIPASS
                poppler_path = os.path.join(bundle_dir, 'poppler')
                if not os.path.exists(poppler_path):
                    # Try alternative path structure
                    poppler_path = os.path.join(os.path.dirname(sys.executable), 'poppler')
                logger.info(f"Using bundled Poppler at: {poppler_path}")
            
            # Use DPI from quality settings, default to 600 for high quality
            dpi = quality_settings.get('dpi', 600)
            logger.info(f"Converting PDF to image at {dpi} DPI")
            
            # Convert PDF to image with high DPI
            images = convert_from_path(
                pdf_path, 
                dpi=dpi, 
                first_page=1, 
                last_page=1,
                poppler_path=poppler_path
            )
            if images:
                img = images[0]
                # Keep in RGB for now, color conversion happens in quality enhancement step
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                return img
        except ImportError:
            logger.warning("pdf2image not installed. Install it for native Windows printing.")
        except Exception as e:
            logger.error(f"PDF to image conversion error: {e}")
        return None

    def _print_windows_powershell(self, file_path, printer_name=None):
        """Fallback Windows printing using Powershell Start-Process"""
        try:
            if printer_name:
                cmd = ['powershell', '-Command', f'Start-Process -FilePath "{file_path}" -Verb PrintTo -ArgumentList "{printer_name}" -PassThru -Wait']
            else:
                cmd = ['powershell', '-Command', f'Start-Process -FilePath "{file_path}" -Verb Print -PassThru']
            
            logger.info(f"Executing Windows Print: {cmd}")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                return True, "Sent to Windows print queue"
            else:
                return False, f"Powershell print failed: {result.stderr}"
        except subprocess.TimeoutExpired:
            return False, "Print operation timed out"
        except Exception as e:
            return False, str(e)

    def _log_job(self, job_id, file_id, doc_name, page_num, printer_name, status, timestamp, error=None, username='Unknown'):
        job_data = {
            'id': job_id,
            'file_id': file_id,
            'doc_name': doc_name,
            'page_num': page_num,
            'printer': printer_name or 'Default',
            'status': status,
            'timestamp': timestamp,
            'error': error,
            'username': username
        }
        self.pdf_service.log_print_job(job_data)
