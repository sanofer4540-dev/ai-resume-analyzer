import numpy as np 
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel
from datetime import datetime
import re

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

app = FastAPI()

# Step 5: load embedding model once
_embedder = None

def get_embedder():
    global _embedder
    if _embedder is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embedder = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception:
            _embedder = False
    return _embedder

def semantic_similarity(resume_text: str, job_text: str) -> Optional[float]:
    model = get_embedder()
    if model is False or model is None:
        return None
    try:
        emb = model.encode([resume_text, job_text], normalize_embeddings=True)
        return float(np.dot(emb[0], emb[1]))
    except Exception:
        return None


class MatchRequest(BaseModel):
    resume_text: str
    job_text: str


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "ai-service",
        "time": datetime.utcnow().isoformat(),
    }


@app.post("/match")
def match(req: MatchRequest):
    resume = req.resume_text.strip()
    job = req.job_text.strip()

    if not resume or not job:
        return {"score": 0, "note": "Resume text or job text is empty."}

    # ---- TF-IDF similarity ----
    vectorizer = TfidfVectorizer(stop_words="english")
    vectors = vectorizer.fit_transform([resume, job])

    sim = cosine_similarity(vectors[0], vectors[1])[0][0]

# Step 5: semantic similarity
    sem_sim = semantic_similarity(resume, job)



    # ---- tokenizer + normalization ----
    def tokenize(text: str):
        raw = re.findall(r"[a-z0-9\.\+\-#]+", text.lower())
        normalized = []
        for w in raw:
            w = w.strip(".")
            w = w.replace("node.js", "node")
            w = w.replace("javascript", "js")

            if w.endswith("ing") and len(w) > 5:
                w = w[:-3]
            if w.endswith("ed") and len(w) > 4:
                w = w[:-2]
            if w.endswith("ment") and len(w) > 6:
                w = w[:-4]

            normalized.append(w)
        return normalized

    extra_stop = {
        "look", "looking", "seeking", "need", "needs", "want", "wanted",
        "role", "position", "join", "team", "great", "strong"
    }

    skills_allowlist = {
        "react", "node", "express", "mongodb", "sql", "postgres", "mysql",
        "rest", "api", "apis", "authentication", "jwt", "oauth",
        "docker", "kubernetes", "aws", "azure", "gcp",
        "typescript", "javascript", "js", "python",
        "deployment", "deploy", "ci", "cd", "cicd", "git", "github"
    }

    # ---- matched / missing keywords ----
    resume_terms = {t for t in tokenize(resume) if t not in extra_stop}
    job_terms = {t for t in tokenize(job) if t not in extra_stop}

    resume_terms = {t for t in resume_terms if t in skills_allowlist}
    job_terms = {t for t in job_terms if t in skills_allowlist}

    matched = sorted(resume_terms & job_terms)
    missing = sorted(job_terms - resume_terms)

    # ---- hybrid score: 70% TF-IDF + 30% skill coverage ----
    coverage = (len(matched) / len(job_terms)) if job_terms else 0.0
    final_score = int(round((0.70 * (sim * 100)) + (0.30 * (coverage * 100))))
    score = max(0, min(100, final_score))

    # ---- top job keywords (TF-IDF based; skills only) ----
    feature_names = vectorizer.get_feature_names_out()
    job_vec = vectors[1].toarray().flatten()
    top_idx = job_vec.argsort()[::-1]

    top_job_keywords = []
    for i in top_idx:
        if job_vec[i] <= 0:
            continue

        term = feature_names[i]
        term_norm = tokenize(term)[0] if tokenize(term) else term

        if term_norm in extra_stop:
            continue
        if term_norm not in skills_allowlist:
            continue

        top_job_keywords.append({
            "term": term_norm,
            "weight": float(round(job_vec[i], 4))
        })

        if len(top_job_keywords) >= 15:
            break

    # ---- suggestions ----
    def build_suggestions(missing_keywords, top_keywords):
        suggestions = []
        for kw in missing_keywords[:10]:
            suggestions.append({
                "keyword": kw,
                "message": f"Add '{kw}' to your resume if you have real experience with it (projects, bullet points, or skills section)."
            })

        matched_set = set(matched)
        for item in top_keywords:
            kw = item["term"]
            if kw not in matched_set and kw not in missing_keywords:
                suggestions.append({
                    "keyword": kw,
                    "message": f"The job strongly emphasizes '{kw}'. If you’ve used it, mention it explicitly in your resume."
                })
            if len(suggestions) >= 10:
                break
        return suggestions

    # ---- bullet examples ----
    def build_bullet_examples(matched_keywords, missing_keywords):
        templates = {
            "react": "Built reusable React components and integrated REST APIs for dynamic data loading.",
            "node": "Built Node.js backend services and implemented API endpoints with validation and error handling.",
            "mongodb": "Designed MongoDB collections and indexes to support fast queries and scalable storage.",
            "rest": "Built RESTful APIs with consistent routes, status codes, and predictable response shapes.",
            "authentication": "Implemented authentication and protected routes using token-based auth.",
            "deploy": "Deployed applications using environment-based configuration and reliable build steps.",
            "apis": "Designed and consumed APIs with consistent request/response formats and documentation.",
        }

        examples = []
        for kw in matched_keywords:
            if kw in templates:
                examples.append({"keyword": kw, "bullet": templates[kw]})
            if len(examples) >= 6:
                break

        for kw in missing_keywords:
            if kw in templates:
                examples.append({
                    "keyword": kw,
                    "bullet": f"If you have experience with {kw}: {templates[kw]}"
                })
            if len(examples) >= 10:
                break
        return examples

    # ---- resume rewrite (only matched skills) ----
    def rewrite_resume(matched_keywords, top_keywords):
        templates = {
            "react": "Built reusable React components and optimized UI performance for scalable web applications.",
            "node": "Developed Node.js backend services with structured REST APIs, validation, and error handling.",
            "mongodb": "Designed MongoDB schemas and indexes to support efficient queries and scalable storage.",
            "authentication": "Implemented authentication and protected routes using token-based authorization.",
            "apis": "Designed and consumed APIs with consistent request/response contracts and documentation.",
            "deploy": "Deployed applications using environment-based configuration and reliable build/deployment steps.",
            "rest": "Built RESTful services with consistent routes, status codes, and predictable response shapes.",
            "express": "Built Express.js middleware and routes for maintainable backend architecture.",
            "git": "Used Git for version control with clean commits and collaborative workflows.",
        }

        matched_set = set(matched_keywords)
        ordered = []

        for item in top_keywords[:10]:
            t = item["term"]
            if t in matched_set and t not in ordered:
                ordered.append(t)

        for kw in matched_keywords:
            if kw not in ordered:
                ordered.append(kw)

        rewritten = []
        for kw in ordered:
            if kw in templates:
                rewritten.append(templates[kw])

        return rewritten[:8]

    # ✅ Step 2: Action Items (ATS Improvements)
    def generate_action_items(score_val, matched_keywords, missing_keywords, resume_text):
        action_items = []

        # Helper checks
        has_numbers = bool(re.search(r"\d", resume_text or ""))

        # 1) Missing keywords (HIGH)
        if missing_keywords:
            action_items.append({
                "id": "add-missing-keywords",
                "title": "Add missing job keywords naturally",
                "priority": "high",
                "category": "keywords",
                "why_it_matters": "ATS often filters candidates using job keywords. Missing terms can reduce shortlist chances.",
                "how_to_fix": [
                    "Only add keywords you truly have experience with (never fake).",
                    "Put them in Skills AND show proof in 1–2 bullet points under Experience/Projects.",
                    "Use the job wording (example: 'REST APIs' not only 'APIs')."
                ],
                "example": f"Add and prove (if true): {', '.join(missing_keywords[:6])}"
            })
        else:
            action_items.append({
                "id": "keywords-covered",
                "title": "Keywords look good — strengthen proof with bullets",
                "priority": "medium",
                "category": "keywords",
                "why_it_matters": "Having keywords in Skills helps ATS, but bullets prove real experience to recruiters.",
                "how_to_fix": [
                    "For each top skill, add at least one bullet showing how you used it.",
                    "Use: Action + Tech + Result."
                ],
                "example": "Implemented JWT authentication in Node.js APIs; secured 15+ endpoints and reduced auth errors."
            })

        # 2) Add metrics (HIGH) if no numbers
        if not has_numbers:
            action_items.append({
                "id": "add-metrics",
                "title": "Add measurable impact (numbers)",
                "priority": "high",
                "category": "impact",
                "why_it_matters": "Recruiters scan for outcomes like performance, scale, reliability, or user impact.",
                "how_to_fix": [
                    "Add metrics like: load time, API latency, bug reduction, users served, test coverage, uptime.",
                    "Estimates are okay if honest (example: '~20%')."
                ],
                "example": "Improved page load time by ~35% using code-splitting and memoization."
            })

        # 3) Tailor summary (MED) if score is low-ish
        if score_val < 60:
            action_items.append({
                "id": "tailor-summary",
                "title": "Tailor your summary to match this job",
                "priority": "medium",
                "category": "tailoring",
                "why_it_matters": "ATS + recruiters compare your top section with job requirements quickly.",
                "how_to_fix": [
                    "Rewrite the top 2–3 lines to include role title + 3 key requirements.",
                    "Keep it short and keyword-aligned."
                ],
                "example": "React Developer with Node.js + MongoDB experience building REST APIs and authentication."
            })

        # 4) Put skills in project bullets (MED)
        if matched_keywords:
            action_items.append({
                "id": "proof-in-bullets",
                "title": "Move key skills into project/experience bullets (proof)",
                "priority": "medium",
                "category": "content",
                "why_it_matters": "ATS sees keywords anywhere, but recruiters want proof in bullets.",
                "how_to_fix": [
                    "Ensure each important skill appears in at least one bullet with context.",
                    "Use: Action + Tech + Result."
                ],
                "example": "Built REST APIs in Express; reduced error rate by ~20% with validation and logging."
            })

        return action_items[:6]

    # ✅ IMPORTANT: match() MUST end with a return dict (never fall off)
    return {
        "score": score,
        "note": "TF-IDF cosine similarity + skill-based keyword analysis.",
        "matched_keywords": matched[:20],
        "missing_keywords": missing[:20],
        "top_job_keywords": top_job_keywords,
        "suggestions": build_suggestions(missing, top_job_keywords),
        "bullet_examples": build_bullet_examples(matched, missing),
        "resume_rewrite": rewrite_resume(matched, top_job_keywords),

        # ✅ Step 2 output
        "action_items": generate_action_items(score, matched, missing, resume),

        "debug": {
    "tfidf_score": float(round(sim * 100, 2)),
    "skill_coverage": float(round(coverage * 100, 2)),
    "semantic_score": None if sem_sim is None else float(round(sem_sim * 100, 2)),
},


    }
