const API_BASE_URL = "http://127.0.0.1:5000/api";

/**
 * 1. INITIALIZATION: Load User Data
 */
document.addEventListener('DOMContentLoaded', () => {
    // Check login
    const userId = localStorage.getItem('user_id');
    if (!userId) {
        window.location.href = '/login';
        return;
    }

    const name = localStorage.getItem('user_name') || "User";
    const role = localStorage.getItem('user_role') || "Full Stack Developer";

    updateProfileUI(name, role);
    loadDashboardData();
});

function updateProfileUI(name, role) {
    const nameEl = document.getElementById('display-name');
    const roleEl = document.getElementById('display-role');
    const initEl = document.getElementById('user-initials');

    if (nameEl) nameEl.innerText = name;
    if (roleEl) roleEl.innerText = role;
    if (initEl) initEl.innerText = name.charAt(0).toUpperCase();
}

/**
 * PROFILE EDIT MODAL (was missing - causing editProfile() error)
 */
function editProfile() {
    const currentName = localStorage.getItem('user_name') || '';
    const currentRole = localStorage.getItem('user_role') || '';

    const modalHTML = `
        <div id="profileModal" class="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[200] p-6">
            <div class="bg-[#10131a] border border-white/10 p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl">
                <div class="flex justify-between items-center mb-8">
                    <h3 class="text-2xl font-headline font-black text-white">Edit Profile</h3>
                    <button onclick="document.getElementById('profileModal').remove()" 
                            class="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all">✕</button>
                </div>

                <div class="space-y-5">
                    <div>
                        <label class="text-[10px] font-black uppercase text-primary tracking-widest block mb-2">Full Name</label>
                        <input type="text" id="edit-name" value="${currentName}" 
                               class="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:ring-2 focus:ring-primary/20 outline-none">
                    </div>
                    <div>
                        <label class="text-[10px] font-black uppercase text-primary tracking-widest block mb-2">Role / Title</label>
                        <input type="text" id="edit-role" value="${currentRole}" placeholder="e.g. Full Stack Developer"
                               class="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:ring-2 focus:ring-primary/20 outline-none">
                    </div>
                </div>

                <div class="mt-8 grid grid-cols-2 gap-4">
                    <button onclick="document.getElementById('profileModal').remove()" 
                            class="py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all">Cancel</button>
                    <button onclick="saveProfile()" 
                            class="py-4 bg-primary text-[#440080] rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">Save Changes</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

async function saveProfile() {
    const newName = document.getElementById('edit-name').value.trim();
    const newRole = document.getElementById('edit-role').value.trim();
    const userId  = localStorage.getItem('user_id');

    if (!newName) return alert("Name empty nahi ho sakta!");

    try {
        const response = await fetch(`${API_BASE_URL}/update-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, full_name: newName, role: newRole })
        });

        if (response.ok) {
            localStorage.setItem('user_name', newName);
            localStorage.setItem('user_role', newRole);
            updateProfileUI(newName, newRole);
            document.getElementById('profileModal').remove();
        } else {
            alert("Profile update failed. Try again.");
        }
    } catch (e) {
        // Even if API fails, update locally
        localStorage.setItem('user_name', newName);
        localStorage.setItem('user_role', newRole);
        updateProfileUI(newName, newRole);
        document.getElementById('profileModal').remove();
    }
}

/**
 * 2. TAB SWITCHING LOGIC
 */
function switchTab(tabName) {
    const sections = ['writer', 'history', 'analytics'];

    sections.forEach(s => {
        const sectionEl = document.getElementById(`section-${s}`);
        const btnEl = document.getElementById(`btn-${s}`);
        if (sectionEl && btnEl) {
            sectionEl.classList.add('section-hidden');
            btnEl.classList.remove('nav-active', 'text-primary');
            btnEl.classList.add('text-slate-500');
        }
    });

    const activeSection = document.getElementById(`section-${tabName}`);
    const activeBtn = document.getElementById(`btn-${tabName}`);

    if (activeSection && activeBtn) {
        activeSection.classList.remove('section-hidden');
        activeBtn.classList.add('nav-active', 'text-primary');
        activeBtn.classList.remove('text-slate-500');
        if (typeof gsap !== 'undefined') {
            gsap.fromTo(activeSection, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.4 });
        }
    }

    if (tabName === 'analytics') {
        renderAnalyticsChart(window.latestWeeklyStats);
    }
}

