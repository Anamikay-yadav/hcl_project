import os
import io
import csv
from datetime import datetime
from typing import Optional
import pandas as pd
from fastapi import FastAPI, HTTPException, Depends, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.database import get_database, check_db_health
from backend.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
    oauth2_scheme
)
from backend.model import analyze_review_text

app = FastAPI(
    title="Bank Muscat Customer Review Sentiment Analyzer API",
    description="FastAPI Backend for Bank Muscat Sentiment Analysis, MongoDB storage, and Analytics Dashboard",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Models -----------------
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = "Bank Analyst"
    role: Optional[str] = "Analyst"

class LoginRequest(BaseModel):
    username: str
    password: str

class AnalyzeRequest(BaseModel):
    review_text: str = Field(..., min_length=1)
    save_to_db: Optional[bool] = False
    category: Optional[str] = "Customer Support"
    channel: Optional[str] = "Online"
    location: Optional[str] = "Muscat"

# ----------------- Dependencies -----------------
def get_current_user(token: str = Depends(oauth2_scheme)):
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required"
        )
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    return payload

# ----------------- Auth Endpoints -----------------
@app.post("/api/auth/register")
def register(req: RegisterRequest):
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable.")

    # Check existing user
    if db.users.find_one({"$or": [{"username": req.username}, {"email": req.email}]}):
        raise HTTPException(status_code=400, detail="Username or email already exists.")

    user_doc = {
        "username": req.username,
        "email": req.email,
        "password_hash": get_password_hash(req.password),
        "full_name": req.full_name,
        "role": req.role,
        "created_at": datetime.utcnow()
    }
    db.users.insert_one(user_doc)

    token = create_access_token({"sub": req.username, "email": req.email, "role": req.role})
    return {
        "message": "User registered successfully",
        "token": token,
        "user": {
            "username": req.username,
            "email": req.email,
            "full_name": req.full_name,
            "role": req.role
        }
    }

@app.post("/api/auth/login")
def login(req: LoginRequest):
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable.")

    user = db.users.find_one({"username": req.username})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    token = create_access_token({"sub": user["username"], "email": user["email"], "role": user.get("role", "Analyst")})
    return {
        "message": "Login successful",
        "token": token,
        "user": {
            "username": user["username"],
            "email": user["email"],
            "full_name": user.get("full_name", user["username"]),
            "role": user.get("role", "Analyst")
        }
    }

@app.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    return {"user": user}

# ----------------- Dataset Import -----------------
@app.post("/api/dataset/import")
def import_dataset(user: dict = Depends(get_current_user)):
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable.")

    dataset_path = os.path.join(os.path.dirname(__file__), "..", "data", "bank_muscat_customer_reviews_5000.csv")
    if not os.path.exists(dataset_path):
        raise HTTPException(status_code=404, detail="Dataset file not found.")

    df = pd.read_csv(dataset_path)
    records = df.to_dict(orient="records")

    existing_ids = set(db.reviews.distinct("review_id"))
    new_records = [r for r in records if r["review_id"] not in existing_ids]

    if new_records:
        # Convert numeric rating
        for r in new_records:
            r["rating"] = int(r["rating"]) if pd.notnull(r["rating"]) else 3
            r["imported_at"] = datetime.utcnow()
        db.reviews.insert_many(new_records)

    total_count = db.reviews.count_documents({})
    return {
        "status": "success",
        "imported_count": len(new_records),
        "skipped_duplicates": len(records) - len(new_records),
        "total_reviews": total_count,
        "message": f"Dataset imported successfully. Added {len(new_records)} new records."
    }

