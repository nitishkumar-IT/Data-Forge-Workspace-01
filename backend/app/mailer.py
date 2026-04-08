import smtplib
from email.message import EmailMessage
from urllib.parse import urlencode

from fastapi import HTTPException

from .config import settings


def _require_email_config() -> None:
    if not all([settings.smtp_host, settings.smtp_username, settings.smtp_password, settings.smtp_from_email]):
        raise HTTPException(status_code=503, detail="Email service is not configured. Set SMTP settings in backend/.env.")


def send_password_reset_email(email: str, token: str) -> None:
    _require_email_config()
    params = urlencode({"mode": "forgot", "token": token})
    reset_link = f"{settings.frontend_url}?{params}"

    message = EmailMessage()
    message["Subject"] = "Reset your Data Forge password"
    message["From"] = settings.smtp_from_email
    message["To"] = email
    message.set_content(
        "You requested a password reset for Data Forge.\n\n"
        f"Open this link to reset your password: {reset_link}\n\n"
        "If you did not request this, you can ignore this email."
    )
    message.add_alternative(
        f"""
        <html>
          <body style=\"font-family:Arial,sans-serif;color:#14303d;\">
            <h2>Reset your Data Forge password</h2>
            <p>You requested a password reset for your Data Forge account.</p>
            <p>
              <a href=\"{reset_link}\" style=\"display:inline-block;padding:12px 18px;border-radius:12px;background:#0f766e;color:#ffffff;text-decoration:none;\">Reset password</a>
            </p>
            <p>If the button does not work, copy and paste this link into your browser:</p>
            <p>{reset_link}</p>
            <p>If you did not request this, you can ignore this email.</p>
          </body>
        </html>
        """,
        subtype="html",
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        if settings.smtp_use_tls:
            server.starttls()
        server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)
