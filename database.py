import os
import psycopg2
from psycopg2.extras import RealDictCursor
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timedelta

class Database:
    def __init__(self):
        self.db_url = os.getenv("DATABASE_URL")
        self.lock = threading.Lock()  # thread safety
        
        if not self.db_url:
            print("WARNING: DATABASE_URL environment variable is not set!")
        
        self.init_db()

    # --- CONNECTION HANDLER (CORE) ---
    @contextmanager
    def get_connection(self):
        # We'll use RealDictCursor so rows behave like dictionaries
        conn = psycopg2.connect(self.db_url, cursor_factory=RealDictCursor)
        
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
                with self.lock:
                    with self.get_connection() as conn:
                        with conn.cursor() as cur:
                            cur.execute(query, params)
                            return cur
            except psycopg2.OperationalError as e:
                if attempt < retries - 1:
                    time.sleep(0.2 * (attempt + 1))  # backoff
                else:
                    raise Exception(f"DB Operational Error after retries: {e}")
            except Exception as e:
                raise

    # --- FETCH HELPERS ---
    def fetch_one(self, query, params=()):
        with self.lock:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(query, params)
                    return cur.fetchone()

    def fetch_all(self, query, params=()):
        with self.lock:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(query, params)
                    return cur.fetchall()

    # --- INIT DB ---
    def init_db(self):
        # Neon (Postgres) doesn't use PRAGMA. We just create tables.
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute('''
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        full_name VARCHAR(255) NOT NULL,
                        company VARCHAR(255),
                        role VARCHAR(255) DEFAULT 'Full Stack Developer',
                        email VARCHAR(255) UNIQUE NOT NULL,
                        password VARCHAR(255) NOT NULL,
                        smtp_email VARCHAR(255),
                        smtp_password VARCHAR(255)
                    )
                ''')

                cur.execute('''
                    CREATE TABLE IF NOT EXISTS campaign_logs (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER,
                        recipient VARCHAR(255) NOT NULL,
                        subject TEXT,
                        content TEXT,
                        status VARCHAR(50) DEFAULT 'Sent',
                        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                ''')

    # --- AUTH ---
    def create_user(self, full_name, company, email, hashed_password, role='Full Stack Developer'):
        try:
            self.execute_with_retry('''
                INSERT INTO users (full_name, company, email, password, role)
                VALUES (%s, %s, %s, %s, %s)
            ''', (full_name, company, email, hashed_password, role))
            return True
        except psycopg2.IntegrityError:
            print(f"Create User Error: Email {email} already exists.")
            return False
        except Exception as e:
            print(f"Create User Error: {e}")
            return False

    def get_user_by_email(self, email):
        try:
            row = self.fetch_one("SELECT * FROM users WHERE email = %s", (email,))
            return dict(row) if row else None
        except Exception as e:
            print(f"Get User Error: {e}")
            return None

    def update_user_profile(self, user_id, full_name, role):
        try:
            self.execute_with_retry('''
                UPDATE users SET full_name = %s, role = %s WHERE id = %s
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
                VALUES (%s, %s, %s, %s, %s)
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
                WHERE user_id = %s
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
                WHERE id = %s AND user_id = %s
            ''', (log_id, user_id))
            return True
        except Exception as e:
            print(f"Delete Error: {e}")
            return False

    # --- ANALYTICS ---
    def get_user_stats(self, user_id):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT COUNT(*) as cnt FROM campaign_logs WHERE user_id = %s",
                        (user_id,)
                    )
                    total = cur.fetchone()['cnt']

                    cur.execute(
                        "SELECT COUNT(*) as cnt FROM campaign_logs WHERE user_id = %s AND status = 'Bounced'",
                        (user_id,)
                    )
                    bounced = cur.fetchone()['cnt']

                    # Postgres requires casting to DATE to group by day
                    weekly_query = '''
                        SELECT DATE(date) as day, COUNT(id) as count
                        FROM campaign_logs
                        WHERE user_id = %s
                        AND date >= CURRENT_DATE - INTERVAL '6 days'
                        GROUP BY DATE(date)
                        ORDER BY DATE(date) ASC
                    '''

                    cur.execute(weekly_query, (user_id,))
                    rows = cur.fetchall()

            # The row['day'] might be a datetime.date object depending on psycopg2 parsing, convert it to string
            stats_map = {str(row['day']): row['count'] for row in rows}
            today = datetime.now().date()

            weekly_list = []
            for i in range(6, -1, -1):
                day = (today - timedelta(days=i)).strftime('%Y-%m-%d')
                weekly_list.append(stats_map.get(day, 0))

            return {
                "total": total,
                "open_rate": 64 if total > 0 else 0,  # Mocked open rate same as original
                "bounced": bounced,
                "weekly_stats": weekly_list
            }

        except Exception as e:
            print(f"Stats Error: {e}")
            return {}