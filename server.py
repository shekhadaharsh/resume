"""
ResuMail - Flask Backend Server
Sends emails via Gmail SMTP with resume attachment support.
Includes User Authentication (Login/Signup) and SQLite Database for multi-device sync.
"""

import os
import smtplib
import base64
import sqlite3
import secrets
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app)

# Serve Frontend files
@app.route("/")
def serve_index():
    return send_from_directory(".", "index.html")

@app.route("/style.css")
def serve_css():
    return send_from_directory(".", "style.css")

@app.route("/app.js")
def serve_js():
    return send_from_directory(".", "app.js")


DATABASE = "resumail.db"

# ===========================
# APNI GMAIL DETAILS YAHAN DALO
# ===========================
GMAIL_EMAIL = "harshshekhada2134@gmail.com"        # <-- apni Gmail ID dalo
GMAIL_APP_PASSWORD = "volx gtts rjhb nwra"      # <-- App Password dalo (16 digit)
# ===========================

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        # Users Table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                token TEXT,
                sender_email TEXT
            )
        """)
        # Templates Table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS templates (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                subject TEXT NOT NULL,
                body TEXT NOT NULL,
                resume_name TEXT,
                resume_data TEXT,
                is_default INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        # History Table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS history (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                sender_email TEXT NOT NULL,
                receiver_email TEXT NOT NULL,
                template_name TEXT NOT NULL,
                has_resume INTEGER DEFAULT 0,
                resume_name TEXT,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        conn.commit()

# Helper to verify token and get user
def get_user_by_token():
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1]
    
    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE token = ?", (token,)).fetchone()
        return user

# ===========================
# AUTHENTICATION ENDPOINTS
# ===========================

@app.route("/auth/signup", methods=["POST"])
def signup():
    data = request.json
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"success": False, "error": "Email and password are required"}), 400

    hashed_pw = generate_password_hash(password)

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO users (email, password) VALUES (?, ?)", (email, hashed_pw))
            conn.commit()
            return jsonify({"success": True, "message": "Account created successfully! Please login."})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "error": "Email already registered"}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/auth/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"success": False, "error": "Email and password are required"}), 400

    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if user and check_password_hash(user["password"], password):
            token = secrets.token_hex(32)
            conn.execute("UPDATE users SET token = ? WHERE id = ?", (token, user["id"]))
            conn.commit()
            return jsonify({
                "success": True,
                "token": token,
                "email": user["email"],
                "senderEmail": user["sender_email"] or ""
            })
        
    return jsonify({"success": False, "error": "Invalid email or password"}), 401

@app.route("/auth/logout", methods=["POST"])
def logout():
    user = get_user_by_token()
    if not user:
        return jsonify({"success": False, "error": "Unauthorized"}), 401
    
    with get_db() as conn:
        conn.execute("UPDATE users SET token = NULL WHERE id = ?", (user["id"],))
        conn.commit()
    return jsonify({"success": True})

# ===========================
# SENDER EMAIL ENDPOINTS
# ===========================

@app.route("/api/sender-email", methods=["POST"])
def save_sender_email():
    user = get_user_by_token()
    if not user:
        return jsonify({"success": False, "error": "Unauthorized"}), 401
    
    data = request.json
    sender_email = data.get("senderEmail", "").strip()

    with get_db() as conn:
        conn.execute("UPDATE users SET sender_email = ? WHERE id = ?", (sender_email, user["id"]))
        conn.commit()
        
    return jsonify({"success": True})

# ===========================
# TEMPLATE ENDPOINTS
# ===========================

@app.route("/api/templates", methods=["GET"])
def get_templates():
    user = get_user_by_token()
    if not user:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    with get_db() as conn:
        templates = conn.execute("SELECT * FROM templates WHERE user_id = ?", (user["id"],)).fetchall()
        mapped = []
        for t in templates:
            mapped.append({
                "id": t["id"],
                "name": t["name"],
                "subject": t["subject"],
                "body": t["body"],
                "resumeName": t["resume_name"],
                "resumeDataUrl": t["resume_data"],
                "isDefault": bool(t["is_default"])
            })
        return jsonify({
            "success": True,
            "templates": mapped
        })

@app.route("/api/templates", methods=["POST"])
def save_template():
    user = get_user_by_token()
    if not user:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    data = request.json
    template_id = data.get("id")
    name = data.get("name")
    subject = data.get("subject")
    body = data.get("body")
    resume_name = data.get("resumeName")
    resume_data = data.get("resumeDataUrl")  # Map to resumeDataUrl sent by app.js
    is_default = 1 if data.get("isDefault") else 0

    with get_db() as conn:
        # Check if updating or inserting
        existing = conn.execute("SELECT * FROM templates WHERE id = ? AND user_id = ?", (template_id, user["id"])).fetchone()
        if existing:
            # If resume is not provided in update, keep the existing one
            if resume_name is None and resume_data is None:
                conn.execute("""
                    UPDATE templates 
                    SET name = ?, subject = ?, body = ?
                    WHERE id = ? AND user_id = ?
                """, (name, subject, body, template_id, user["id"]))
            else:
                conn.execute("""
                    UPDATE templates 
                    SET name = ?, subject = ?, body = ?, resume_name = ?, resume_data = ?
                    WHERE id = ? AND user_id = ?
                """, (name, subject, body, resume_name, resume_data, template_id, user["id"]))
        else:
            conn.execute("""
                INSERT INTO templates (id, user_id, name, subject, body, resume_name, resume_data, is_default)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (template_id, user["id"], name, subject, body, resume_name, resume_data, is_default))
        conn.commit()

    return jsonify({"success": True})

