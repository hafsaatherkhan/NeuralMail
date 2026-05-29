/**
 * Parse and render generated emails without changing their structure.
 */
(function (global) {
    const APP_FONT = "'Tenor Sans', Georgia, 'Times New Roman', serif";

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Split subject line from body when the email starts with "Subject: ..."
     */
    function parseEmailContent(raw) {
        const full = String(raw || '').trim();
        if (!full) return { subject: '', body: '', full: '' };

        const lines = full.split(/\r?\n/);
        const firstLine = (lines[0] || '').trim();

        const patterns = [
            /^Subject\s*:\s*(.+)$/i,
            /^\*\*Subject\*\*\s*:\s*(.+)$/i,
            /^\*\*Subject:\*\*\s*(.+)$/i,
        ];

        for (const pattern of patterns) {
            const match = firstLine.match(pattern);
            if (match) {
                const subject = match[1].trim();
                const body = lines.slice(1).join('\n').replace(/^\s*\n+/, '');
                return { subject, body: body || full, full };
            }
        }

        return { subject: '', body: full, full };
    }

    /**
     * Render markdown-style emphasis for live preview (structure preserved).
     */
    function formatEmailForPreview(raw) {
        let html = escapeHtml(raw);

        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
        html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
        html = html.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '<em>$1</em>');
        html = html.replace(/\r?\n/g, '<br>');

        return html;
    }

    function resolveGmailParts(content, fallbackSubject) {
        const { subject, body } = parseEmailContent(content);
        return {
            subject: subject || fallbackSubject || '',
            body: body || content || '',
        };
    }

    function buildGmailComposeUrl(content, fallbackSubject) {
        const { subject, body } = resolveGmailParts(content, fallbackSubject);
        const params = new URLSearchParams({
            view: 'cm',
            fs: '1',
            su: subject,
            body: body,
        });
        return `https://mail.google.com/mail/?${params.toString()}`;
    }

    function personalizeTemplate(template, name) {
        const display = (name || '').trim() || 'there';
        return String(template || '')
            .replace(/\{\{\s*name\s*\}\}/gi, display)
            .replace(/\{name\}/gi, display)
            .replace(/\[Name\]/g, display);
    }

    global.EmailFormat = {
        APP_FONT,
        escapeHtml,
        parseEmailContent,
        formatEmailForPreview,
        resolveGmailParts,
        buildGmailComposeUrl,
        personalizeTemplate,
    };
})(typeof window !== 'undefined' ? window : globalThis);
