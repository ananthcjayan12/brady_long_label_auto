// Upload page functionality

document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const uploadProgress = document.getElementById('uploadProgress');
    const uploadStatus = document.getElementById('uploadStatus');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const statusMessage = document.getElementById('statusMessage');
    const continueBtn = document.getElementById('continueBtn');

    // Click to browse files
    browseBtn.addEventListener('click', function() {
        fileInput.click();
    });

    // Click on upload area to browse files
    uploadArea.addEventListener('click', function(e) {
        if (e.target === uploadArea || e.target.closest('.upload-content')) {
            fileInput.click();
        }
    });

    // Drag and drop functionality
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelection(files[0]);
        }
    });

    // File input change
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });

    function handleFileSelection(file) {
        // Validate file type
        if (file.type !== 'application/pdf') {
            showNotification('Please select a PDF file.', 'error');
            return;
        }

        // Validate file size (50MB limit)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            showNotification('File size must be less than 50MB.', 'error');
            return;
        }

        uploadFile(file);
    }

    function uploadFile(file) {
        const formData = new FormData();
        formData.append('pdf_file', file);
        formData.append('csrfmiddlewaretoken', csrftoken);

        // Show progress
        uploadArea.style.display = 'none';
        uploadProgress.style.display = 'block';
        progressText.textContent = `Processing: ${file.name}`;

        // Start upload
        fetch('/api/upload-pdf/', {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': csrftoken
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Start progress polling
                pollProgress(data.document_id, file.name);
            } else {
                showUploadError(data.error || 'Upload failed');
            }
        })
        .catch(error => {
            console.error('Upload error:', error);
            showUploadError('Upload failed due to network error');
        });
    }

    function pollProgress(documentId, fileName) {
        const pollInterval = setInterval(() => {
            fetch(`/api/upload-progress/${documentId}/`)
                .then(response => response.json())
                .then(data => {
                    updateProgress(data.progress);
                    
                    if (data.completed) {
                        clearInterval(pollInterval);
                        if (data.success) {
                            showUploadSuccess(fileName, data.pages_found);
                        } else {
                            showUploadError(data.error || 'Processing failed');
                        }
                    }
                })
                .catch(error => {
                    clearInterval(pollInterval);
                    console.error('Progress polling error:', error);
                    showUploadError('Failed to get processing status');
                });
        }, 1000);
    }

    function updateProgress(progress) {
        progressFill.style.width = progress + '%';
    }

    function showUploadSuccess(fileName, pagesFound) {
        uploadProgress.style.display = 'none';
        uploadStatus.style.display = 'block';
        
        statusMessage.innerHTML = `
            <div class="success-message">
                <h3>✅ Upload Successful!</h3>
                <p><strong>${fileName}</strong> has been processed successfully.</p>
                <p>Found <strong>${pagesFound}</strong> pages with barcodes.</p>
            </div>
        `;
        
        continueBtn.style.display = 'block';
        continueBtn.addEventListener('click', function() {
            window.location.href = '/search/';
        });
    }

    function showUploadError(errorMessage) {
        uploadProgress.style.display = 'none';
        uploadStatus.style.display = 'block';
        
        statusMessage.innerHTML = `
            <div class="error-message">
                <h3>❌ Upload Failed</h3>
                <p>${errorMessage}</p>
                <button onclick="location.reload()" class="retry-btn">Try Again</button>
            </div>
        `;
    }
});
