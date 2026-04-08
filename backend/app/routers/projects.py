import json
import shutil
from pathlib import Path

import pandas as pd

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..config import DATASET_DIR, EXPORT_DIR, MODEL_DIR
from ..database import get_db
from ..dependencies import get_current_user
from ..models import AnalysisRun, Dataset, Project, User
from ..schemas import CleaningRequest, DashboardResponse, DatasetRead, ProjectCreate, ProjectRead, TrainingRequest, VisualizationRequest
from ..services.data_science import clean_dataframe, export_dashboard_report, generate_eda, generate_visualizations, load_dataset, save_dataset, train_model

router = APIRouter(prefix="/projects", tags=["projects"])


def _project_or_404(db: Session, project_id: int, user_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == user_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _dataset_or_404(db: Session, project_id: int, dataset_id: int) -> Dataset:
    dataset = db.query(Dataset).filter(Dataset.project_id == project_id, Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


@router.post("", response_model=ProjectRead)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = Project(owner_id=user.id, name=payload.name, description=payload.description)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("", response_model=list[ProjectRead])
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Project).filter(Project.owner_id == user.id).order_by(Project.created_at.desc()).all()


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = _project_or_404(db, project_id, user.id)
    datasets = db.query(Dataset).filter(Dataset.project_id == project_id).all()
    for dataset in datasets:
        file_path = Path(dataset.file_path)
        if file_path.exists():
            file_path.unlink(missing_ok=True)
        schema_path = file_path.with_name(f"{file_path.stem}.schema.json")
        schema_path.unlink(missing_ok=True)
    for model_file in MODEL_DIR.glob(f"project_{project_id}_dataset_*.joblib"):
        model_file.unlink(missing_ok=True)
    for pattern in (f"dashboard_project_{project_id}*.json", f"dashboard_project_{project_id}*.html"):
        for export_file in EXPORT_DIR.glob(pattern):
            export_file.unlink(missing_ok=True)
    db.query(AnalysisRun).filter(AnalysisRun.project_id == project_id).delete()
    db.query(Dataset).filter(Dataset.project_id == project_id).delete()
    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully"}


@router.post("/{project_id}/datasets", response_model=DatasetRead)
def upload_dataset(project_id: int, file: UploadFile = File(...), target_column: str | None = Form(default=None), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _project_or_404(db, project_id, user.id)
    file_path = DATASET_DIR / f"{project_id}_{file.filename}"
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    try:
        frame = load_dataset(file_path)
    except Exception as exc:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded dataset: {exc}")
    dataset = Dataset(project_id=project_id, name=file.filename, file_path=str(file_path), row_count=int(frame.shape[0]), column_count=int(frame.shape[1]), target_column=target_column)
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return dataset


@router.get("/{project_id}/datasets", response_model=list[DatasetRead])
def list_datasets(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _project_or_404(db, project_id, user.id)
    return db.query(Dataset).filter(Dataset.project_id == project_id).order_by(Dataset.created_at.desc()).all()


@router.get("/{project_id}/history")
def project_history(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _project_or_404(db, project_id, user.id)
    runs = db.query(AnalysisRun, Dataset.name).join(Dataset, Dataset.id == AnalysisRun.dataset_id).filter(AnalysisRun.project_id == project_id).order_by(AnalysisRun.created_at.desc()).limit(20).all()
    return {"history": [{"id": run.id, "run_type": run.run_type, "title": run.title, "dataset_id": run.dataset_id, "dataset_name": dataset_name, "score": run.score, "created_at": run.created_at.isoformat()} for run, dataset_name in runs]}


@router.get("/{project_id}/datasets/{dataset_id}/preview")
def preview_dataset(project_id: int, dataset_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _project_or_404(db, project_id, user.id)
    dataset = _dataset_or_404(db, project_id, dataset_id)
    frame = load_dataset(dataset.file_path)
    preview_slice = frame.head(15)
    preview_rows = preview_slice.astype(object).where(pd.notna(preview_slice), None).to_dict(orient="records")
    return {"columns": frame.columns.tolist(), "rows": preview_rows, "row_count": int(frame.shape[0]), "column_count": int(frame.shape[1])}


@router.post("/{project_id}/datasets/{dataset_id}/clean")
def clean_dataset(project_id: int, dataset_id: int, payload: CleaningRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _project_or_404(db, project_id, user.id)
    dataset = _dataset_or_404(db, project_id, dataset_id)
    frame = load_dataset(dataset.file_path)
    cleaned, summary = clean_dataframe(frame, payload.drop_columns, payload.fill_missing, payload.fill_categorical, payload.remove_duplicates, payload.trim_whitespace, payload.normalize_headers, payload.text_case, payload.drop_missing_rows, payload.drop_empty_columns, payload.drop_constant_columns, payload.remove_outliers, payload.cap_outliers, payload.outlier_column, payload.convert_column, payload.convert_type, payload.round_numeric, payload.round_digits)
    saved_path = save_dataset(cleaned, dataset.file_path, preserve_types=bool(payload.convert_column and payload.convert_type))
    dataset.file_path = str(saved_path)
    dataset.name = saved_path.name
    dataset.row_count = int(cleaned.shape[0])
    dataset.column_count = int(cleaned.shape[1])
    dataset.target_column = payload.target_column or dataset.target_column
    summary["saved_file"] = saved_path.name
    db.add(AnalysisRun(project_id=project_id, dataset_id=dataset_id, run_type="cleaning", title="Data cleaning result", payload_json=json.dumps(summary)))
    db.commit()
    return summary


@router.get("/{project_id}/datasets/{dataset_id}/eda")
def eda_dataset(project_id: int, dataset_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _project_or_404(db, project_id, user.id)
    dataset = _dataset_or_404(db, project_id, dataset_id)
    summary = generate_eda(load_dataset(dataset.file_path))
    db.add(AnalysisRun(project_id=project_id, dataset_id=dataset_id, run_type="eda", title="EDA summary", payload_json=json.dumps(summary)))
    db.commit()
    return summary


@router.post("/{project_id}/datasets/{dataset_id}/visualize")
def visualize_dataset(project_id: int, dataset_id: int, payload: VisualizationRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _project_or_404(db, project_id, user.id)
    dataset = _dataset_or_404(db, project_id, dataset_id)
    charts = generate_visualizations(load_dataset(dataset.file_path), payload.chart_types, payload.x_axis, payload.y_axis, payload.color_by)
    db.add(AnalysisRun(project_id=project_id, dataset_id=dataset_id, run_type="visualization", title="Visualization set", payload_json=json.dumps(charts)))
    db.commit()
    return {"charts": charts}


@router.post("/{project_id}/datasets/{dataset_id}/train")
def train_dataset(project_id: int, dataset_id: int, payload: TrainingRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _project_or_404(db, project_id, user.id)
    dataset = _dataset_or_404(db, project_id, dataset_id)
    summary = train_model(load_dataset(dataset.file_path), payload.target_column, payload.feature_columns, payload.model_type, payload.train_split, f"project_{project_id}_dataset_{dataset_id}")
    dataset.target_column = payload.target_column
    db.add(AnalysisRun(project_id=project_id, dataset_id=dataset_id, run_type="training", title="ML training summary", payload_json=json.dumps(summary), score=summary["score"]))
    db.commit()
    return summary


@router.get("/{project_id}/dashboard", response_model=DashboardResponse)
def project_dashboard(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = _project_or_404(db, project_id, user.id)
    datasets = db.query(Dataset).filter(Dataset.project_id == project_id).order_by(Dataset.created_at.desc()).all()
    runs = db.query(AnalysisRun).filter(AnalysisRun.project_id == project_id).order_by(AnalysisRun.created_at.desc()).all()
    latest_cleaning = next((json.loads(run.payload_json) for run in runs if run.run_type == "cleaning"), None)
    latest_eda = next((json.loads(run.payload_json) for run in runs if run.run_type == "eda"), None)
    latest_training = next((json.loads(run.payload_json) for run in runs if run.run_type == "training"), None)
    latest_visualizations = [json.loads(run.payload_json) for run in runs if run.run_type == "visualization"]
    flattened_visuals = latest_visualizations[0] if latest_visualizations else []
    return DashboardResponse(project=project, datasets=datasets, latest_cleaning=latest_cleaning, latest_eda=latest_eda, latest_visualizations=flattened_visuals, latest_training=latest_training)


@router.get("/{project_id}/dashboard/export")
def export_dashboard(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    payload = project_dashboard(project_id=project_id, db=db, user=user).model_dump()
    export_path = EXPORT_DIR / f"dashboard_project_{project_id}.html"
    export_dashboard_report(payload, export_path)
    return FileResponse(export_path, filename=export_path.name, media_type="text/html")


@router.get("/{project_id}/datasets/{dataset_id}/download")
def download_dataset(project_id: int, dataset_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _project_or_404(db, project_id, user.id)
    dataset = _dataset_or_404(db, project_id, dataset_id)
    file_path = Path(dataset.file_path)
    return FileResponse(file_path, filename=file_path.name)



