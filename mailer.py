import re
import smtplib
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def personalize_text(template, name):
    """Replace name placeholders in subject/body for one recipient."""
    display = (name or "").strip() or "there"
    text = str(template or "")
    text = re.sub(r"\{\{\s*name\s*\}\}", display, text, flags=re.IGNORECASE)
    text = re.sub(r"\{name\}", display, text, flags=re.IGNORECASE)
    text = text.replace("[Name]", display)
    return text


def parse_address_list(value):
    """Parse comma/semicolon/newline separated emails."""
    if not value:
        return []
    if isinstance(value, list):
        items = value
    else:
        items = re.split(r"[,;\n]+", str(value))
    seen = set()
    out = []
    for item in items:
        email = item.strip().lower()
        if email and "@" in email and email not in seen:
            seen.add(email)
            out.append(email)
    return out


class Mailer:
    def __init__(self, user_smtp_email, user_smtp_password, server="smtp.gmail.com", port=587):
        # Ab ye credentials user ke account se aayenge
        self.sender_email = user_smtp_email
        self.sender_password = user_smtp_password
        self.smtp_server = server
        self.smtp_port = port

    def send_ai_email(self, receiver_email, subject, body):
        return self.send_personalized_email(receiver_email, subject, body)

    def send_personalized_email(self, to_email, subject, body, cc=None, bcc=None):
        """
        Send one email to a single To address. Optional CC/BCC.
        Each bulk recipient should call this separately so others are not visible.
        """
        cc = parse_address_list(cc or [])
        bcc = parse_address_list(bcc or [])
        to_email = (to_email or "").strip().lower()
        if not to_email or "@" not in to_email:
            return False

        try:
            msg = MIMEMultipart()
            msg["From"] = self.sender_email
            msg["To"] = to_email
            if cc:
                msg["Cc"] = ", ".join(cc)
            msg["Subject"] = subject or ""
            msg.attach(MIMEText(body or "", "plain"))

            envelope_to = [to_email] + cc + bcc

            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.sender_email, self.sender_password)
            server.sendmail(self.sender_email, envelope_to, msg.as_string())
            server.quit()
            return True
        except Exception as e:
            print(f"SMTP Error ({to_email}): {e}")
            return False

    def send_bulk_personalized(
        self, recipients, subject_template, body_template, cc=None, bcc=None, delay_seconds=0.6
    ):
        """
        recipients: list of dicts with 'name' and 'email'
        Returns list of {name, email, success, error?}
        """
        results = []
        cc_list = parse_address_list(cc)
        bcc_list = parse_address_list(bcc)

        for entry in recipients:
            name = (entry.get("name") or "").strip()
            email = (entry.get("email") or "").strip().lower()
            if not email:
                results.append(
                    {"name": name, "email": email, "success": False, "error": "Missing email"}
                )
                continue

            subject = personalize_text(subject_template, name)
            body = personalize_text(body_template, name)
            ok = self.send_personalized_email(email, subject, body, cc=cc_list, bcc=bcc_list)
            results.append(
                {
                    "name": name,
                    "email": email,
                    "success": ok,
                    "error": None if ok else "SMTP send failed",
                }
            )
            if delay_seconds > 0:
                time.sleep(delay_seconds)

        return results