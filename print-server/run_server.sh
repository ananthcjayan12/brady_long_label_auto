#!/bin/bash

# Configuration
PORT=5001
VENV_DIR="venv"

echo "=== Brady Local Print Bridge ==="
echo "Starting locally on port $PORT..."

# Check if python3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..."
    python3 -m venv $VENV_DIR
    source $VENV_DIR/bin/activate
    echo "Installing dependencies..."
    pip install -r requirements_server.txt
else
    source $VENV_DIR/bin/activate
fi

# Start the server
python3 app.py
