import os
import joblib
import numpy as np

MODEL_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(MODEL_DIR, "model.joblib")
TFIDF_PATH = os.path.join(MODEL_DIR, "tfidf.joblib")

_model = None
_tfidf = None

def get_model():
    global _model, _tfidf
    if _model is None or _tfidf is None:
        if not os.path.exists(MODEL_PATH) or not os.path.exists(TFIDF_PATH):
            from backend.train_model import train_and_save_model
            train_and_save_model()
        _model = joblib.load(MODEL_PATH)
        _tfidf = joblib.load(TFIDF_PATH)
    return _model, _tfidf

def analyze_review_text(text: str):
    if not text or not text.strip():
        raise ValueError("Customer review text cannot be empty.")

    model, tfidf = get_model()
    clean_text = text.lower().strip()
    features = tfidf.transform([clean_text])

    # Prediction & Probabilities
    probs = model.predict_proba(features)[0]
    classes = model.classes_
    best_idx = np.argmax(probs)
    predicted_sentiment = classes[best_idx]
    confidence = float(probs[best_idx]) * 100

    probability_distribution = {
        cls: round(float(prob) * 100, 2)
        for cls, prob in zip(classes, probs)
    }

    # Word contribution explanation
    feature_names = tfidf.get_feature_names_out()
    nonzero_indices = features.nonzero()[1]
    
    word_impacts = []
    class_coef = model.coef_[best_idx]

    for idx in nonzero_indices:
        token = feature_names[idx]
        tfidf_val = features[0, idx]
        coef_val = class_coef[idx]
        impact = tfidf_val * coef_val
        word_impacts.append({
            "word": token,
            "impact": round(float(impact), 4),
            "type": "positive_influence" if impact > 0 else "counter_influence"
        })

    word_impacts.sort(key=lambda x: abs(x["impact"]), reverse=True)
    top_words = word_impacts[:6]

    explanation = (
        f"The model classified this review as {predicted_sentiment} with {confidence:.1f}% confidence. "
        f"Key driving tokens include: " + ", ".join([f"'{w['word']}'" for w in top_words[:3]])
        if top_words else "Classification based on standard banking term frequency distribution."
    )

    return {
        "text": text,
        "sentiment": predicted_sentiment,
        "confidence": round(confidence, 1),
        "probabilities": probability_distribution,
        "explanation": explanation,
        "top_contributing_words": top_words,
        "model_type": "TF-IDF + Multinomial Logistic Regression"
    }
