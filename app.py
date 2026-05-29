import os
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai 
from werkzeug.security import generate_password_hash, check_password_hash

from database import db
from mailer import Mailer, personalize_text

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
    email = data.get('email')
    password = data.get('password')
    full_name = data.get('full_name')
    company = data.get('company', 'Not Specified')

    hashed_password = generate_password_hash(password)

    if db.create_user(full_name, company, email, hashed_password):
        return jsonify({"status": "success", "message": "User Created"}), 201
    return jsonify({"message": "User already exists or DB Error"}), 400

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

    # CRITICAL: Prompt updated for 3 Variations with '###' delimiter
    prompt = (
        f"Write 3 distinct cold email variations for {target_url}. "
        "1: Professional/Formal, 2: Creative/Story-based, 3: Short/Punchy. "
        "Separate each variation ONLY with '###'. Do not include any intro or outro text."
    )
    
    try:
        response = client.models.generate_content(model=MODEL_ID, contents=prompt)
        email_text = response.text
        
        # Dashboard History mein save karein
        db.save_campaign_log(
            user_id=user_id,
            recipient=target_url,
            subject="NeuralMail Multi-Draft",
            content=email_text,
            status="Generated"
        )
        
        return jsonify({"email_content": email_text}), 200
    except Exception as e:
        return jsonify({"message": f"AI Error: {str(e)}"}), 500


@app.route('/api/smtp-settings', methods=['GET', 'POST'])
def smtp_settings():
    if request.method == 'GET':
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({"message": "User ID missing"}), 400
        settings = db.get_smtp_settings(user_id)
        if not settings:
            return jsonify({"message": "User not found"}), 404
        return jsonify(settings), 200

    data = request.json or {}
    user_id = data.get('user_id')
    smtp_email = (data.get('smtp_email') or '').strip()
    smtp_password = data.get('smtp_password') or ''

    if not user_id:
        return jsonify({"message": "Please login again"}), 401
    if not smtp_email or not smtp_password:
        return jsonify({"message": "Gmail address and app password are required"}), 400

    if db.update_smtp_settings(user_id, smtp_email, smtp_password):
        return jsonify({"message": "SMTP settings saved", "configured": True}), 200
    return jsonify({"message": "Failed to save SMTP settings"}), 500


@app.route('/api/bulk-send', methods=['POST'])
def bulk_send():
    data = request.json or {}
    user_id = data.get('user_id')
    recipients = data.get('recipients') or []
    subject_template = data.get('subject') or ''
    body_template = data.get('body') or ''
    cc = data.get('cc') or []
    bcc = data.get('bcc') or []

    if not user_id:
        return jsonify({"message": "Please login again"}), 401
    if not subject_template.strip():
        return jsonify({"message": "Subject is required"}), 400
    if not body_template.strip():
        return jsonify({"message": "Email body is required"}), 400

    valid_recipients = []
    for row in recipients:
        email = (row.get('email') or '').strip().lower()
        name = (row.get('name') or '').strip()
        if email and '@' in email:
            valid_recipients.append({'name': name, 'email': email})

    if not valid_recipients:
        return jsonify({"message": "Add at least one valid recipient in the To field"}), 400

    smtp_email = (data.get('smtp_email') or '').strip()
    smtp_password = data.get('smtp_password') or ''

    user = db.get_user_by_id(user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404

    if not smtp_email:
        smtp_email = user.get('smtp_email') or ''
    if not smtp_password:
        smtp_password = user.get('smtp_password') or ''

    if not smtp_email or not smtp_password:
        return jsonify({
            "message": "Connect your Gmail account with an app password in Bulk Send settings first."
        }), 400

    if data.get('save_smtp'):
        db.update_smtp_settings(user_id, smtp_email, smtp_password)

    mailer = Mailer(smtp_email, smtp_password)
    results = mailer.send_bulk_personalized(
        valid_recipients,
        subject_template,
        body_template,
        cc=cc,
        bcc=bcc,
    )

    sent = 0
    failed = 0
    for item in results:
        status = 'Sent' if item['success'] else 'Failed'
        if item['success']:
            sent += 1
        else:
            failed += 1
        db.save_campaign_log(
            user_id=user_id,
            recipient=item['email'],
            subject=personalize_text(subject_template, item.get('name')),
            content=personalize_text(body_template, item.get('name')),
            status=status,
        )

    return jsonify({
        "message": f"Bulk send complete: {sent} sent, {failed} failed.",
        "sent": sent,
        "failed": failed,
        "results": results,
    }), 200


if __name__ == '__main__':
    if not os.path.exists('uploads'): os.makedirs('uploads')
    print("🚀 NeuralMail Engine is Live on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)