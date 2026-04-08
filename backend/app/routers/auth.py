from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..mailer import send_password_reset_email
from ..models import PasswordResetToken, User
from ..schemas import ForgotPasswordRequest, ResetPasswordRequest, TokenResponse, UserCreate, UserLogin, UserRead
from ..security import create_access_token, generate_reset_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=payload.email, full_name=payload.full_name, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenResponse(access_token=create_access_token(user.email))


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(access_token=create_access_token(user.email))


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        return {"message": "If the email exists, a reset link has been sent."}

    token = generate_reset_token()
    db.add(PasswordResetToken(user_id=user.id, token=token))
    db.commit()
    send_password_reset_email(user.email, token)
    return {"message": "If the email exists, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    reset_row = db.query(PasswordResetToken).filter(PasswordResetToken.token == payload.token, PasswordResetToken.is_used.is_(False)).first()
    if not reset_row:
        raise HTTPException(status_code=400, detail="Invalid reset token")
    user = db.query(User).filter(User.id == reset_row.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(payload.new_password)
    reset_row.is_used = True
    db.commit()
    return {"message": "Password updated successfully"}
