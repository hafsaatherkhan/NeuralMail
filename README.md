# 🌌 NeuralMail | AI-Powered Outreach Engine

NeuralMail is a sophisticated **SaaS-style** cold email automation platform. It uses **Gemini 2.5 Flash** to analyze business contexts and generate high-converting, personalized outreach emails at scale.

## ✨ Key Features
- **AI-Driven Personalization:** Analyzes target URLs to create unique hooks.
- **Bulk Processing:** Upload Excel/CSV leads and generate hundreds of drafts in seconds.
- **Secure Architecture:** Password hashing (Werkzeug) and secure SMTP storage.
- **Custom SMTP:** Users can integrate their own professional sender emails.
- **Futuristic UI:** Dark-themed dashboard built with Tailwind CSS and GSAP animations.

## 🛠️ Tech Stack
- **Frontend:** HTML5, Tailwind CSS, JavaScript (ES6), GSAP.
- **Backend:** Python (Flask), MySQL.
- **AI Engine:** Google Gemini 2.5 Flash.
- **Data Handling:** Pandas (for Excel/CSV parsing).

## 🚀 Getting Started

### 1. Database Setup
Create a MySQL database named `neuralmail_db`. The system will automatically generate the required tables on the first run.

### 2. Environment Variables (`.env`)
Create a `.env` file in the root directory:
```text
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=neuralmail_db
GEMINI_API_KEY=your_gemini_api_key