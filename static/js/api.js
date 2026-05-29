// NeuralMail API Bridge - Connecting Frontend to Gemini 2.5 Flash & MySQL

const API_BASE_URL = "http://127.0.0.1:5000/api";

/**
 * 🛠️ UTILITY: Get Auth Headers
 */
const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem("user_token")}`
});

/**
 * 1. GENERATE AI EMAIL
 * Single lead ke liye Gemini 2.5 Flash se email likhwana.
 */
async function triggerAIGeneration(websiteUrl) {
    try {
        const response = await fetch(`${API_BASE_URL}/generate-email`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ url: websiteUrl })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "AI Generation Failed");
        
        return data; // Returns { email_content: "..." }
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw error;
    }
}

/**
 * 2. UPDATE SMTP SETTINGS
 * Dashboard ke settings tab se user ka apna email aur app password save karna.
 */
async function updateUserSettings(smtpEmail, smtpPassword) {
    const userId = localStorage.getItem("user_id"); // Login ke waqt save kiya tha

    try {
        const response = await fetch(`${API_BASE_URL}/update-settings`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                user_id: userId,
                smtp_email: smtpEmail,
                smtp_password: smtpPassword
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        return data;
    } catch (error) {
        alert("Settings Error: " + error.message);
        throw error;
    }
}

/**
 * 3. UPLOAD & PROCESS LEADS (BULK)
 * Excel/CSV file ko backend par processing ke liye bhejna.
 */
async function processBulkLeads(file) {
    const formData = new FormData();
    formData.append("file", file);

    try {
        // Note: FormData ke liye Content-Type header manually set nahi karte
        const response = await fetch(`${API_BASE_URL}/process-bulk`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem("user_token")}`
            },
            body: formData
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        return data.results; // Array of processed leads with AI emails
    } catch (error) {
        console.error("Bulk Upload Error:", error);
        throw error;
    }
}

/**
 * 4. FETCH HISTORY
 * User ke purane campaigns ka data MySQL se lana.
 */
async function fetchUserHistory() {
    try {
        const response = await fetch(`${API_BASE_URL}/history`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (response.ok) return await response.json();
        return [];
    } catch (error) {
        console.error("History Fetch Error:", error);
        return [];
    }
}