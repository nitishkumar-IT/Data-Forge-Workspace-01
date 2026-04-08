# Data Forge

This project is separated into:
- `frontend/` for the React app
- `backend/` for the FastAPI and Python data-science services

## Included
- Login, register, forgot password, and reset password
- Persistent SQLite storage for users, projects, datasets, analysis runs, and reset tokens
- Dataset upload, preview, cleaning, EDA, visualization, download, and ML training
- Dashboard summary API with saved cleaning, EDA, visualization, and training outputs
- Dashboard export as JSON

## Backend setup
1. Open `C:\Users\NITISHKUMAR\Documents\data forge\backend`
2. Create a Python virtual environment
3. Run `pip install -r requirements.txt`
4. Start with `uvicorn app.main:app --reload --port 8000`

## Frontend setup
1. Open `C:\Users\NITISHKUMAR\Documents\data forge\frontend`
2. Run `npm install`
3. Start with `npm run dev`

## Persistence
- Database: `backend/storage/app.db`
- Uploaded datasets: `backend/storage/datasets/`
- Trained models: `backend/storage/models/`
- Dashboard exports: `backend/storage/exports/`

## Authentication guidance
- Current authentication is local and persistent using SQLite plus JWT
- This is easier than Firebase to start with and does not need a third-party account
- Forgot password creates a stored reset token through the API
- For permanent production email delivery, connect `/api/auth/forgot-password` to SMTP, Resend, or SendGrid
- Change `secret_key` in `backend/app/config.py` before deploying
