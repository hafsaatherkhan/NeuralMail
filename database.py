import sqlite3
from datetime import datetime

class Database:
    def __init__(self, db_name="neuralmail.db"):
        self.db_name = db_name
        self.init_db()

    def get_connection(self):
        conn = sqlite3.connect(self.db_name)
        conn.row_factory = sqlite3.Row 
        return conn

    def init_db(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # 1. Users Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                company TEXT,
                role TEXT DEFAULT 'Full Stack Developer',
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                smtp_email TEXT,
                smtp_password TEXT
            )
        ''')
        
        # 2. Campaign Logs Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS campaign_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                recipient TEXT NOT NULL,
                subject TEXT,
                content TEXT,
                status TEXT DEFAULT 'Sent',
                date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        
        conn.commit()
        conn.close()

    # --- HISTORY & ANALYTICS FUNCTIONS (FIXED) ---
    
    def get_campaign_history(self, user_id):
        """History tab ke liye data - Added 'content' column for View Detail functionality"""
        try:
            conn = self.get_connection()
            # CRITICAL FIX: 'content' column ko query mein shamil kiya taake View button chale
            rows = conn.execute("""
                SELECT id, date, recipient, subject, content, status 
                FROM campaign_logs 
                WHERE user_id = ? 
                ORDER BY date DESC LIMIT 20
            """, (user_id,)).fetchall()
            conn.close()
            return [dict(row) for row in rows]
        except Exception as e:
            print(f"History Fetch Error: {e}")
            return []

    def delete_campaign_log(self, log_id, user_id):
        """Specific history entry ko delete karne ke liye"""
        try:
            conn = self.get_connection()
            conn.execute("DELETE FROM campaign_logs WHERE id = ? AND user_id = ?", (log_id, user_id))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Delete Error: {e}")
            return False

    def get_user_stats(self, user_id):
        """Dashboard analytics ke liye data"""
        conn = self.get_connection()
        total = conn.execute("SELECT COUNT(*) FROM campaign_logs WHERE user_id = ?", (user_id,)).fetchone()[0]
        bounced = conn.execute("SELECT COUNT(*) FROM campaign_logs WHERE user_id = ? AND status = 'Bounced'", (user_id,)).fetchone()[0]
        
        # Weekly graph fix: Group by date ensuring 7 slots
        weekly_query = """
            SELECT date(date) as day, COUNT(id) as count 
            FROM campaign_logs 
            WHERE user_id = ? AND date >= date('now', '-6 days')
            GROUP BY day
            ORDER BY day ASC
        """
        rows = conn.execute(weekly_query, (user_id,)).fetchall()
        conn.close()
        
        # Static logic for UI placeholder
        open_rate = 64 if total > 0 else 0
        
        # Map DB results to 7-day list (Mon to Sun aligned)
        from datetime import timedelta
        stats_map = {row['day']: row['count'] for row in rows}
        today = datetime.now().date()
        # Get last 7 days in order
        weekly_list = []
        for i in range(6, -1, -1):
            day = (today - timedelta(days=i)).strftime('%Y-%m-%d')
            weekly_list.append(stats_map.get(day, 0))
        
        return {
            "total": total, 
            "open_rate": open_rate, 
            "bounced": bounced,
            "weekly_stats": weekly_list
        }

    # --- AUTH FUNCTIONS ---
    def create_user(self, full_name, company, email, hashed_password):
        try:
            conn = self.get_connection()
            conn.execute('''INSERT INTO users (full_name, company, email, password) VALUES (?, ?, ?, ?)''',
                         (full_name, company, email, hashed_password))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Create User Error: {e}")
            return False

    def get_user_by_email(self, email):
        try:
            conn = self.get_connection()
            row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
            conn.close()
            return dict(row) if row else None
        except Exception as e:
            print(f"Get User Error: {e}")
            return None

    def get_user_by_id(self, user_id):
        try:
            conn = self.get_connection()
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            conn.close()
            return dict(row) if row else None
        except Exception as e:
            print(f"Get User By ID Error: {e}")
            return None

    def update_smtp_settings(self, user_id, smtp_email, smtp_password):
        try:
            conn = self.get_connection()
            conn.execute(
                "UPDATE users SET smtp_email = ?, smtp_password = ? WHERE id = ?",
                (smtp_email, smtp_password, user_id),
            )
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"SMTP Settings Error: {e}")
            return False

    def get_smtp_settings(self, user_id):
        user = self.get_user_by_id(user_id)
        if not user:
            return None
        return {
            "smtp_email": user.get("smtp_email") or "",
            "configured": bool(user.get("smtp_email") and user.get("smtp_password")),
        }

    def update_user_profile(self, user_id, full_name, role):
        try:
            conn = self.get_connection()
            conn.execute("UPDATE users SET full_name = ?, role = ? WHERE id = ?",
                         (full_name, role, user_id))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Profile Update Error: {e}")
            return False

    # --- EXISTING AUTH FUNCTIONS ---
    def save_campaign_log(self, user_id, recipient, subject, content, status="Sent"):
        try:
            conn = self.get_connection()
            conn.execute('''INSERT INTO campaign_logs (user_id, recipient, subject, content, status) 
                            VALUES (?, ?, ?, ?, ?)''', (user_id, recipient, subject, content, status))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Log Error: {e}")
            return False

db = Database()