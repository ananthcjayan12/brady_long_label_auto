# QR Label Template Frontend

This frontend is now a template UI for:

- Entering QR payload text/URL
- Previewing generated QR locally in the browser
- Sending print jobs to the local print bridge

## Run

1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run dev
```

3. Open the app and set the print-server URL (default: `http://localhost:5001`).

## Template Flow

1. Configure server URL and printer.
2. Enter QR data and optional label text.
3. Click **Generate & Print QR**.

On macOS, backend runs in preview mode and opens generated PDF preview instead of physical print.
