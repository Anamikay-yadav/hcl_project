import os
import certifi
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

load_dotenv()

MONGODB_URI = os.getenv(
    "MONGODB_URI",
    "mongodb://localhost:27017/bank_muscat_sentiment_db"
)

client = None
db = None

def get_database():
    global client, db
    if db is not None:
        return db
    try:
        client = MongoClient(
            MONGODB_URI,
            serverSelectionTimeoutMS=5000,
            tlsCAFile=certifi.where() if hasattr(certifi, 'where') else None
        )
        client.admin.command('ping')
        db = client["bank_muscat_sentiment_db"]

        db.users.create_index([("username", ASCENDING)], unique=True)
        db.users.create_index([("email", ASCENDING)], unique=True)
        db.reviews.create_index([("review_id", ASCENDING)], unique=True)
        db.reviews.create_index([("sentiment", ASCENDING)])
        db.reviews.create_index([("category", ASCENDING)])

        print("[MongoDB] Connected successfully to Bank Muscat database!")
        return db
    except (ConnectionFailure, ServerSelectionTimeoutError, Exception) as e:
        print(f"[MongoDB Warning] Connection error: {e}")
        return None

def check_db_health():
    try:
        database = get_database()
        if database is not None:
            database.command('ping')
            return {"status": "connected", "database": "bank_muscat_sentiment_db", "client": "MongoDB Atlas"}
        return {"status": "offline", "message": "Could not connect to MongoDB Atlas"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
