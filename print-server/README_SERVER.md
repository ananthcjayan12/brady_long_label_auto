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

*   `GET /api/qr/preview?data=...&label=...&width=...&height=...`
        * Returns generated QR label PDF for preview.
*   `POST /api/qr/print`
        * Body:
            ```json
            {
                "data": "https://example.com/item/ABC-123",
                "label": "Sample QR Label",
                "printer_name": "Optional Printer Name",
                "label_settings": {
                    "width": 3.94,
                    "height": 2.0
                },
                "username": "template-user"
            }
            ```

## Troubleshooting

*   **Printer not found**: Ensure printer is installed in OS settings and visible in `lpstat -p` (macOS/Linux) or Windows printer settings.
*   **Connection failed**: Ensure nothing blocks port `5001`.
