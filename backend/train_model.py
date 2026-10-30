import os
import pandas as pd
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "bank_muscat_customer_reviews_5000.csv")
MODEL_DIR = os.path.dirname(__file__)

def train_and_save_model():
    print(f"Loading dataset from: {DATA_PATH}")
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Dataset not found at {DATA_PATH}")

    df = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df)} customer reviews.")
    print("Class breakdown:\n", df['sentiment'].value_counts())

    # Preprocessing
    df['clean_review'] = df['customer_review'].astype(str).str.lower().str.strip()

    X = df['clean_review']
    y = df['sentiment']

    # TF-IDF Feature Extraction
    tfidf = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=5000,
        stop_words='english',
        sublinear_tf=True
    )
    X_tfidf = tfidf.fit_transform(X)

    # Train / Test split for evaluation
    X_train, X_test, y_train, y_test = train_test_split(
        X_tfidf, y, test_size=0.2, random_state=42, stratify=y
    )

    # Train Logistic Regression
    clf = LogisticRegression(
        C=1.0,
        max_iter=1000,
        class_weight='balanced',
        solver='lbfgs',
        random_state=42
    )
    clf.fit(X_train, y_train)

    # Evaluate
    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"\nModel Accuracy on Test Set: {acc * 100:.2f}%")
    print("\nClassification Report:\n", classification_report(y_test, y_pred))

    # Retrain on full dataset for maximum generalization
    clf.fit(X_tfidf, y)

    # Save artifacts
    model_path = os.path.join(MODEL_DIR, "model.joblib")
    tfidf_path = os.path.join(MODEL_DIR, "tfidf.joblib")

    joblib.dump(clf, model_path)
    joblib.dump(tfidf, tfidf_path)

    print(f"Saved trained model to: {model_path}")
    print(f"Saved TF-IDF vectorizer to: {tfidf_path}")
    return acc

if __name__ == "__main__":
    train_and_save_model()
