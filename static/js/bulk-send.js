/**
 * Bulk Send — one separate SMTP message per To recipient (personalized).
 */
(function () {
    const API_BASE_URL = 'http://127.0.0.1:5000/api';
    const STORAGE_DRAFT = 'neuralmail_bulk_draft';

    function parseEmailField(value) {
        if (!value || !String(value).trim()) return [];
        const seen = new Set();
        return String(value)
            .split(/[,;\n]+/)
            .map((s) => s.trim().toLowerCase())
            .filter((email) => email && email.includes('@') && !seen.has(email) && seen.add(email));
    }

    function createRecipientRow(name = '', email = '') {
        const row = document.createElement('div');
        row.className =
            'bulk-recipient-row grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_auto] gap-3 items-center';
        row.innerHTML = `
            <input type="text" class="bulk-recipient-name w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Name" value="${escapeAttr(name)}">
            <input type="email" class="bulk-recipient-email w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="email@gmail.com" value="${escapeAttr(email)}">
            <button type="button" class="bulk-remove-row w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all" title="Remove">
                <span class="material-symbols-outlined text-sm">close</span>
            </button>
        `;
        row.querySelector('.bulk-remove-row').addEventListener('click', () => {
            const list = document.getElementById('bulk-recipients-list');
            if (list && list.querySelectorAll('.bulk-recipient-row').length > 1) {
                row.remove();
            }
        });
        return row;
    }

    function escapeAttr(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    function addRecipientRow(name, email) {
        const list = document.getElementById('bulk-recipients-list');
        if (!list) return;
        list.appendChild(createRecipientRow(name, email));
    }

    function collectRecipients() {
        const rows = document.querySelectorAll('.bulk-recipient-row');
        const out = [];
        rows.forEach((row) => {
            const name = row.querySelector('.bulk-recipient-name')?.value.trim() || '';
            const email = row.querySelector('.bulk-recipient-email')?.value.trim().toLowerCase() || '';
            if (email) out.push({ name, email });
        });
        return out;
    }

    function saveDraftToStorage(subject, body) {
        localStorage.setItem(STORAGE_DRAFT, JSON.stringify({ subject, body }));
    }

    function loadDraftFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_DRAFT);
            if (!raw) return;
            const draft = JSON.parse(raw);
            const subjectEl = document.getElementById('bulk-subject');
            const bodyEl = document.getElementById('bulk-body');
            if (subjectEl && draft.subject) subjectEl.value = draft.subject;
            if (bodyEl && draft.body) bodyEl.value = draft.body;
        } catch (e) {
            console.warn('Draft load failed', e);
        }
    }

    function applyDraftFromContent(fullContent) {
        const EF = window.EmailFormat || {};
        const parsed = EF.parseEmailContent
            ? EF.parseEmailContent(fullContent)
            : { subject: '', body: fullContent };
        const subjectEl = document.getElementById('bulk-subject');
        const bodyEl = document.getElementById('bulk-body');
        if (subjectEl) subjectEl.value = parsed.subject || '';
        if (bodyEl) bodyEl.value = parsed.body || fullContent || '';
        saveDraftToStorage(subjectEl?.value || '', bodyEl?.value || '');
    }

    async function loadSmtpSettings() {
        const userId = localStorage.getItem('user_id');
        if (!userId) return;
        try {
            const res = await fetch(`${API_BASE_URL}/smtp-settings?user_id=${userId}`);
            const data = await res.json();
            if (res.ok && data.smtp_email) {
                const emailEl = document.getElementById('bulk-smtp-email');
                if (emailEl) emailEl.value = data.smtp_email;
                const status = document.getElementById('bulk-smtp-status');
                if (status && data.configured) {
                    status.textContent = 'Gmail connected (saved app password on server)';
                    status.classList.add('text-secondary');
                }
            }
        } catch (e) {
            console.warn('SMTP settings load failed', e);
        }
    }

    async function saveSmtpSettings() {
        const userId = localStorage.getItem('user_id');
        const smtpEmail = document.getElementById('bulk-smtp-email')?.value.trim();
        const smtpPassword = document.getElementById('bulk-smtp-password')?.value;

        if (!smtpEmail || !smtpPassword) {
            alert('Enter your Gmail address and app password.');
            return;
        }

        const btn = document.getElementById('bulk-save-smtp');
        if (btn) btn.disabled = true;

        try {
            const res = await fetch(`${API_BASE_URL}/smtp-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    smtp_email: smtpEmail,
                    smtp_password: smtpPassword,
                }),
            });
            const data = await res.json();
            alert(data.message || (res.ok ? 'Saved' : 'Failed'));
            if (res.ok) {
                document.getElementById('bulk-smtp-password').value = '';
            }
        } catch (e) {
            alert('Could not save SMTP settings.');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function executeBulkSend() {
        const userId = localStorage.getItem('user_id');
        const subject = document.getElementById('bulk-subject')?.value.trim();
        const body = document.getElementById('bulk-body')?.value.trim();
        const cc = parseEmailField(document.getElementById('bulk-cc')?.value);
        const bcc = parseEmailField(document.getElementById('bulk-bcc')?.value);
        const recipients = collectRecipients();
        const smtpEmail = document.getElementById('bulk-smtp-email')?.value.trim();
        const smtpPassword = document.getElementById('bulk-smtp-password')?.value || '';

        if (!recipients.length) {
            alert('Add at least one recipient with a valid email in the To section.');
            return;
        }
        if (!subject) {
            alert('Subject is required.');
            return;
        }
        if (!body) {
            alert('Email body is required.');
            return;
        }
        if (!smtpEmail) {
            alert('Enter your Gmail address in the connection settings.');
            return;
        }

        const missingNames = recipients.filter((r) => !r.name);
        if (
            missingNames.length &&
            !confirm(
                `${missingNames.length} recipient(s) have no name. Emails will use "there" instead of {{name}}. Continue?`
            )
        ) {
            return;
        }

        if (
            !confirm(
                `Send ${recipients.length} separate personalized email(s)?\n\nEach person only sees their own address in To. Other recipients will NOT be visible.`
            )
        ) {
            return;
        }

        const btn = document.getElementById('bulk-send-btn');
        const progress = document.getElementById('bulk-send-progress');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Sending…';
        }
        if (progress) {
            progress.classList.remove('hidden');
            progress.textContent = 'Sending individual emails…';
        }

        try {
            const res = await fetch(`${API_BASE_URL}/bulk-send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    subject,
                    body,
                    recipients,
                    cc,
                    bcc,
                    smtp_email: smtpEmail,
                    smtp_password: smtpPassword || undefined,
                    save_smtp: !!smtpPassword,
                }),
            });
            const data = await res.json();

            if (progress) {
                progress.textContent = data.message || 'Done';
            }

            if (res.ok) {
                renderResults(data.results || []);
                if (typeof loadDashboardData === 'function') loadDashboardData();
                alert(data.message || 'Bulk send finished.');
            } else {
                alert(data.message || 'Bulk send failed.');
            }
        } catch (e) {
            alert('Server error. Is the Flask backend running?');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Send individually to all';
            }
        }
    }

    function renderResults(results) {
        const box = document.getElementById('bulk-send-results');
        if (!box || !results.length) return;
        box.classList.remove('hidden');
        box.innerHTML = `
            <p class="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">Send results</p>
            <ul class="space-y-2 max-h-48 overflow-y-auto custom-scrollbar text-sm">
                ${results
                    .map(
                        (r) => `
                    <li class="flex justify-between gap-4 p-3 rounded-xl ${r.success ? 'bg-secondary/10 text-secondary' : 'bg-red-500/10 text-red-400'}">
                        <span class="truncate">${escapeAttr(r.name || r.email)} &lt;${escapeAttr(r.email)}&gt;</span>
                        <span class="font-bold text-[10px] uppercase">${r.success ? 'Sent' : 'Failed'}</span>
                    </li>`
                    )
                    .join('')}
            </ul>
        `;
    }

    function initBulkSend() {
        const addBtn = document.getElementById('bulk-add-recipient');
        if (addBtn) addBtn.addEventListener('click', () => addRecipientRow());

        const saveSmtpBtn = document.getElementById('bulk-save-smtp');
        if (saveSmtpBtn) saveSmtpBtn.addEventListener('click', saveSmtpSettings);

        const sendBtn = document.getElementById('bulk-send-btn');
        if (sendBtn) sendBtn.addEventListener('click', executeBulkSend);

        const list = document.getElementById('bulk-recipients-list');
        if (list && !list.children.length) {
            addRecipientRow();
            addRecipientRow();
        }

        loadDraftFromStorage();
        loadSmtpSettings();
    }

    window.BulkSend = {
        STORAGE_DRAFT,
        addRecipientRow,
        applyDraftFromContent,
        saveDraftToStorage,
        initBulkSend,
        loadDraftFromStorage,
    };

    document.addEventListener('DOMContentLoaded', initBulkSend);
})();
