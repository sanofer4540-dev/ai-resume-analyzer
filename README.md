# AI Resume Analyzer (ATS-Focused)

An end-to-end AI-powered Resume Analyzer that compares a resume against a job description and produces **ATS-ready insights**, **resume rewrites**, and **bullet-level examples** — built to reflect how modern Applicant Tracking Systems actually evaluate candidates.

---

## What This Tool Does

- Calculates an **ATS match score (0–100)** using:
  - TF-IDF cosine similarity
  - Skill coverage analysis
  - Optional semantic similarity (embeddings-ready)
- Identifies **matched vs missing job keywords**
- Generates:
  - **Job-optimized resume rewrite**
  - **Recruiter-ready bullet examples**
  - Actionable ATS improvement suggestions
- Allows **one-click copy** of rewrite content and bullets

This tool is designed for **real job seekers**, focusing on evidence-based resume optimization rather than keyword stuffing.

---

## Architecture Overview

- **Frontend (React + Vite):**
  - Clean, card-based UI
  - Score visualization with progress bars
  - Copy-to-clipboard actions for recruiter use

- **Backend (Node.js + Express):**
  - API orchestration and validation
  - Aggregates AI scoring and analysis results

- **AI Service (Python + FastAPI):**
  - TF-IDF cosine similarity
  - Skill coverage analysis
  - Resume rewrite and bullet generation logic

**Client → Express API → FastAPI AI Service**

---

##  Why This Project Matters

- Mimics how modern ATS systems evaluate resumes
- Goes beyond keyword matching by requiring proof in bullets
- Demonstrates full-stack + AI service integration
- Focused on real recruiter workflows (copy-ready output)

This is not a demo toy — it models real hiring constraints.

---

##  Author

**Sanofer Rasheed**  
Full-Stack Developer | AI-Focused Projects
