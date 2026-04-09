import os
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai 
from werkzeug.security import generate_password_hash, check_password_hash

from database import Database
db = Database()

load_dotenv()

app = Flask(__name__, template_folder='templates')
CORS(app)

# Gemini AI Client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL_ID = "gemini-2.5-flash" # Ensure this matches your model access

# --- FRONTEND ROUTES ---
@app.route('/')
def index(): return render_template('index.html')

@app.route('/login')
def login_page(): return render_template('login.html')

@app.route('/signup')
def signup_page(): return render_template('signup.html')

@app.route('/dashboard')
def dashboard_page(): return render_template('dashboard.html')

@app.route('/privacy')
def privacy_page():
    return render_template('legal.html', section='privacy')

@app.route('/terms')
def terms_page():
    return render_template('legal.html', section='terms')
@app.route('/api/delete-history', methods=['DELETE'])
def delete_history():
    data = request.json
    history_id = data.get('id')
    user_id = data.get('user_id')
    
    # Apni database.py mein ye function banayein
    if db.delete_campaign_log(history_id, user_id):
        return jsonify({"message": "Deleted"}), 200
    return jsonify({"message": "Failed"}), 500
# --- AUTH API SIGNUP ---
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()
    full_name = data.get('full_name', '').strip()
    company = data.get('company', 'Not Specified').strip()

    # Input validation
    if not full_name:
        return jsonify({"message": "Full name is required."}), 400
    if not email or '@' not in email:
        return jsonify({"message": "Please enter a valid email address."}), 400
    if len(password) < 6:
        return jsonify({"message": "Password must be at least 6 characters."}), 400

    # Check if email already registered
    if db.get_user_by_email(email):
        return jsonify({"message": "This email is already registered. Please log in instead."}), 409

    hashed_password = generate_password_hash(password)

    if db.create_user(full_name, company, email, hashed_password):
        return jsonify({"status": "success", "message": "Account created! Please log in."}), 201
    return jsonify({"message": "Something went wrong. Please try again in a moment."}), 500

# --- AUTH API LOGIN ---
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = db.get_user_by_email(data.get('email'))
    
    if user and check_password_hash(user['password'], data.get('password')):
        return jsonify({
            "status": "success",
            "user_id": user['id'],
            "full_name": user['full_name'],
            "role": user.get('role', 'Full Stack Developer')  # FIX: role return karo
        }), 200
    return jsonify({"message": "Invalid credentials"}), 401

# --- PROFILE & STATS API ---
@app.route('/api/update-profile', methods=['POST'])
def update_profile():
    data = request.json
    if db.update_user_profile(data.get('user_id'), data.get('full_name'), data.get('role')):
        return jsonify({"message": "Profile Updated"}), 200
    return jsonify({"message": "Failed"}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    user_id = request.args.get('user_id') 
    if not user_id:
        return jsonify({"message": "User ID missing"}), 400
        
    try:
        stats = db.get_user_stats(user_id)
        history = db.get_campaign_history(user_id)
        return jsonify({
            "total_emails": stats['total'],
            "open_rate": stats['open_rate'],
            "bounced": stats['bounced'],
            "weekly_stats": stats.get('weekly_stats', [0]*7),
            "history": history
        }), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

# --- AI GENERATION WITH LOGGING ---
@app.route('/api/generate-email', methods=['POST'])
def generate_email():
    data = request.json
    target_url = data.get('url')
    user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({"message": "Please login again"}), 401

    if not target_url:
        return jsonify({"message": "Please enter a target URL."}), 400

    prompt = (
        f"Write 3 distinct cold email variations for the company/product at: {target_url}.\n\n"
        "Follow these rules strictly:\n"
        "1. Variation 1 = Professional/Formal tone\n"
        "2. Variation 2 = Creative/Story-based tone\n"
        "3. Variation 3 = Short/Punchy tone (max 100 words)\n\n"
        "Formatting rules for ALL variations:\n"
        "- Start EACH variation with: Subject: [your subject line]\n"
        "- Then a blank line, then the email body\n"
        "- Use **bold** for key value propositions and CTAs\n"
        "- Use _italic_ for emphasis on pain points or emotional hooks\n"
        "- Keep paragraphs short (2-3 lines max)\n"
        "- End with a clear, bold CTA line\n"
        "- Separate each variation ONLY with '###' on its own line\n"
        "- Do NOT include any intro, outro, or numbering outside the emails themselves."
    )
    
    try:
        response = client.models.generate_content(model=MODEL_ID, contents=prompt)
        email_text = response.text
        
        db.save_campaign_log(
            user_id=user_id,
            recipient=target_url,
            subject="NeuralMail Multi-Draft",
            content=email_text,
            status="Generated"
        )
        
        return jsonify({"email_content": email_text}), 200

    except Exception as e:
        error_str = str(e).lower()

        if "quota" in error_str or "resource_exhausted" in error_str or "429" in error_str or "rate" in error_str:
            return jsonify({"message": "⚠️ AI quota limit reached. Your free-tier Gemini API key has been exhausted for today. Please wait 24 hours or upgrade your Google AI plan at aistudio.google.com."}), 429

        if "api_key" in error_str or "api key" in error_str or ("invalid" in error_str and "key" in error_str):
            return jsonify({"message": "❌ Invalid API key. Please check your GEMINI_API_KEY in the .env file."}), 401

        if "not found" in error_str or "model" in error_str:
            return jsonify({"message": "❌ AI model unavailable. The Gemini model may not be accessible on your API key tier."}), 503

        if "connection" in error_str or "timeout" in error_str or "network" in error_str:
            return jsonify({"message": "🌐 Connection error. Could not reach the AI service. Check your internet and try again."}), 503

        return jsonify({"message": f"AI generation failed: {str(e)}"}), 500

if __name__ == '__main__':
    if not os.path.exists('uploads'): os.makedirs('uploads')
    print("🚀 NeuralMail Engine is Live on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)