// NeuralMail Frontend Auth - Connecting to Flask + MySQL Backend

const API_BASE_URL = "http://127.0.0.1:5000/api"; // Aapka Python Flask Server Address

/**
 * 1. SIGNUP HANDLER
 * signup.html ke form submit par ye function chalay ga
 */
async function handleSignup(event) {
    event.preventDefault(); // Page reload hone se rokta hai
    
    // Form se data nikalna (Input fields ki sequence ke mutabiq)
    const fullName = event.target[0].value;
    const company  = event.target[1].value;
    const email    = event.target[2].value;
    const password = event.target[3].value;

    const signupData = {
        full_name: fullName,
        company: company,
        email: email,
        password: password
    };

    try {
        const response = await fetch(`${API_BASE_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(signupData)
        });

        const result = await response.json();

        if (response.ok) {
            alert("Account created! Now please login.");
            window.location.href = "/login";
        } else {
            alert("Signup Failed: " + result.message);
        }
    } catch (error) {
        console.error("Network Error:", error);
        alert("Server se connection nahi ho pa raha. Pehle Flask run karein!");
    }
}

/**
 * 2. LOGIN HANDLER
 * login.html ke form submit par ye function chalay ga
 */
async function handleLogin(event) {
    event.preventDefault();

    const loginData = {
        email: event.target[0].value,
        password: event.target[1].value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loginData)
        });

        const result = await response.json();
if (response.ok) {
    localStorage.setItem("user_id", result.user_id);
    localStorage.setItem("user_token", result.user_id); // token ke jagah user_id use kar rahe (backend token generate nahi karta)
    localStorage.setItem("user_name", result.full_name);
    localStorage.setItem("user_role", result.role || "Full Stack Developer"); // FIX: role save karo
    
    window.location.href = "/dashboard";

        } else {
            alert("Login Failed: " + result.message);
        }
    } catch (error) {
        console.error("Network Error:", error);
        alert("Login failed. Backend check karein.");
    }
}

/**
 * 3. AUTH PROTECTOR
 * Ye check karta hai ke user logged-in hai ya nahi
 */
function checkSession() {
    const userId = localStorage.getItem("user_id");
    const path = window.location.pathname;

    if (!userId && path.includes("dashboard")) {
        window.location.href = "/login";
    }

    if (userId && (path.includes("login") || path.includes("signup"))) {
        window.location.href = "/dashboard";
    }
}

// Har page load par check karein
document.addEventListener('DOMContentLoaded', checkSession);