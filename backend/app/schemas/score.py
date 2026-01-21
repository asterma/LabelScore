from pydantic import BaseModel


class ScoreDetails(BaseModel):
    completeness: float
    accuracy: float
    consistency: float


class Issue(BaseModel):
    type: str  # missing, overlap, boundary, label
    severity: str  # low, medium, high
    message: str
    annotation_id: str | None = None


class ScoreResult(BaseModel):
    overall_score: float
    details: ScoreDetails
    issues: list[Issue]


class BatchResultItem(BaseModel):
    filename: str
    score: float
    issues_count: int


class BatchResult(BaseModel):
    total: int
    processed: int
    results: list[BatchResultItem]