# ----------------- Dashboard Analytics -----------------
@app.get("/api/dashboard/stats")
def get_dashboard_stats():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable.")

    total_reviews = db.reviews.count_documents({})
    if total_reviews == 0:
        return {
            "total_reviews": 0,
            "positive_reviews": 0,
            "negative_reviews": 0,
            "neutral_reviews": 0,
            "avg_rating": 0,
            "sentiment_distribution": [],
            "category_distribution": [],
            "channel_distribution": [],
            "recent_reviews": []
        }

    pos = db.reviews.count_documents({"sentiment": "Positive"})
    neg = db.reviews.count_documents({"sentiment": "Negative"})
    neu = db.reviews.count_documents({"sentiment": "Neutral"})

    # Avg rating
    rating_pipeline = [
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}}}
    ]
    avg_res = list(db.reviews.aggregate(rating_pipeline))
    avg_rating = round(avg_res[0]["avg"], 2) if avg_res else 0.0

    # Category breakdown
    cat_pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    cat_res = list(db.reviews.aggregate(cat_pipeline))
    category_distribution = [{"name": c["_id"] or "Other", "count": c["count"]} for c in cat_res]

    # Channel breakdown
    ch_pipeline = [
        {"$group": {"_id": "$channel", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    ch_res = list(db.reviews.aggregate(ch_pipeline))
    channel_distribution = [{"name": c["_id"] or "Other", "count": c["count"]} for c in ch_res]

    # Recent reviews
    recent = list(db.reviews.find({}, {"_id": 0}).sort("review_date", -1).limit(6))

    return {
        "total_reviews": total_reviews,
        "positive_reviews": pos,
        "negative_reviews": neg,
        "neutral_reviews": neu,
        "avg_rating": avg_rating,
        "sentiment_distribution": [
            {"name": "Positive", "value": pos, "color": "#10B981"},
            {"name": "Neutral", "value": neu, "color": "#64748B"},
            {"name": "Negative", "value": neg, "color": "#EF4444"}
        ],
        "category_distribution": category_distribution,
        "channel_distribution": channel_distribution,
        "recent_reviews": recent
    }

# ----------------- Sentiment Analysis -----------------
@app.post("/api/sentiment/analyze")
def analyze_review(req: AnalyzeRequest):
    try:
        result = analyze_review_text(req.review_text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference error: {e}")

    # Optional saving to MongoDB
    if req.save_to_db:
        db = get_database()
        if db is not None:
            db.analysis_results.insert_one({
                **result,
                "category": req.category,
                "channel": req.channel,
                "location": req.location,
                "analyzed_at": datetime.utcnow()
            })

    return result

# ----------------- Reviews Management -----------------
@app.get("/api/reviews")
def get_reviews(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    sentiment: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    rating: Optional[int] = Query(None),
    sort_order: Optional[str] = Query("desc")
):
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable.")

    query = {}
    if sentiment and sentiment != "All":
        query["sentiment"] = sentiment
    if category and category != "All":
        query["category"] = category
    if rating and rating > 0:
        query["rating"] = rating
    if search and search.strip():
        query["customer_review"] = {"$regex": search.strip(), "$options": "i"}

    sort_direction = -1 if sort_order == "desc" else 1
    total_matching = db.reviews.count_documents(query)
    
    skip = (page - 1) * limit
    cursor = db.reviews.find(query, {"_id": 0}).sort("review_date", sort_direction).skip(skip).limit(limit)
    reviews_list = list(cursor)

    return {
        "reviews": reviews_list,
        "total": total_matching,
        "page": page,
        "limit": limit,
        "total_pages": (total_matching + limit - 1) // limit
    }

@app.get("/api/reviews/{review_id}")
def get_single_review(review_id: str):
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable.")
    review = db.reviews.find_one({"review_id": review_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")
    return review

@app.delete("/api/reviews/{review_id}")
def delete_review(review_id: str, user: dict = Depends(get_current_user)):
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable.")
    res = db.reviews.delete_one({"review_id": review_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Review not found or already deleted.")
    return {"status": "success", "message": f"Review {review_id} successfully deleted."}

# ----------------- Reports -----------------
@app.get("/api/reports")
def get_reports():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable.")

    total = db.reviews.count_documents({})
    if total == 0:
        return {"total_reviews": 0, "categories": [], "channels": [], "timeline": []}

    # Sentiment percentages
    pos = db.reviews.count_documents({"sentiment": "Positive"})
    neg = db.reviews.count_documents({"sentiment": "Negative"})
    neu = db.reviews.count_documents({"sentiment": "Neutral"})

    # Categories breakdown with average rating
    cat_pipeline = [
        {
            "$group": {
                "_id": "$category",
                "total": {"$sum": 1},
                "avg_rating": {"$avg": "$rating"},
                "positive": {"$sum": {"$cond": [{"$eq": ["$sentiment", "Positive"]}, 1, 0]}},
                "negative": {"$sum": {"$cond": [{"$eq": ["$sentiment", "Negative"]}, 1, 0]}},
                "neutral": {"$sum": {"$cond": [{"$eq": ["$sentiment", "Neutral"]}, 1, 0]}}
            }
        },
        {"$sort": {"total": -1}}
    ]
    categories = list(db.reviews.aggregate(cat_pipeline))
    for c in categories:
        c["avg_rating"] = round(c.get("avg_rating", 0), 2)
        c["category"] = c.pop("_id")

    # Date-wise review volume (by year-month)
    timeline_pipeline = [
        {
            "$project": {
                "month": {"$substr": ["$review_date", 0, 7]},
                "sentiment": 1
            }
        },
        {
            "$group": {
                "_id": "$month",
                "count": {"$sum": 1},
                "positive": {"$sum": {"$cond": [{"$eq": ["$sentiment", "Positive"]}, 1, 0]}},
                "negative": {"$sum": {"$cond": [{"$eq": ["$sentiment", "Negative"]}, 1, 0]}},
                "neutral": {"$sum": {"$cond": [{"$eq": ["$sentiment", "Neutral"]}, 1, 0]}}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    timeline = list(db.reviews.aggregate(timeline_pipeline))
    for t in timeline:
        t["month"] = t.pop("_id")

    return {
        "total_reviews": total,
        "sentiment_summary": {
            "positive": {"count": pos, "percentage": round(pos / total * 100, 1)},
            "negative": {"count": neg, "percentage": round(neg / total * 100, 1)},
            "neutral": {"count": neu, "percentage": round(neu / total * 100, 1)}
        },
        "categories": categories,
        "timeline": timeline
    }

@app.get("/api/reports/download-csv")
def download_csv_report():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable.")

    reviews = list(db.reviews.find({}, {"_id": 0}))
    if not reviews:
        raise HTTPException(status_code=404, detail="No reviews available for export.")

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "review_id", "review_date", "customer_review", "sentiment", "rating",
        "category", "channel", "location", "language", "is_anomaly"
    ])
    writer.writeheader()
    for r in reviews:
        writer.writerow({
            "review_id": r.get("review_id", ""),
            "review_date": r.get("review_date", ""),
            "customer_review": r.get("customer_review", ""),
            "sentiment": r.get("sentiment", ""),
            "rating": r.get("rating", ""),
            "category": r.get("category", ""),
            "channel": r.get("channel", ""),
            "location": r.get("location", ""),
            "language": r.get("language", ""),
            "is_anomaly": r.get("is_anomaly", "")
        })

    output.seek(0)
    response = StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = "attachment; filename=bank_muscat_sentiment_report.csv"
    return response

# ----------------- Health -----------------
@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "Bank Muscat Sentiment Analyzer FastAPI Backend",
        "database": check_db_health()
    }
