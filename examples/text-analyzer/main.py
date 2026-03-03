import re
from collections import Counter

def word_count(text: str) -> dict:
    """Count words, sentences, and characters in text."""
    words = text.split()
    sentences = re.split(r'[.!?]+', text)
    sentences = [s for s in sentences if s.strip()]
    return {
        "words": len(words),
        "sentences": len(sentences),
        "characters": len(text),
        "avg_word_length": round(sum(len(w) for w in words) / max(len(words), 1), 1),
    }

def top_words(text: str, n: int = 5) -> dict:
    """Find the most common words in text."""
    words = re.findall(r'\b\w+\b', text.lower())
    counter = Counter(words)
    return {
        "top_words": [{"word": w, "count": c} for w, c in counter.most_common(n)],
        "unique_words": len(set(words)),
        "total_words": len(words),
    }

def sentiment(text: str) -> dict:
    """Simple keyword-based sentiment analysis."""
    positive = {"good", "great", "excellent", "amazing", "love", "happy", "best", "wonderful"}
    negative = {"bad", "terrible", "awful", "hate", "worst", "horrible", "sad", "angry"}
    words = set(re.findall(r'\b\w+\b', text.lower()))
    pos = len(words & positive)
    neg = len(words & negative)
    if pos > neg:
        label = "positive"
    elif neg > pos:
        label = "negative"
    else:
        label = "neutral"
    return {"sentiment": label, "positive_count": pos, "negative_count": neg}
