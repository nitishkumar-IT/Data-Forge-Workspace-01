from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2)
    password: str = Field(min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2)
    description: str = ""


class ProjectRead(BaseModel):
    id: int
    name: str
    description: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DatasetRead(BaseModel):
    id: int
    name: str
    row_count: int
    column_count: int
    target_column: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CleaningRequest(BaseModel):
    drop_columns: list[str] = []
    fill_missing: str = "median"
    fill_categorical: str = "mode"
    remove_duplicates: bool = True
    trim_whitespace: bool = False
    normalize_headers: bool = False
    text_case: str = "none"
    drop_missing_rows: bool = False
    drop_empty_columns: bool = False
    drop_constant_columns: bool = False
    remove_outliers: bool = False
    cap_outliers: bool = False
    outlier_column: str | None = None
    convert_column: str | None = None
    convert_type: str | None = None
    round_numeric: bool = False
    round_digits: int = Field(default=2, ge=0, le=8)
    target_column: str | None = None


class VisualizationRequest(BaseModel):
    chart_types: list[str] = ["bar", "line", "scatter", "histogram", "box", "pie"]
    x_axis: str | None = None
    y_axis: str | None = None
    color_by: str | None = None


class TrainingRequest(BaseModel):
    target_column: str
    feature_columns: list[str] = []
    model_type: str = "auto"
    train_split: float = Field(default=0.8, gt=0.5, lt=0.95)


class HistoryEntry(BaseModel):
    id: int
    run_type: str
    title: str
    dataset_id: int
    dataset_name: str
    score: float | None = None
    created_at: datetime


class DashboardResponse(BaseModel):
    project: ProjectRead
    datasets: list[DatasetRead]
    latest_cleaning: dict[str, Any] | None
    latest_eda: dict[str, Any] | None
    latest_visualizations: list[dict[str, Any]]
    latest_training: dict[str, Any] | None

