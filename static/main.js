document.addEventListener('DOMContentLoaded', () => {
    // State Variables
    let selectedFiles = [];
    let systemIndexed = false;

    // DOM Elements
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const headerTitle = document.getElementById('header-title');
    const systemStatus = document.getElementById('system-status');
    const statusDot = systemStatus.querySelector('.status-dot');
    const statusText = systemStatus.querySelector('.status-text');

    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const fileListContainer = document.getElementById('file-list-container');
    const fileList = document.getElementById('file-list');
    const uploadBtn = document.getElementById('upload-btn');
    const corpusCard = document.getElementById('corpus-card');
    const indexedList = document.getElementById('indexed-list');

    const generateReviewBtn = document.getElementById('generate-review-btn');
    const reviewOutput = document.getElementById('review-output');

    const generateGapsBtn = document.getElementById('generate-gaps-btn');
    const gapsOutput = document.getElementById('gaps-output');

    const paperTopic = document.getElementById('paper-topic');
    const generatePaperBtn = document.getElementById('generate-paper-btn');
    const paperOutputContainer = document.getElementById('paper-output-container');
    const paperOutput = document.getElementById('paper-output');
    const downloadDocxBtn = document.getElementById('download-docx-btn');

    const figuresGrid = document.getElementById('figures-grid');
    const metadataDashboardContainer = document.getElementById('metadata-dashboard-container');

    const chatWindow = document.getElementById('chat-window');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const modelSelect = document.getElementById('model-select');

    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');

    // ------------------ INITIALIZE ------------------
    checkSystemStatus();

    // ------------------ TAB NAVIGATION ------------------
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = item.getAttribute('data-tab');

            navItems.forEach(nav => nav.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));

            item.classList.add('active');
            document.getElementById(targetTab).classList.add('active');

            headerTitle.textContent = item.querySelector('span').textContent;

            // Trigger specific actions when switching tabs
            if (targetTab === 'figures-tab' && systemIndexed) {
                loadFigures();
            } else if (targetTab === 'intelligence-tab' && systemIndexed) {
                loadMetadataDashboard();
            }
        });
    });

    // ------------------ HELPER FUNCTIONS ------------------
    function showLoading(text = 'Processing...') {
        loadingText.textContent = text;
        loadingOverlay.style.display = 'flex';
    }

    function hideLoading() {
        loadingOverlay.style.display = 'none';
    }

    function updateStatusUI(indexed, files = []) {
        systemIndexed = indexed;
        if (indexed) {
            statusDot.className = 'status-dot green';
            statusText.textContent = `${files.length} paper(s) loaded`;

            // Populate Ingest tab corpus card
            corpusCard.style.display = 'block';
            indexedList.innerHTML = files.map(file => `
                <li>
                    <i class="fa-solid fa-file-pdf"></i>
                    <div>
                        <span class="doc-title">${file}</span>
                    </div>
                </li>
            `).join('');
        } else {
            statusDot.className = 'status-dot red';
            statusText.textContent = 'No papers loaded';
            corpusCard.style.display = 'none';
        }
    }

    async function checkSystemStatus() {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            updateStatusUI(data.indexed, data.files);
        } catch (e) {
            console.error('Error fetching system status:', e);
        }
    }

    // ------------------ FILE UPLOAD ------------------
    uploadZone.addEventListener('click', () => fileInput.click());

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = 'var(--primary)';
        uploadZone.style.backgroundColor = 'rgba(102, 252, 241, 0.04)';
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        uploadZone.style.backgroundColor = 'rgba(255, 255, 255, 0.01)';
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        uploadZone.style.backgroundColor = 'rgba(255, 255, 255, 0.01)';

        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', () => {
        handleFiles(fileInput.files);
    });

    function handleFiles(files) {
        for (let file of files) {
            if (file.type === 'application/pdf' && !selectedFiles.some(f => f.name === file.name)) {
                selectedFiles.push(file);
            }
        }
        renderFileList();
    }

    function renderFileList() {
        if (selectedFiles.length > 0) {
            fileListContainer.style.display = 'block';
            fileList.innerHTML = selectedFiles.map((file, idx) => `
                <li>
                    <span><i class="fa-solid fa-file-pdf"></i> ${file.name}</span>
                    <i class="fa-solid fa-xmark remove-file" data-idx="${idx}"></i>
                </li>
            `).join('');

            document.querySelectorAll('.remove-file').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.getAttribute('data-idx'));
                    selectedFiles.splice(idx, 1);
                    renderFileList();
                });
            });
        } else {
            fileListContainer.style.display = 'none';
        }
    }

    uploadBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) return;

        showLoading('Parsing PDFs and building RAG index (this may take a few moments)...');
        const formData = new FormData();
        selectedFiles.forEach(file => {
            formData.append('files', file);
        });

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (data.success) {
                updateStatusUI(true, data.files);
                selectedFiles = [];
                renderFileList();
                alert('RAG Index built successfully!');
            } else {
                alert('Index building failed: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            alert('Upload error: ' + e.message);
        } finally {
            hideLoading();
        }
    });

    // ------------------ GENERATE REVIEW ------------------
    generateReviewBtn.addEventListener('click', async () => {
        if (!systemIndexed) return alert('Please upload and index papers first.');

        showLoading('Synthesizing Literature Review with Groq...');
        try {
            const res = await fetch('/api/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: modelSelect.value })
            });
            const data = await res.json();

            if (data.review) {
                reviewOutput.innerHTML = marked.parse(data.review);
            } else {
                reviewOutput.innerHTML = `<div class="error-text">Failed to generate: ${data.error}</div>`;
            }
        } catch (e) {
            reviewOutput.innerHTML = `<div class="error-text">API Error: ${e.message}</div>`;
        } finally {
            hideLoading();
        }
    });

    // ------------------ GENERATE GAPS & IDEAS ------------------
    generateGapsBtn.addEventListener('click', async () => {
        if (!systemIndexed) return alert('Please upload and index papers first.');

        showLoading('Extracting gaps and brainstorm ideas with Groq...');
        try {
            const res = await fetch('/api/gaps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: modelSelect.value })
            });
            const data = await res.json();

            if (data.gaps) {
                gapsOutput.innerHTML = marked.parse(data.gaps);

                // Add quick listeners if there are generated titles to generate paper
                setupPaperSuggestions();
            } else {
                gapsOutput.innerHTML = `<div class="error-text">Failed to generate: ${data.error}</div>`;
            }
        } catch (e) {
            gapsOutput.innerHTML = `<div class="error-text">API Error: ${e.message}</div>`;
        } finally {
            hideLoading();
        }
    });

    function setupPaperSuggestions() {
        // Auto-extract suggested titles if they click them
        // Let's do simple UI helpers: if user clicks a suggestion, copy it to the topic input
        // Just for ease of use!
    }

    // ------------------ IEEE PAPER GENERATOR ------------------
    generatePaperBtn.addEventListener('click', async () => {
        if (!systemIndexed) return alert('Please upload and index papers first.');
        const topic = paperTopic.value.trim();
        if (!topic) return alert('Please select or type a research topic.');

        showLoading('Gemini is constructing your structured IEEE paper (this takes ~20-30s)...');
        try {
            const res = await fetch('/api/generate-paper', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: topic })
            });
            const data = await res.json();

            if (data.paper) {
                paperOutputContainer.style.display = 'block';
                paperOutput.innerHTML = marked.parse(data.paper);
                paperOutputContainer.scrollIntoView({ behavior: 'smooth' });
            } else {
                alert('Generation failed: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            alert('Generation error: ' + e.message);
        } finally {
            hideLoading();
        }
    });

    downloadDocxBtn.addEventListener('click', () => {
        window.location.href = '/api/download-docx';
    });

    // ------------------ GALLERY ------------------
    async function loadFigures() {
        figuresGrid.innerHTML = '<div class="loading-text w-100">Fetching figures...</div>';
        try {
            const res = await fetch('/api/images');
            const data = await res.json();

            if (data && data.length > 0) {
                figuresGrid.innerHTML = data.map(img => `
                    <div class="figure-card">
                        <div class="figure-wrapper">
                            <img src="/api/image/${img.id}" alt="${img.label}">
                        </div>
                        <div class="figure-caption">
                            <strong>${img.label}</strong>
                        </div>
                    </div>
                `).join('');
            } else {
                figuresGrid.innerHTML = `
                    <div class="empty-state w-100">
                        <i class="fa-solid fa-image"></i>
                        <p>No sufficiently large figures extracted from the indexed papers.</p>
                    </div>
                `;
            }
        } catch (e) {
            figuresGrid.innerHTML = `<div class="error-text w-100">Error loading figures: ${e.message}</div>`;
        }
    }

    // ------------------ ASK PAPERS (CHAT) ------------------
    chatSendBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    async function sendChatMessage() {
        const question = chatInput.value.trim();
        if (!question) return;
        if (!systemIndexed) return alert('Please upload and index papers first.');

        // Render User Message
        appendMessage('user', question);
        chatInput.value = '';

        // Render System Loader
        const loaderId = 'loader-' + Date.now();
        appendMessage('system', '<span class="typing-indicator">Searching index and composing answer...</span>', loaderId);

        try {
            const res = await fetch('/api/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: question,
                    model: modelSelect.value
                })
            });
            const data = await res.json();

            const loaderBubble = document.getElementById(loaderId);
            if (data.answer) {
                loaderBubble.querySelector('.message-bubble').innerHTML = marked.parse(data.answer);
            } else {
                loaderBubble.querySelector('.message-bubble').textContent = 'Error: ' + data.error;
            }
        } catch (e) {
            const loaderBubble = document.getElementById(loaderId);
            loaderBubble.querySelector('.message-bubble').textContent = 'API Error: ' + e.message;
        }
    }

    function appendMessage(sender, text, id = null) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${sender}`;
        if (id) msgDiv.id = id;

        msgDiv.innerHTML = `
            <div class="message-bubble">
                ${text}
            </div>
        `;

        chatWindow.appendChild(msgDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    async function loadMetadataDashboard() {
        metadataDashboardContainer.innerHTML = '<div class="loading-text w-100">Analyzing corpus metadata...</div>';
        try {
            const res = await fetch('/api/metadata');
            const data = await res.json();

            const keys = Object.keys(data);
            if (keys.length > 0) {
                metadataDashboardContainer.innerHTML = keys.map(key => {
                    const meta = data[key];
                    const confidencePercent = Math.round((meta.confidence_score || 0) * 100);

                    // Format arrays into badges/list elements
                    const authors = (meta.authors || []).map(a => `<span class="badge author-badge">${a}</span>`).join(' ') || 'Unknown';
                    const keywords = (meta.keywords || []).map(k => `<span class="badge keyword-badge">${k}</span>`).join(' ');

                    const methodologies = (meta.methodologies || []).map(m => `<li>${m}</li>`).join('') || '<li>None identified</li>';
                    const datasets = (meta.datasets || []).map(d => `<li>${d}</li>`).join('') || '<li>None identified</li>';
                    const findings = (meta.key_findings || []).map(f => `<li>${f}</li>`).join('') || '<li>None identified</li>';
                    const limitations = (meta.limitations || []).map(l => `<li>${l}</li>`).join('') || '<li>None identified</li>';
                    const futureWork = (meta.future_work || []).map(fw => `<li>${fw}</li>`).join('') || '<li>None identified</li>';

                    return `
                        <div class="metadata-card card">
                            <div class="metadata-card-header">
                                <div class="metadata-title-row">
                                    <h3 class="paper-title">${meta.title || key}</h3>
                                    <div class="confidence-badge" title="Extraction Confidence">
                                        <i class="fa-solid fa-gauge-high"></i> ${confidencePercent}%
                                    </div>
                                </div>
                                <div class="metadata-meta-row">
                                    <span class="meta-item"><strong>Authors:</strong> ${authors}</span>
                                    <span class="meta-item"><strong>Year:</strong> ${meta.publication_year || 'Unknown'}</span>
                                    <span class="meta-item"><strong>Domain:</strong> ${meta.research_domain || 'Unknown'}</span>
                                </div>
                                ${keywords ? `<div class="metadata-keywords">${keywords}</div>` : ''}
                            </div>
                            <div class="metadata-card-body">
                                <div class="metadata-grid-2">
                                    <div class="metadata-section">
                                        <h4><i class="fa-solid fa-gears"></i> Methodologies</h4>
                                        <ul>${methodologies}</ul>
                                    </div>
                                    <div class="metadata-section">
                                        <h4><i class="fa-solid fa-database"></i> Datasets</h4>
                                        <ul>${datasets}</ul>
                                    </div>
                                </div>
                                <div class="metadata-section">
                                    <h4><i class="fa-solid fa-chart-line"></i> Key Findings</h4>
                                    <ul>${findings}</ul>
                                </div>
                                <div class="metadata-grid-2">
                                    <div class="metadata-section">
                                        <h4><i class="fa-solid fa-triangle-exclamation"></i> Limitations</h4>
                                        <ul>${limitations}</ul>
                                    </div>
                                    <div class="metadata-section">
                                        <h4><i class="fa-solid fa-compass"></i> Future Work</h4>
                                        <ul>${futureWork}</ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                metadataDashboardContainer.innerHTML = `
                    <div class="empty-state w-100">
                        <i class="fa-solid fa-microchip"></i>
                        <p>No paper intelligence data available. Upload and index research papers first.</p>
                    </div>
                `;
            }
        } catch (e) {
            metadataDashboardContainer.innerHTML = `<div class="error-text w-100">Error loading metadata: ${e.message}</div>`;
        }
    }
});
