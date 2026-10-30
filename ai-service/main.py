"""AI chạy cục bộ, chỉ bind 127.0.0.1. Không gửi dữ liệu ra dịch vụ thứ ba."""
from fastapi import FastAPI
from pydantic import BaseModel, Field, ConfigDict
from models import predict_fraud, predict_spending

app = FastAPI(title="LumiBank AI (Demo)", version="0.1.0", docs_url=None, redoc_url=None)

class SpendingBody(BaseModel):
    descriptions: list[str] = Field(max_length=250)
    model_config = ConfigDict(extra="forbid")

class TransactionFeatures(BaseModel):
    amount_vnd: float = Field(ge=0, le=1e12)
    avg_amount_vnd: float = Field(ge=0, le=1e12)
    hour: int = Field(ge=0, le=23)
    recent_count_24h: int = Field(ge=0, le=10000)
    new_recipient: bool
    history_count: int = Field(ge=0)
    std_amount_vnd: float = Field(default=0, ge=0, le=1e12)

class FraudBody(BaseModel):
    transactions: list[TransactionFeatures] = Field(max_length=200)

@app.get("/health")
def health():
    return {"status": "ok", "models": ["TF-IDF + LogisticRegression", "IsolationForest", "personal-baseline"], "training_data": "synthetic-demo"}

@app.post("/predict/spending")
def spending(body: SpendingBody):
    if any(len(d) > 240 for d in body.descriptions):
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Description exceeds 240 characters")
    return {"items": predict_spending(body.descriptions), "model": "TF-IDF + LogisticRegression", "training_data": "curated-demo"}

@app.post("/predict/fraud")
def fraud(body: FraudBody):
    return {"items": predict_fraud([x.model_dump() for x in body.transactions]), "model": "IsolationForest", "training_data": "synthetic-demo"}
