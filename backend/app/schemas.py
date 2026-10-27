"""Pydantic models shared by the API and the Gemini structured-output schemas.

Field names are camelCase on purpose: they match the TypeScript types in /types.ts,
so the React frontend consumes responses without any mapping layer.
"""
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------- requests
class UserProfile(BaseModel):
    """Subset of the frontend UserProfile that is useful as clinical context."""

    model_config = ConfigDict(extra="ignore")  # frontend also sends reminders/history/etc.

    name: Optional[str] = None
    email: Optional[str] = None
    age: Optional[str] = None
    gender: Optional[str] = None
    bloodType: Optional[str] = None
    weight: Optional[str] = None
    height: Optional[str] = None
    allergies: Optional[str] = None
    medicalHistory: Optional[str] = None


class SymptomRequest(BaseModel):
    symptoms: str = Field(min_length=1, max_length=4000)
    profile: Optional[UserProfile] = None


class LabReportRequest(BaseModel):
    # Base64 payload only (no "data:image/...;base64," prefix).
    image: str = Field(min_length=1)
    profile: Optional[UserProfile] = None


class FindCareRequest(BaseModel):
    specialization: str = Field(min_length=1, max_length=200)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


# ------------------------------------------- Gemini structured-output schemas
class AnalysisResult(BaseModel):
    condition: str = Field(description="Most likely condition or condition category")
    probability: float = Field(description="Confidence as a percentage from 0 to 100")
    urgency: Literal["Low", "Medium", "High", "Emergency"]
    description: str
    recommendations: list[str]
    caveats: str


class LabParameter(BaseModel):
    name: str
    value: str
    unit: str = Field(description="Unit of measure; empty string if none")
    status: Literal["Normal", "Abnormal", "Warning"]
    notes: str


class LabReportSummary(BaseModel):
    parameters: list[LabParameter]
    overallHealthScore: float = Field(description="Overall health score from 0 to 100")
    interpretation: str


# ---------------------------------------------------------------- responses
class FindCareResponse(BaseModel):
    text: str
    # Shape mirrors the JS SDK's groundingChunks: [{"maps": {"title", "uri", "placeId"}}]
    links: list[dict]
