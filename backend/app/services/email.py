import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

def send_reset_email(to_email:str, token:str):

    reset_link = f"https://data-forge-workspace-7vh7.vercel.app/?token={token}"

    subject = "Reset your Data Forge password"

    body = f"""
Hello,

You requested a password reset.

Use this token:

{token}

Or open this link:

{reset_link}

This token expires in 15 minutes.

If you did not request this, ignore.

Data Forge Team
"""

    msg = MIMEMultipart()

    msg["From"] = EMAIL_ADDRESS
    msg["To"] = to_email
    msg["Subject"] = subject

    msg.attach(MIMEText(body,"plain"))

    try:

        server = smtplib.SMTP(
            SMTP_SERVER,
            SMTP_PORT
        )

        server.starttls()

        server.login(
            EMAIL_ADDRESS,
            EMAIL_PASSWORD
        )

        server.sendmail(
            EMAIL_ADDRESS,
            to_email,
            msg.as_string()
        )

        server.quit()

    except Exception as e:

        print("Email error:",e)