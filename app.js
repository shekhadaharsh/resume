// ===========================
// ResuMail - Email Sender App
// ===========================

(function () {
    'use strict';

    // ===========================
    // Default Templates
    // ===========================
    const DEFAULT_TEMPLATES = [
        {
            id: 'tpl-1',
            name: 'General Application',
            subject: 'Application for Open Position',
            body: `Dear Sir/Madam,

I hope this email finds you well. I am writing to express my sincere interest in the open position at your organization.

With my strong background and relevant experience, I am confident that I can make a meaningful contribution to your team. I have attached my resume for your consideration, which details my qualifications and accomplishments.

I am excited about the opportunity to bring my skills and contribute to your continued success. I would welcome the chance to discuss how my experience aligns with your team's needs.

Thank you for your time and consideration. I look forward to hearing from you.

Best regards`,
            resumeName: null,
            resumeDataUrl: null,
            isDefault: true
        },
        {
            id: 'tpl-2',
            name: 'Software Developer',
            subject: 'Application for Software Developer Role',
            body: `Dear Hiring Manager,

I am writing to express my interest in the Software Developer position at your company. As a passionate developer with expertise in modern web technologies, I am eager to contribute to your team's innovative projects.

My technical skills include proficiency in JavaScript, React, Node.js, Python, and cloud technologies. I have a proven track record of building scalable applications and collaborating with cross-functional teams.

I have attached my resume for your review. I am confident that my technical abilities and problem-solving skills would be valuable to your organization.

I would love the opportunity to discuss how I can contribute to your team. Thank you for your consideration.

Best regards`,
            resumeName: null,
            resumeDataUrl: null,
            isDefault: true
        },
        {
            id: 'tpl-3',
            name: 'Fresher / Internship',
            subject: 'Application for Internship / Entry Level Position',
            body: `Dear Sir/Madam,

I am a recent graduate eager to begin my professional career, and I am writing to express my strong interest in opportunities at your organization.

Although I am at the beginning of my career, I bring enthusiasm, a strong work ethic, and a willingness to learn. During my academic journey, I have developed skills in various technologies and completed projects that demonstrate my ability to deliver results.

I have attached my resume for your review. I would be grateful for the opportunity to start my career at your company and grow with your team.

Thank you for considering my application. I look forward to the possibility of discussing this opportunity with you.

Warm regards`,
            resumeName: null,
            resumeDataUrl: null,
            isDefault: true
        },
        {
            id: 'tpl-4',
            name: 'Follow-up Email',
            subject: 'Follow-up on My Recent Application',
            body: `Dear Sir/Madam,

I hope you are doing well. I am writing to follow up on my recent application that I submitted for the open position at your company.

I remain very interested in this opportunity and believe my skills and experience would be a great match for the role. I wanted to reiterate my enthusiasm for contributing to your team.

If you need any additional information or would like to schedule an interview, I am available at your convenience.

Thank you for your time, and I look forward to hearing from you.

Best regards`,
            resumeName: null,
            resumeDataUrl: null,
            isDefault: true
        }
    ];

    // ===========================
    // State Management & Auth API
    // ===========================
    const API_BASE = window.location.origin;

    let state = {
        templates: [],
        history: [],
        selectedTemplate: null,
        editingTemplateId: null,
        modalResumeFile: null
    };

    function getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('resumail_token')
        };
    }

    // Load state from SQLite API
    async function loadState() {
        const token = localStorage.getItem('resumail_token');
        if (!token) {
            showAuthScreen(true);
            return;
        }

        try {
            // Get sender email
            const savedSenderEmail = localStorage.getItem('resumail_sender_email');
            if (savedSenderEmail) {
                document.getElementById('senderEmail').value = savedSenderEmail;
            }

            // Get templates
            const templatesRes = await fetch(`${API_BASE}/api/templates`, {
                headers: getAuthHeaders()
            });
            const templatesData = await templatesRes.json();
            
            if (templatesRes.status === 401) {
                handleLogout();
                return;
            }

            if (templatesData.success) {
                // If user has no templates, load the defaults
                if (templatesData.templates.length === 0) {
                    state.templates = [...DEFAULT_TEMPLATES];
                    // Save defaults to server
                    for (const tpl of state.templates) {
                        await saveTemplateToServer(tpl);
                    }
                } else {
                    state.templates = templatesData.templates;
                }
            }

            // Get history
            const historyRes = await fetch(`${API_BASE}/api/history`, {
                headers: getAuthHeaders()
            });
            const historyData = await historyRes.json();
            if (historyData.success) {
                state.history = historyData.history;
            }

            showAuthScreen(false);
            renderTemplateChips();
            renderTemplatesGrid();
            renderHistory();
            updateStats();

            // Auto-select first template
            if (state.templates.length > 0 && !state.selectedTemplate) {
                selectTemplate(state.templates[0].id);
            }

        } catch (error) {
            showToast('Failed to load data from server. Check if server is running.', 'error');
        }
    }

    async function saveTemplateToServer(tpl) {
        try {
            await fetch(`${API_BASE}/api/templates`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(tpl)
            });
        } catch (error) {
            console.error('Error saving template to server:', error);
        }
    }

    async function saveSenderEmail() {
        const email = document.getElementById('senderEmail').value.trim();
        if (!email) return;

        localStorage.setItem('resumail_sender_email', email);
        showSavedBadge();

        try {
            await fetch(`${API_BASE}/api/sender-email`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ senderEmail: email })
            });
        } catch (error) {
            console.error('Error saving sender email on server:', error);
        }
    }

    function showSavedBadge() {
        const badge = document.getElementById('savedBadge');
        if (!badge) return;
        badge.style.display = 'inline-block';
        clearTimeout(badge._timeout);
        badge._timeout = setTimeout(() => {
            badge.style.display = 'none';
        }, 2000);
    }

    // Toggle Login/Signup Screen
    function showAuthScreen(show) {
        const authContainer = document.getElementById('authContainer');
        const appContainer = document.getElementById('appContainer');
        if (show) {
            authContainer.style.display = 'flex';
            appContainer.style.display = 'none';
        } else {
            authContainer.style.display = 'none';
            appContainer.style.display = 'flex';
        }
    }

    // Auth Actions setup
    function initAuth() {
        const showSignupLink = document.getElementById('showSignupLink');
        const showLoginLink = document.getElementById('showLoginLink');
        const loginFormSection = document.getElementById('loginFormSection');
        const signupFormSection = document.getElementById('signupFormSection');
        
        const loginBtn = document.getElementById('loginBtn');
        const signupBtn = document.getElementById('signupBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        showSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginFormSection.style.display = 'none';
            signupFormSection.style.display = 'block';
        });

        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            signupFormSection.style.display = 'none';
            loginFormSection.style.display = 'block';
        });

        loginBtn.addEventListener('click', handleLogin);
        signupBtn.addEventListener('click', handleSignup);
        logoutBtn.addEventListener('click', handleLogout);
    }

    async function handleLogin() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        if (!email || !password) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (data.success) {
                localStorage.setItem('resumail_token', data.token);
                if (data.senderEmail) {
                    localStorage.setItem('resumail_sender_email', data.senderEmail);
                }
                showToast('Welcome back!', 'success');
                loadState();
            } else {
                showToast(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            showToast('Server connection failed.', 'error');
        }
    }

    async function handleSignup() {
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value.trim();

        if (!email || !password) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (data.success) {
                showToast('Signup successful! Please log in.', 'success');
                document.getElementById('showLoginLink').click();
            } else {
                showToast(data.error || 'Signup failed', 'error');
            }
        } catch (error) {
            showToast('Server connection failed.', 'error');
        }
    }

    async function handleLogout() {
        try {
            await fetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
        } catch (error) {
            console.error('Logout request failed:', error);
        }
        localStorage.removeItem('resumail_token');
        localStorage.removeItem('resumail_sender_email');
        document.getElementById('senderEmail').value = '';
        state.templates = [];
        state.history = [];
        showAuthScreen(true);
        showToast('Logged out successfully', 'info');
    }


    // ===========================
    // Background Particles
    // ===========================
    function initParticles() {
        const container = document.getElementById('bgParticles');
        const colors = ['#6c5ce7', '#a29bfe', '#00cec9', '#6c5ce7'];

        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            const size = Math.random() * 6 + 2;
            const color = colors[Math.floor(Math.random() * colors.length)];
            particle.style.cssText = `
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                left: ${Math.random() * 100}%;
                animation-duration: ${Math.random() * 20 + 15}s;
                animation-delay: ${Math.random() * 10}s;
            `;
            container.appendChild(particle);
        }
    }

    // ===========================
    // Tab Navigation
    // ===========================
    function initNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const titles = {
            compose: { title: 'Compose Email', subtitle: 'Send your resume to recruiters with professional templates' },
            templates: { title: 'Email Templates', subtitle: 'Manage and create email templates with attached resumes' },
            history: { title: 'Sent History', subtitle: 'Track all emails you have sent to recruiters' }
        };

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const tab = item.dataset.tab;

                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');

                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                document.getElementById(`tab-${tab}`).classList.add('active');

                document.getElementById('pageTitle').textContent = titles[tab].title;
                document.getElementById('pageSubtitle').textContent = titles[tab].subtitle;

                document.getElementById('clearHistoryBtn').style.display = tab === 'history' ? 'flex' : 'none';

                document.getElementById('sidebar').classList.remove('open');
            });
        });

        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const toggle = document.getElementById('menuToggle');
            if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
    }

    // ===========================
    // Template Chips (Compose Tab)
    // ===========================
    function renderTemplateChips() {
        const container = document.getElementById('templateChips');
        container.innerHTML = '';

        state.templates.forEach(template => {
            const chip = document.createElement('button');
            chip.className = `template-chip${state.selectedTemplate === template.id ? ' active' : ''}`;
            chip.textContent = template.name;
            chip.addEventListener('click', () => selectTemplate(template.id));
            container.appendChild(chip);
        });
    }

    function selectTemplate(id) {
        state.selectedTemplate = id;
        renderTemplateChips();
        updatePreview();
        updateTemplateResumeInfo();
    }

    // Show resume info for selected template
    function updateTemplateResumeInfo() {
        const infoEl = document.getElementById('templateResumeInfo');
        const nameEl = document.getElementById('templateResumeName');
        if (!infoEl || !nameEl) return;

        const template = state.templates.find(t => t.id === state.selectedTemplate);

        if (template && template.resumeName) {
            infoEl.style.display = 'block';
            nameEl.textContent = '📎 ' + template.resumeName;
        } else {
            infoEl.style.display = 'none';
        }
    }

    // ===========================
    // Email Preview
    // ===========================
    function updatePreview() {
        const template = state.templates.find(t => t.id === state.selectedTemplate);
        const previewSubject = document.getElementById('previewSubject');
        const previewBody = document.getElementById('previewBody');
        const previewFrom = document.getElementById('previewFrom');
        const previewTo = document.getElementById('previewTo');
        const previewAttachRow = document.getElementById('previewAttachRow');
        const previewAttachName = document.getElementById('previewAttachName');

        const senderInput = document.getElementById('senderEmail');
        const receiverInput = document.getElementById('receiverEmail');
        const senderEmail = senderInput ? senderInput.value : 'your-email@gmail.com';
        const receiverEmail = receiverInput ? receiverInput.value : 'receiver@company.com';

        if (previewSubject) previewSubject.textContent = template ? template.subject : 'Select a template...';
        if (previewBody) previewBody.textContent = template ? template.body : 'Select a template to see the preview...';
        if (previewFrom) previewFrom.textContent = senderEmail;
        if (previewTo) previewTo.textContent = receiverEmail;

        if (template && template.resumeName && previewAttachRow && previewAttachName) {
            previewAttachRow.style.display = 'flex';
            previewAttachName.textContent = template.resumeName;
        } else if (previewAttachRow) {
            previewAttachRow.style.display = 'none';
        }
    }

    // ===========================
    // Send Email
    // ===========================
    function initSendButton() {
        document.getElementById('sendBtn').addEventListener('click', sendEmail);
    }

    async function sendEmail() {
        const senderEmail = document.getElementById('senderEmail').value.trim();
        const receiverEmail = document.getElementById('receiverEmail').value.trim();

        // Validations
        if (!senderEmail || !isValidEmail(senderEmail)) {
            showToast('Please enter a valid sender email', 'error');
            return;
        }
        if (!receiverEmail || !isValidEmail(receiverEmail)) {
            showToast('Please enter a valid receiver email', 'error');
            return;
        }
        if (!state.selectedTemplate) {
            showToast('Please select an email template', 'error');
            return;
        }

        const template = state.templates.find(t => t.id === state.selectedTemplate);

        // Save sender email
        saveSenderEmail();

        // Button loading state
        const btn = document.getElementById('sendBtn');
        btn.classList.add('sending');
        btn.querySelector('span').textContent = 'Sending...';

        try {
            // Send via Flask backend
            const payload = {
                senderEmail,
                receiverEmail,
                subject: template.subject,
                body: template.body,
                resumeName: template.resumeName || null,
                resumeData: template.resumeDataUrl || null,
                templateName: template.name
            };

            const response = await fetch(`${API_BASE}/send-email`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                // Refresh history from server
                const historyRes = await fetch(`${API_BASE}/api/history`, {
                    headers: getAuthHeaders()
                });
                const historyData = await historyRes.json();
                if (historyData.success) {
                    state.history = historyData.history;
                }

                // Update UI
                updateStats();
                renderHistory();
                showToast(`✅ Email sent successfully to ${receiverEmail}!`, 'success');

                // Clear ONLY receiver email (sender stays)
                document.getElementById('receiverEmail').value = '';
                updatePreview();
            } else {
                showToast(`❌ ${result.error}`, 'error');
            }
        } catch (error) {
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                showToast('❌ Server not running! Run: python server.py', 'error');
            } else {
                showToast(`❌ Error: ${error.message}`, 'error');
            }
        } finally {
            btn.classList.remove('sending');
            btn.querySelector('span').textContent = 'Send Email';
        }
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // ===========================
    // Templates Tab
    // ===========================
    function renderTemplatesGrid() {
        const container = document.getElementById('templatesGrid');
        container.innerHTML = '';

        state.templates.forEach(template => {
            const card = document.createElement('div');
            card.className = 'template-card';
            card.innerHTML = `
                <div class="template-card-header">
                    <span class="template-card-name">${escapeHtml(template.name)}</span>
                    <div class="template-card-badges">
                        ${template.resumeName ? '<span class="template-card-badge resume-badge">📎 Resume</span>' : ''}
                        ${template.isDefault ? '<span class="template-card-badge">Default</span>' : '<span class="template-card-badge" style="background:rgba(0,206,201,0.15);color:#00cec9;">Custom</span>'}
                    </div>
                </div>
                <div class="template-card-subject">${escapeHtml(template.subject)}</div>
                <div class="template-card-body">${escapeHtml(template.body)}</div>
                <div class="template-card-actions">
                    <button class="btn-sm" onclick="app.editTemplate('${template.id}')">Edit</button>
                    <button class="btn-sm" onclick="app.duplicateTemplate('${template.id}')">Duplicate</button>
                    ${!template.isDefault ? `<button class="btn-sm danger" onclick="app.deleteTemplate('${template.id}')">Delete</button>` : ''}
                </div>
            `;
            container.appendChild(card);
        });
    }

    // ===========================
    // Template Modal (with Resume Upload)
    // ===========================
    function initTemplateModal() {
        const modal = document.getElementById('templateModal');
        const addBtn = document.getElementById('addTemplateBtn');
        const closeBtn = document.getElementById('modalClose');
        const cancelBtn = document.getElementById('modalCancel');
        const saveBtn = document.getElementById('modalSave');
        const fileZone = document.getElementById('modalFileUploadZone');
        const fileInput = document.getElementById('modalResumeFile');
        const fileRemove = document.getElementById('modalFileRemove');

        if (!modal || !addBtn || !closeBtn || !cancelBtn || !saveBtn || !fileZone || !fileInput || !fileRemove) {
            console.warn('Template modal initialization skipped: missing required DOM elements');
            return;
        }

        addBtn.addEventListener('click', () => {
            state.editingTemplateId = null;
            state.modalResumeFile = null;
            const modalTitle = document.getElementById('modalTitle');
            const templateName = document.getElementById('templateName');
            const templateSubject = document.getElementById('templateSubject');
            const templateBody = document.getElementById('templateBody');
            const modalUploadContent = document.getElementById('modalUploadContent');
            const modalUploadPreview = document.getElementById('modalUploadPreview');

            if (modalTitle) modalTitle.textContent = 'Create New Template';
            if (templateName) templateName.value = '';
            if (templateSubject) templateSubject.value = '';
            if (templateBody) templateBody.value = '';
            if (modalUploadContent) modalUploadContent.style.display = 'flex';
            if (modalUploadPreview) modalUploadPreview.style.display = 'none';
            fileInput.value = '';
            modal.style.display = 'flex';
        });

        closeBtn.addEventListener('click', () => modal.style.display = 'none');
        cancelBtn.addEventListener('click', () => modal.style.display = 'none');

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });

        // File upload in modal
        fileZone.addEventListener('click', (e) => {
            if (!e.target.closest('.file-remove')) {
                fileInput.click();
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) {
                handleModalFile(fileInput.files[0]);
            }
        });

        fileZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileZone.classList.add('drag-over');
        });

        fileZone.addEventListener('dragleave', () => {
            fileZone.classList.remove('drag-over');
        });

        fileZone.addEventListener('drop', (e) => {
            e.preventDefault();
            fileZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) {
                handleModalFile(e.dataTransfer.files[0]);
            }
        });

        fileRemove.addEventListener('click', (e) => {
            e.stopPropagation();
            state.modalResumeFile = null;
            fileInput.value = '';
            const modalUploadContent = document.getElementById('modalUploadContent');
            const modalUploadPreview = document.getElementById('modalUploadPreview');
            if (modalUploadContent) modalUploadContent.style.display = 'flex';
            if (modalUploadPreview) modalUploadPreview.style.display = 'none';
        });

        saveBtn.addEventListener('click', saveTemplate);
    }

    function handleModalFile(file) {
        const validTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (!validTypes.includes(file.type)) {
            showToast('Please upload a PDF, DOC, or DOCX file', 'error');
            return;
        }

        state.modalResumeFile = file;
        document.getElementById('modalFileName').textContent = file.name;
        document.getElementById('modalFileSize').textContent = formatFileSize(file.size);
        document.getElementById('modalUploadContent').style.display = 'none';
        document.getElementById('modalUploadPreview').style.display = 'flex';
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function saveTemplate() {
        const name = document.getElementById('templateName').value.trim();
        const subject = document.getElementById('templateSubject').value.trim();
        const body = document.getElementById('templateBody').value.trim();

        if (!name) { showToast('Please enter a template name', 'error'); return; }
        if (!subject) { showToast('Please enter an email subject', 'error'); return; }
        if (!body) { showToast('Please enter the email body', 'error'); return; }

        const doSave = async (resumeName, resumeDataUrl) => {
            let targetTemplate = null;

            if (state.editingTemplateId) {
                // Update existing
                const idx = state.templates.findIndex(t => t.id === state.editingTemplateId);
                if (idx !== -1) {
                    state.templates[idx].name = name;
                    state.templates[idx].subject = subject;
                    state.templates[idx].body = body;
                    if (state.modalResumeFile) {
                        state.templates[idx].resumeName = resumeName;
                        state.templates[idx].resumeDataUrl = resumeDataUrl;
                    }
                    targetTemplate = state.templates[idx];
                    showToast('Template updated successfully!', 'success');
                }
            } else {
                // Create new
                targetTemplate = {
                    id: 'tpl-' + Date.now(),
                    name,
                    subject,
                    body,
                    resumeName: resumeName,
                    resumeDataUrl: resumeDataUrl,
                    isDefault: false
                };
                state.templates.push(targetTemplate);
                showToast('Template created successfully!', 'success');
            }

            if (targetTemplate) {
                await saveTemplateToServer(targetTemplate);
            }

            renderTemplatesGrid();
            renderTemplateChips();
            updateTemplateResumeInfo();
            updatePreview();
            document.getElementById('templateModal').style.display = 'none';
        };

        // If there's a new file, read it as data URL for storage
        if (state.modalResumeFile) {
            const reader = new FileReader();
            reader.onload = () => {
                doSave(state.modalResumeFile.name, reader.result);
            };
            reader.readAsDataURL(state.modalResumeFile);
        } else {
            // Keep existing resume if editing, or null if new
            if (state.editingTemplateId) {
                doSave(null, null); // won't overwrite because of the check inside
            } else {
                doSave(null, null);
            }
        }
    }

    // Global template actions
    window.app = {
        editTemplate(id) {
            const template = state.templates.find(t => t.id === id);
            if (!template) return;

            state.editingTemplateId = id;
            state.modalResumeFile = null;
            document.getElementById('modalTitle').textContent = 'Edit Template';
            document.getElementById('templateName').value = template.name;
            document.getElementById('templateSubject').value = template.subject;
            document.getElementById('templateBody').value = template.body;

            // Show existing resume if any
            if (template.resumeName) {
                document.getElementById('modalFileName').textContent = template.resumeName;
                document.getElementById('modalFileSize').textContent = 'Saved';
                document.getElementById('modalUploadContent').style.display = 'none';
                document.getElementById('modalUploadPreview').style.display = 'flex';
            } else {
                document.getElementById('modalUploadContent').style.display = 'flex';
                document.getElementById('modalUploadPreview').style.display = 'none';
            }

            document.getElementById('modalResumeFile').value = '';
            document.getElementById('templateModal').style.display = 'flex';
        },

        async duplicateTemplate(id) {
            const template = state.templates.find(t => t.id === id);
            if (!template) return;

            const newTpl = {
                id: 'tpl-' + Date.now(),
                name: template.name + ' (Copy)',
                subject: template.subject,
                body: template.body,
                resumeName: template.resumeName,
                resumeDataUrl: template.resumeDataUrl,
                isDefault: false
            };

            state.templates.push(newTpl);
            await saveTemplateToServer(newTpl);
            
            renderTemplatesGrid();
            renderTemplateChips();
            showToast('Template duplicated!', 'info');
        },

        async deleteTemplate(id) {
            if (!confirm('Are you sure you want to delete this template?')) return;

            state.templates = state.templates.filter(t => t.id !== id);
            if (state.selectedTemplate === id) {
                state.selectedTemplate = null;
                updatePreview();
                updateTemplateResumeInfo();
            }

            try {
                await fetch(`${API_BASE}/api/templates/${id}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                showToast('Template deleted', 'info');
            } catch (error) {
                console.error('Error deleting template from server:', error);
            }

            renderTemplatesGrid();
            renderTemplateChips();
        }
    };

    // ===========================
    // History
    // ===========================
    function renderHistory() {
        const container = document.getElementById('historyList');
        const emptyState = document.getElementById('emptyHistory');
        const badge = document.getElementById('historyBadge');

        if (badge) badge.textContent = state.history.length;

        if (state.history.length === 0) {
            if (container) container.innerHTML = '';
            if (emptyState) emptyState.style.display = 'flex';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (container) container.innerHTML = '';

        const searchTerm = (document.getElementById('historySearch')?.value || '').toLowerCase();

        const filtered = state.history.filter(item => {
            if (!searchTerm) return true;
            return item.receiverEmail.toLowerCase().includes(searchTerm)
                || item.templateName.toLowerCase().includes(searchTerm);
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                    </div>
                    <h3>No results found</h3>
                    <p>Try a different search term</p>
                </div>
            `;
            return;
        }

        filtered.forEach(item => {
            const initials = item.receiverEmail.substring(0, 2).toUpperCase();
            const date = new Date(item.timestamp);
            const timeStr = formatDate(date);

            const el = document.createElement('div');
            el.className = 'history-item';
            el.innerHTML = `
                <div class="history-avatar">${initials}</div>
                <div class="history-info">
                    <div class="history-email">${escapeHtml(item.receiverEmail)}</div>
                    <div class="history-meta">
                        <span class="history-template">${escapeHtml(item.templateName)}</span>
                        ${item.hasResume ? '<span class="history-resume-tag">• 📎 Resume</span>' : ''}
                    </div>
                </div>
                <span class="history-time">${timeStr}</span>
                <div class="history-status" title="Sent"></div>
            `;
            container.appendChild(el);
        });
    }

    function formatDate(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHrs < 24) return `${diffHrs}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function initHistorySearch() {
        document.getElementById('historySearch').addEventListener('input', renderHistory);
    }

    function initClearHistory() {
        document.getElementById('clearHistoryBtn').addEventListener('click', async () => {
            if (state.history.length === 0) {
                showToast('No history to clear', 'info');
                return;
            }
            if (!confirm('Are you sure you want to clear all history?')) return;
            
            try {
                const response = await fetch(`${API_BASE}/api/history`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                const result = await response.json();
                if (result.success) {
                    state.history = [];
                    renderHistory();
                    updateStats();
                    showToast('History cleared', 'info');
                } else {
                    showToast('Failed to clear history on server', 'error');
                }
            } catch (error) {
                showToast('Error clearing history on server', 'error');
            }
        });
    }

    // ===========================
    // Stats
    // ===========================
    function updateStats() {
        document.getElementById('totalSentStat').textContent = state.history.length;
        document.getElementById('historyBadge').textContent = state.history.length;

        const today = new Date().toDateString();
        const todayCount = state.history.filter(h => new Date(h.timestamp).toDateString() === today).length;
        document.getElementById('todaySentStat').textContent = todayCount;
    }

    // ===========================
    // Live Preview Updates
    // ===========================
    function initLivePreview() {
        ['senderEmail', 'receiverEmail'].forEach(id => {
            document.getElementById(id).addEventListener('input', updatePreview);
        });

        // Auto-save sender email when typing stops
        let saveTimeout;
        document.getElementById('senderEmail').addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveSenderEmail, 800);
        });
    }

    // ===========================
    // Toast Notifications
    // ===========================
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00b894" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff7675" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c5ce7" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${escapeHtml(message)}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 4000);
    }

    // ===========================
    // Utility
    // ===========================
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===========================
    // Initialize App
    // ===========================
    function init() {
        initParticles();
        initAuth();
        initNavigation();
        initTemplateModal();
        initSendButton();
        initHistorySearch();
        initClearHistory();
        initLivePreview();

        // This will load templates & history or prompt for login
        loadState();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