/**
 * 3. DYNAMIC STATS & HISTORY FETCH (Fixed API URL + Analytics IDs)
 */
window.latestWeeklyStats = [0, 0, 0, 0, 0, 0, 0];

async function loadDashboardData() {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;

    try {
        // FIX: was /api/api/stats - removed duplicate /api
        const response = await fetch(`${API_BASE_URL}/stats?user_id=${userId}`);
        const data = await response.json();

        if (response.ok) {
            const total     = data.total_emails || 0;
            const openRate  = data.open_rate || 0;
            const bounced   = data.bounced || 0;

            // Writer section stats
            const totalEl   = document.getElementById('total-emails');
            const openEl    = document.getElementById('open-rate');
            const bouncedEl = document.getElementById('bounced-emails');
            if (totalEl)   totalEl.innerText   = total;
            if (openEl)    openEl.innerText     = openRate + "%";
            if (bouncedEl) bouncedEl.innerText  = bounced;

            // Analytics section stats (different IDs in HTML)
            const aTotalEl   = document.getElementById('stat-total');
            const aOpenEl    = document.getElementById('stat-open-rate');
            const aBouncedEl = document.getElementById('stat-bounced');
            if (aTotalEl)   aTotalEl.innerText   = total;
            if (aOpenEl)    aOpenEl.innerText     = openRate + "%";
            if (aBouncedEl) aBouncedEl.innerText  = bounced;

            // Store weekly stats for chart
            if (data.weekly_stats && data.weekly_stats.length > 0) {
                window.latestWeeklyStats = data.weekly_stats;
            }

            // History Table
            const tableBody = document.getElementById('history-table-body');
            if (tableBody) {
                if (data.history && data.history.length > 0) {
                    tableBody.innerHTML = data.history.map(row => {
                        const safeContent = (row.content || '');
                        // Extract first subject from stored email content
                        const subjectMatch = safeContent.match(/Subject:\s*(.+?)(\r?\n|$)/i);
                        const displaySubject = subjectMatch ? subjectMatch[1].trim() : (row.subject || 'Multi-Draft');
                        return `
                        <tr class="hover:bg-white/5 transition-all border-b border-white/5 group">
                            <td class="p-5 text-slate-400 text-[11px] font-medium">
                                ${new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                            </td>
                            <td class="p-5">
                                <div class="text-white font-bold text-sm truncate max-w-[150px]">${row.recipient}</div>
                                <div class="text-[10px] text-slate-500 truncate max-w-[150px]">${displaySubject}</div>
                            </td>
                            <td class="p-5">
                                <span class="px-3 py-1 bg-primary/10 text-primary rounded-full text-[9px] font-black uppercase tracking-tighter">
                                    ${row.status}
                                </span>
                            </td>
                            <td class="p-5 text-right">
                                <div class="flex justify-end gap-3">
                                    <button onclick="viewHistoryDetail(${row.id})" 
                                            class="text-slate-400 hover:text-white transition-colors" title="View Detail">
                                        <span class="material-symbols-outlined text-sm">visibility</span>
                                    </button>
                                    <button onclick="deleteHistoryItem(${row.id})" 
                                            class="text-slate-600 hover:text-red-400 transition-colors" title="Delete">
                                        <span class="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        `;
                    }).join('');

                    // Store history data globally for view modal
                    window.historyData = data.history;
                } else {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="4" class="p-20 text-center">
                                <div class="flex flex-col items-center opacity-20">
                                    <span class="material-symbols-outlined text-5xl mb-2">history_toggle_off</span>
                                    <p class="text-sm font-medium">No recent history found</p>
                                </div>
                            </td>
                        </tr>`;
                }
            }
        }
    } catch (err) {
        console.error("Dashboard Load Error:", err);
    }
}

// History View - fetch from stored data
function viewHistoryDetail(id) {
    const row = (window.historyData || []).find(r => r.id === id);
    const content = row ? row.content : 'Content not found.';
    selectAndMaximize('History Log', content);
}

// Delete Function
async function deleteHistoryItem(id) {
    if (!confirm("Are you sure you want to delete this log?")) return;

    const response = await fetch(`${API_BASE_URL}/delete-history`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, user_id: localStorage.getItem('user_id') })
    });

    if (response.ok) loadDashboardData();
}

/**
 * MARKDOWN RENDERER
 * Converts **bold**, _italic_, and newlines to HTML for email display
 */
function renderMarkdown(text) {
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') // escape HTML first
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')                    // **bold**
        .replace(/_(.+?)_/g, '<em>$1</em>')                                  // _italic_
        .replace(/\n/g, '<br>');                                              // newlines
}

/**
 * Parse email text into { subject, body } parts
 */
function parseEmailParts(text) {
    const trimmed = text.trim();
    const subjectMatch = trimmed.match(/^Subject:\s*(.+?)(\r?\n|$)/i);
    if (subjectMatch) {
        const subject = subjectMatch[1].trim();
        const body = trimmed.slice(subjectMatch[0].length).trim();
        return { subject, body };
    }
    return { subject: null, body: trimmed };
}


async function copyDraft(btn, text) {
    try {
        await navigator.clipboard.writeText(text);
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm text-secondary">done</span>';
        setTimeout(() => btn.innerHTML = originalIcon, 2000);
    } catch (err) {
        console.error('Copy failed', err);
    }
}

/**
 * 5. MAXIMIZE MODAL - with working Gmail button
 */
function selectAndMaximize(label, content) {
    const existing = document.getElementById('maximizeModal');
    if (existing) existing.remove();

    const { subject, body } = parseEmailParts(content);
    const emailSubject = subject || `${label} - Cold Email`;
    const emailBody = body || content;

    // Gmail URL uses the actual subject line and clean body (no markdown syntax)
    const plainBody = emailBody.replace(/\*\*(.+?)\*\*/g, '$1').replace(/_(.+?)_/g, '$1');
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(plainBody)}`;

    // Rendered HTML for display
    const displayHtml = renderMarkdown(emailBody);

    const modal = document.createElement('div');
    modal.id = 'maximizeModal';
    modal.className = 'fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[200] p-6';
    modal.innerHTML = `
        <div class="bg-[#10131a] border border-white/10 p-8 rounded-[2.5rem] max-w-3xl w-full shadow-2xl relative">
            <div class="flex justify-between items-start mb-6">
                <div>
                    <span class="bg-primary/20 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">${label}</span>
                    ${subject ? `<p class="text-white font-bold text-lg mt-3">📧 ${subject.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>` : '<h3 class="text-2xl font-headline font-black text-white mt-2">Ready to Send</h3>'}
                </div>
                <button id="closeMaxModal" class="w-12 h-12 flex items-center justify-center rounded-full bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all">✕</button>
            </div>

            <div class="bg-black/40 p-8 rounded-3xl border border-white/5 text-slate-200 leading-relaxed text-sm overflow-y-auto max-h-[45vh] custom-scrollbar">
                ${displayHtml}
            </div>

            <div class="mt-8 grid grid-cols-2 gap-4">
                <button id="copyModalBtn" class="py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold uppercase tracking-widest text-xs transition-all">
                    Copy Content
                </button>
                <a href="${gmailUrl}" target="_blank" rel="noopener noreferrer"
                   class="py-4 bg-primary text-[#440080] rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all text-center flex items-center justify-center gap-2 no-underline">
                    <span class="material-symbols-outlined text-sm">open_in_new</span>
                    Open in Gmail
                </a>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('closeMaxModal').onclick = () => modal.remove();

    document.getElementById('copyModalBtn').onclick = async function() {
        try {
            await navigator.clipboard.writeText(plainBody);
            this.innerText = '✓ Copied!';
            setTimeout(() => this.innerText = 'Copy Content', 2000);
        } catch(e) {
            alert('Copy failed. Please select text manually.');
        }
    };
}

/**
 * 6. AI GENERATION (3-Card Layout)
 */
async function generateEmail(event) {
    const urlInput = document.getElementById('target-url');
    const previewArea = document.getElementById('email-preview');
    if (!urlInput.value.trim()) return alert("URL enter karein!");

    previewArea.innerHTML = `<div class="flex justify-center p-20 w-full"><div class="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div></div>`;

    try {
        const response = await fetch(`${API_BASE_URL}/generate-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: urlInput.value.trim(), user_id: localStorage.getItem('user_id') })
        });
        const data = await response.json();

        if (response.ok) {
            const drafts = data.email_content.split('###').filter(d => d.trim());
            const labels = ["Professional", "Creative", "Short & Punchy"];

            previewArea.innerHTML = drafts.map((content, index) => {
                const cleanContent = content.trim();
                const label = labels[index] || `Variation ${index + 1}`;
                const draftId = `draft_${index}_${Date.now()}`;
                const { subject, body } = parseEmailParts(cleanContent);

                // Store raw content for copy/gmail
                window[draftId] = cleanContent;

                const previewHtml = renderMarkdown((body || cleanContent).split('\n').slice(0, 3).join('\n'));

                return `
                <div class="glass-card p-6 rounded-[2rem] flex flex-col justify-between border border-white/5 hover:border-primary/40 transition-all duration-300 group mb-6">
                    <div>
                        <div class="flex justify-between items-center mb-4">
                            <span class="text-[9px] font-bold text-primary border border-primary/30 px-2 py-0.5 rounded uppercase tracking-tighter bg-primary/10">${label}</span>
                            <button onclick="copyDraft(this, window['${draftId}'])" 
                                    class="text-slate-500 hover:text-white transition-colors" title="Copy to clipboard">
                                <span class="material-symbols-outlined text-sm">content_copy</span>
                            </button>
                        </div>
                        ${subject ? `<p class="text-[10px] text-primary/70 font-semibold mb-2 truncate">📧 ${subject}</p>` : ''}
                        <p class="text-[13px] text-slate-300 leading-relaxed overflow-hidden line-clamp-3">
                            ${previewHtml}
                        </p>
                    </div>
                    <button onclick="selectAndMaximize('${label}', window['${draftId}'])" 
                            class="mt-5 w-full py-2.5 bg-white/5 hover:bg-primary text-white hover:text-background rounded-lg text-[10px] font-black uppercase tracking-widest transition-all">
                        Select & Maximize
                    </button>
                </div>
                `;
            }).join('');

            loadDashboardData(); // Refresh stats + history
        } else {
            previewArea.innerHTML = `<div class="glass-card p-8 rounded-[2rem] text-center text-red-400">${data.message || 'Generation failed.'}</div>`;
        }
    } catch (e) {
        console.error(e);
        previewArea.innerHTML = `<div class="glass-card p-8 rounded-[2rem] text-center text-red-400">Server Error. Flask backend check karein.</div>`;
    }
}

/**
 * 7. CHART
 */
let myChart = null;
function renderAnalyticsChart(chartData = [0, 0, 0, 0, 0, 0, 0]) {
    const canvas = document.getElementById('analyticsChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                data: chartData,
                borderColor: '#c799ff',
                backgroundColor: 'rgba(199, 153, 255, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#c799ff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#525866', font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { color: '#525866', font: { size: 10 } } }
            }
        }
    });
}

function handleLogout() {
    localStorage.clear();
    window.location.href = "/";
}

// Global Exports
window.switchTab = switchTab;
window.generateEmail = generateEmail;
window.handleLogout = handleLogout;
window.editProfile = editProfile;
window.saveProfile = saveProfile;
window.copyDraft = copyDraft;
window.selectAndMaximize = selectAndMaximize;
window.viewHistoryDetail = viewHistoryDetail;
window.deleteHistoryItem = deleteHistoryItem;
