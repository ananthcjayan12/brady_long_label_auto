# Local QR Print Bridge

This server is the local companion for the QR Template frontend. It generates QR label PDFs and sends them to your local printer.

## Installation

1.  **Install Python**: Ensure you have Python 3.8+ installed.
2.  **Install dependencies**:
    *   `pip install -r requirements_server.txt`
    *   Use the exact file name (`requirements_server.txt` or `requirements.txt`), not `requirements`.
3.  **Run the Server**:
    *   **Mac/Linux**: Open Terminal, navigate to this folder, and run `./run_server.sh`
    *   **Windows**: Open PowerShell, navigate to this folder, and run `python app.py` (ensure you install requirements first: `pip install -r requirements_server.txt`)

## How it Works

*   Server runs on `http://localhost:5001`.
*   Frontend calls QR endpoints to preview or print labels.
*   Keep this process running while using the app.

## QR Endpoints

*   `GET /api/qr/preview?data=...&width=...&height=...`
        * Returns generated QR label PDF for preview.
        * Optional query: `template_type=template_1|template_2`
        * Optional query: `layout=<json-string>` for full element spacing/font/size overrides.
*   `POST /api/qr/print`
        * Body:
            ```json
            {
                "data": "FOB1NA2R411105MA$2534007223",
                "template_type": "template_1",
                "printer_name": "Optional Printer Name",
                "label_settings": {
                    "width_in": 1.0,
                    "total_height_in": 1.5,
                    "top_printable_height_in": 0.5,
                    "line1_font_size": 6.7,
                    "line2_font_size": 8.5,
                    "line1_font_name": "Helvetica-Bold",
                    "line2_font_name": "Helvetica-Bold",
                    "line1_y_in": 0.235,
                    "line2_y_in": 0.145,
                    "logo_x_in": 0.30,
                    "logo_top_in": 0.01,
                    "logo_width_in": 0.40,
                    "barcode_y_in": 0.02,
                    "barcode_height_in": 0.08,
                    "barcode_bar_width_in": 0.009
                },
                "username": "template-user"
            }
            ```

## QR Label Template Rules

*   Scan payload format must be: `<line1>$<line2>`.
*   `line1` must be 15 or 16 characters.
*   `line2` must be exactly 10 digits.
*   `template_type` supports:
    *   `template_1` (first cell type)
    *   `template_2` (second cell type)
*   Both templates are logo-only (no optional label header text).
*   If a legacy `label` field is sent, it is ignored for rendering.
*   Print layout uses measurement reference (`A=1.0in, B=0.5in, C=1.5in`) and keeps the lower area blank/white for transparent sticker space.

## Troubleshooting

*   **Printer not found**: Ensure printer is installed in OS settings and visible in `lpstat -p` (macOS/Linux) or Windows printer settings.
*   **Connection failed**: Ensure nothing blocks port `5001`.
