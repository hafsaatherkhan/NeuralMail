import sqlite3
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timedelta

class Database:
    def __init__(self, db_name="neuralmail.db"):
        self.db_name = db_name
        self.lock = threading.Lock()  # thread safety
        
        self.init_db()

    # --- CONNECTION HANDLER (CORE) ---
    @contextmanager
    def get_connection(self):
        conn = sqlite3.connect(
            self.db_name,
            timeout=10,
            check_same_thread=False
        )
        conn.row_factory = sqlite3.Row
        
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    # --- EXECUTION WITH RETRY (ANTI-LOCK MAGIC) ---
    def execute_with_retry(self, query, params=(), retries=5):
        for attempt in range(retries):
            try:
                with self.lock:  # prevents thread clashes
                    with self.get_connection() as conn:
                        return conn.execute(query, params)
            except sqlite3.OperationalError as e:
                if "locked" in str(e).lower():
                    time.sleep(0.2 * (attempt + 1))  # backoff
                else:
                    raise
        raise Exception("DB locked after retries")

    # --- FETCH HELPERS ---
    def fetch_one(self, query, params=()):
        with self.lock:
            with self.get_connection() as conn:
                return conn.execute(query, params).fetchone()

    def fetch_all(self, query, params=()):
        with self.lock:
            with self.get_connection() as conn:
                return conn.execute(query, params).fetchall()

    # --- INIT DB ---
    def init_db(self):
        with self.get_connection() as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA synchronous=NORMAL;")

            conn.execute('''
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

            conn.execute('''
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

    # --- AUTH ---
    def create_user(self, full_name, company, email, hashed_password):
        try:
            self.execute_with_retry('''
                INSERT INTO users (full_name, company, email, password)
                VALUES (?, ?, ?, ?)
            ''', (full_name, company, email, hashed_password))
            return True
        except Exception as e:
            print(f"Create User Error: {e}")
            return False

    def get_user_by_email(self, email):
        try:
            row = self.fetch_one("SELECT * FROM users WHERE email = ?", (email,))
            return dict(row) if row else None
        except Exception as e:
            print(f"Get User Error: {e}")
            return None

    def update_user_profile(self, user_id, full_name, role):
        try:
            self.execute_with_retry('''
                UPDATE users SET full_name = ?, role = ? WHERE id = ?
            ''', (full_name, role, user_id))
            return True
        except Exception as e:
            print(f"Profile Update Error: {e}")
            return False

    # --- CAMPAIGN LOGS ---
    def save_campaign_log(self, user_id, recipient, subject, content, status="Sent"):
        try:
            self.execute_with_retry('''
                INSERT INTO campaign_logs 
                (user_id, recipient, subject, content, status)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, recipient, subject, content, status))
            return True
        except Exception as e:
            print(f"Log Error: {e}")
            return False

    def get_campaign_history(self, user_id):
        try:
            rows = self.fetch_all('''
                SELECT id, date, recipient, subject, content, status
                FROM campaign_logs
                WHERE user_id = ?
                ORDER BY date DESC
                LIMIT 20
            ''', (user_id,))
            return [dict(row) for row in rows]
        except Exception as e:
            print(f"History Fetch Error: {e}")
            return []

    def delete_campaign_log(self, log_id, user_id):
        try:
            self.execute_with_retry('''
                DELETE FROM campaign_logs
                WHERE id = ? AND user_id = ?
            ''', (log_id, user_id))
            return True
        except Exception as e:
            print(f"Delete Error: {e}")
            return False

    # --- ANALYTICS ---
    def get_user_stats(self, user_id):
        try:
            with self.get_connection() as conn:
                total = conn.execute(
                    "SELECT COUNT(*) FROM campaign_logs WHERE user_id = ?",
                    (user_id,)
                ).fetchone()[0]

                bounced = conn.execute(
                    "SELECT COUNT(*) FROM campaign_logs WHERE user_id = ? AND status = 'Bounced'",
                    (user_id,)
                ).fetchone()[0]

                weekly_query = '''
                    SELECT date(date) as day, COUNT(id) as count
                    FROM campaign_logs
                    WHERE user_id = ?
                    AND date >= date('now', '-6 days')
                    GROUP BY day
                    ORDER BY day ASC
                '''

                rows = conn.execute(weekly_query, (user_id,)).fetchall()

            stats_map = {row['day']: row['count'] for row in rows}
            today = datetime.now().date()

            weekly_list = []
            for i in range(6, -1, -1):
                day = (today - timedelta(days=i)).strftime('%Y-%m-%d')
                weekly_list.append(stats_map.get(day, 0))

            return {
                "total": total,
                "open_rate": 64 if total > 0 else 0,
                "bounced": bounced,
                "weekly_stats": weekly_list
            }

        except Exception as e:
            print(f"Stats Error: {e}")
            return {}