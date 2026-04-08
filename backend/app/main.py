from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import Base, engine
from .routers import auth, projects

app = FastAPI(
    title=settings.app_name
)

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

# Correct CORS config
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://data-forge-workspace-7vh7.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Routers
app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")

@app.get("/")
def root():
    return {"message":"Data Forge API running"}

@app.get("/api/health")
def health():
    return {"status":"ok"}