@app.route("/api/templates/<template_id>", methods=["DELETE"])
def delete_template(template_id):
    user = get_user_by_token()
    if not user:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    with get_db() as conn:
        conn.execute("DELETE FROM templates WHERE id = ? AND user_id = ?", (template_id, user["id"]))
        conn.commit()

    return jsonify({"success": True})

# ===========================
# HISTORY ENDPOINTS
# ===========================

@app.route("/api/history", methods=["GET"])
def get_history():
    user = get_user_by_token()
    if not user:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    with get_db() as conn:
        history = conn.execute("SELECT * FROM history WHERE user_id = ? ORDER BY timestamp DESC", (user["id"],)).fetchall()
        mapped = []
        for h in history:
            mapped.append({
                "id": h["id"],
                "senderEmail": h["sender_email"],
                "receiverEmail": h["receiver_email"],
                "templateName": h["template_name"],
                "hasResume": bool(h["has_resume"]),
                "resumeName": h["resume_name"],
                "timestamp": h["timestamp"]
            })
        return jsonify({
            "success": True,
            "history": mapped
        })

@app.route("/api/history", methods=["DELETE"])
def clear_history():
    user = get_user_by_token()
    if not user:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    with get_db() as conn:
        conn.execute("DELETE FROM history WHERE user_id = ?", (user["id"],))
        conn.commit()

    return jsonify({"success": True})

# ===========================
# EMAIL SENDING ENDPOINT
# ===========================

@app.route("/send-email", methods=["POST"])
def send_email():
    user = get_user_by_token()
    if not user:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    try:
        data = request.json

        receiver_email = data.get("receiverEmail", "").strip()
        subject = data.get("subject", "").strip()
        body = data.get("body", "").strip()
        sender_email = data.get("senderEmail", "").strip()
        resume_name = data.get("resumeName")
        resume_data = data.get("resumeData")  # base64 encoded file
        template_name = data.get("templateName", "Template")

        # Validations
        if not receiver_email:
            return jsonify({"success": False, "error": "Receiver email is required"}), 400
        if not subject:
            return jsonify({"success": False, "error": "Subject is required"}), 400
        if not body:
            return jsonify({"success": False, "error": "Email body is required"}), 400

        # Build the email
        msg = MIMEMultipart()
        msg["From"] = GMAIL_EMAIL
        msg["To"] = receiver_email
        msg["Subject"] = subject

        # Email body
        msg.attach(MIMEText(body, "plain"))

        # Attach resume if provided
        if resume_name and resume_data:
            if "," in resume_data:
                resume_data = resume_data.split(",", 1)[1]

            file_bytes = base64.b64decode(resume_data)

            attachment = MIMEBase("application", "octet-stream")
            attachment.set_payload(file_bytes)
            encoders.encode_base64(attachment)
            attachment.add_header(
                "Content-Disposition",
                f"attachment; filename={resume_name}"
            )
            msg.attach(attachment)

        # Send via Gmail SMTP
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_EMAIL, receiver_email, msg.as_string())

        # Save to database history
        timestamp = data.get("timestamp", "")
        if not timestamp:
            import datetime
            timestamp = datetime.datetime.now().isoformat()
            
        history_id = 'hist-' + str(secrets.token_hex(8))

        with get_db() as conn:
            conn.execute("""
                INSERT INTO history (id, user_id, sender_email, receiver_email, template_name, has_resume, resume_name, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (history_id, user["id"], sender_email, receiver_email, template_name, 1 if resume_name else 0, resume_name, timestamp))
            conn.commit()

        print(f"[OK] Email sent to: {receiver_email}")
        return jsonify({
            "success": True,
            "message": f"Email sent successfully to {receiver_email}"
        })

    except smtplib.SMTPAuthenticationError:
        print("[ERROR] Authentication failed - check Gmail email & App Password")
        return jsonify({
            "success": False,
            "error": "Gmail authentication failed. Check backend credentials."
        }), 401

    except smtplib.SMTPRecipientsRefused:
        print(f"[ERROR] Recipient refused: {receiver_email}")
        return jsonify({
            "success": False,
            "error": f"Invalid receiver email: {receiver_email}"
        }), 400

    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Failed to send email: {str(e)}"
        }), 500


@app.route("/health", methods=["GET"])
def health_check():
    """Check if server is running."""
    return jsonify({"status": "ok", "message": "ResuMail server is running!"})


if __name__ == "__main__":
    init_db()
    print("=" * 50)
    print("   ResuMail Server Starting with Database...")
    print(f"   Sending from: {GMAIL_EMAIL}")
    print("   Server: http://localhost:5000")
    print("=" * 50)
    app.run(debug=True, host="0.0.0.0", port=5000)
