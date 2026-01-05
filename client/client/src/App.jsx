import { useState } from "react";
import "./App.css";

function getScoreBadge(score) {
  if (score >= 75) return { label: "Strong Match", bg: "#e7f7ee", border: "#34c759" };
  if (score >= 50) return { label: "Moderate Match", bg: "#fff7e6", border: "#ff9500" };
  return { label: "Weak Match", bg: "#ffecec", border: "#ff3b30" };
}

function clampPercent(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export default function App() {
  const [resumeText, setResumeText] = useState("");
  const [jobText, setJobText] = useState("");
  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showDebug, setShowDebug] = useState(false);

function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard.writeText(text);
}

async function handleMatch() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("http://localhost:5000/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: resumeText,
          job_text: jobText,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Request failed");
      }

      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const tfidfPct = clampPercent(result?.debug?.tfidf_score);
  const coveragePct = clampPercent(result?.debug?.skill_coverage);
  const semanticPct =
    result?.debug?.semantic_score == null ? null : clampPercent(result?.debug?.semantic_score);

  const badge = result ? getScoreBadge(result.score) : null;

  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <div>
          <h1 className="h1">AI Resume Analyzer</h1>
          <p className="sub">Paste resume + job description → get ATS risks, improvements, and a rewrite.</p>
        </div>

        <div className="row">
          <button
            className="btn btnPrimary"
            onClick={handleMatch}
            disabled={loading || !resumeText || !jobText}
            title={!resumeText || !jobText ? "Paste both texts to run Match" : "Run Match"}
          >
            {loading ? "Matching..." : "Match"}
          </button>

          <button
            className="btn"
            onClick={() => setShowDebug((v) => !v)}
            disabled={!result}
            title={!result ? "Run a match first" : "Toggle debug"}
          >
            {showDebug ? "Hide Debug" : "Show Debug"}
          </button>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid2">
        <div className="card">
          <div className="cardTitle">
            <h3>Resume Text</h3>
            <span className="pill">Paste</span>
          </div>
          <textarea
            className="textarea"
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste resume text here..."
          />
          <div className="muted" style={{ marginTop: 8 }}>
            Tip: include your Skills + Projects sections for best results.
          </div>
        </div>

        <div className="card">
          <div className="cardTitle">
            <h3>Job Description</h3>
            <span className="pill">Paste</span>
          </div>
          <textarea
            className="textarea"
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="Paste job description here..."
          />
          <div className="muted" style={{ marginTop: 8 }}>
            Tip: include responsibilities + requirements (keywords live there).
          </div>
        </div>
      </div>

      {error && <div className="alert">Error: {error}</div>}

      {/* Results */}
      {result && (
        <div style={{ marginTop: 18 }}>
          {/* Top summary card */}
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="row">
                <span className="badge" style={{ background: badge.bg, borderColor: badge.border }}>
                  {badge.label}
                </span>
                <div className="kpi">
                  <span>Score: {result.score}</span>
                  <small>0–100</small>
                </div>
              </div>

              <div className="muted">{result.note}</div>
            </div>

            {/* Debug / Score Breakdown */}
            {showDebug && result.debug && (
              <>
                <hr className="hr" />

                <div className="cardTitle">
                  <h3>Score Breakdown</h3>
                  <span className="pill">Debug</span>
                </div>

                <div className="progressWrap">
                  <div className="progressLabelRow">
                    <span>Text Similarity (TF-IDF)</span>
                    <b>{tfidfPct.toFixed(2)}%</b>
                  </div>
                  <div className="track">
                    <div className="fill" style={{ width: `${tfidfPct}%`, background: "var(--purple)" }} />
                  </div>
                </div>

                <div className="progressWrap">
                  <div className="progressLabelRow">
                    <span>Skill Coverage</span>
                    <b>{coveragePct.toFixed(2)}%</b>
                  </div>
                  <div className="track" style={{ background: "#ecfdf3" }}>
                    <div className="fill" style={{ width: `${coveragePct}%`, background: "var(--green)" }} />
                  </div>
                </div>

                {semanticPct != null && (
                  <div className="progressWrap">
                    <div className="progressLabelRow">
                      <span>Semantic Similarity (Embeddings)</span>
                      <b>{semanticPct.toFixed(2)}%</b>
                    </div>
                    <div className="track" style={{ background: "#e6f6ff" }}>
                      <div className="fill" style={{ width: `${semanticPct}%`, background: "var(--cyan)" }} />
                    </div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      Semantic similarity captures meaning (synonyms / rewording), even if exact words don’t match.
                    </div>
                  </div>
                )}

                <div className="muted" style={{ marginTop: 10 }}>
                  Final score = <b>70%</b> text similarity + <b>30%</b> skill coverage
                </div>
              </>
            )}
          </div>

          {/* Matched + Missing */}
          <div className="grid2" style={{ marginTop: 14 }}>
            <div className="card">
              <div className="cardTitle">
                <h3>Matched Keywords</h3>
                <span className="pill">{result.matched_keywords?.length ?? 0}</span>
              </div>

              {result.matched_keywords?.length ? (
                <ul className="ul">
                  {result.matched_keywords.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              ) : (
                <div className="muted">None</div>
              )}
            </div>

            <div className="card">
              <div className="cardTitle">
                <h3>ATS Risk Keywords (Missing)</h3>
                <span className="pill">{result.missing_keywords?.length ?? 0}</span>
              </div>

              <div className="muted">
                These appear in the job but not your resume. Add only if you truly have experience.
              </div>

              {result.missing_keywords?.length ? (
                <ul className="ul">
                  {result.missing_keywords.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              ) : (
                <div className="muted" style={{ marginTop: 10 }}>
                  ✅ None — your resume already covers the key skills in this job post.
                </div>
              )}
            </div>
          </div>

          {/* Step 2: ATS Improvements */}
          <div className="card" style={{ marginTop: 14 }}>
            <div className="cardTitle">
              <h3>ATS Improvements</h3>
              <span className="pill">{result.action_items?.length ?? 0}</span>
            </div>

            {result.action_items?.length ? (
              <div style={{ display: "grid", gap: 12 }}>
                {result.action_items.map((item) => (
                  <details key={item.id} className="details">
                    <summary className="summary">
                      <span className="pill">{String(item.priority || "").toUpperCase()}</span>
                      <span>{item.title}</span>
                    </summary>

                    <div style={{ marginTop: 10 }}>
                      {item.why_it_matters && (
                        <>
                          <div style={{ fontWeight: 800, marginTop: 6 }}>Why it matters</div>
                          <div className="muted" style={{ marginTop: 4 }}>
                            {item.why_it_matters}
                          </div>
                        </>
                      )}

                      {item.how_to_fix?.length ? (
                        <>
                          <div style={{ fontWeight: 800, marginTop: 12 }}>How to fix</div>
                          <ul className="ul">
                            {item.how_to_fix.map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ul>
                        </>
                      ) : null}

                      {item.example ? (
                        <>
                          <div style={{ fontWeight: 800, marginTop: 12 }}>Example</div>
                          <div className="codeBox" style={{ marginTop: 6 }}>
                            {item.example}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <div className="muted">No action items 🎉</div>
            )}
          </div>

          {/* Rewrite + Suggestions */}
          <div className="grid2" style={{ marginTop: 14 }}>
            <div className="card">
              <div className="cardTitle">
                <h3>Job-Optimized Resume Rewrite</h3>
                <span className="pill">{result.resume_rewrite?.length ?? 0}</span>
                <button
                    className="btn"
                    onClick={() => copyToClipboard((result.resume_rewrite || []).map((x) => `• ${x}`).join("\n"))}
                    disabled={!result?.resume_rewrite?.length}
                    title="Copy resume rewrite bullets"
                  >
                    Copy
                  </button>

              </div>

              {result.resume_rewrite?.length ? (
                <ul className="ul">
                  {result.resume_rewrite.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              ) : (
                <div className="muted">No rewrite available.</div>
              )}
            </div>

            <div className="card">
              <div className="cardTitle">
                <h3>Suggestions</h3>
                <span className="pill">{result.suggestions?.length ?? 0}</span>
              </div>

              {result.suggestions?.length ? (
                <ul className="ul">
                  {result.suggestions.map((s, idx) => (
                    <li key={`${s.keyword}-${idx}`}>
                      <b>{s.keyword}:</b> <span className="muted">{s.message}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="muted">No suggestions 🎉</div>
              )}
            </div>
          </div>

          {/* Bullet Examples */}
          <div className="card" style={{ marginTop: 14 }}>
            <div className="cardTitle">
              <h3>Resume Bullet Examples</h3>
              <span className="pill">{result.bullet_examples?.length ?? 0}</span>
              <button
                    className="btn"
                    onClick={() =>
                      copyToClipboard(
                        (result.bullet_examples || [])
                          .map((b) => `• ${b.keyword}: ${b.bullet}`)
                          .join("\n")
                      )
                    }
                    disabled={!result?.bullet_examples?.length}
                    title="Copy bullet examples"
                  >
                    Copy
                  </button>

            </div>

            {result.bullet_examples?.length ? (
              <ul className="ul">
                {result.bullet_examples.map((b, idx) => (
                  <li key={`${b.keyword}-${idx}`}>
                    <b>{b.keyword}:</b> <span className="muted">{b.bullet}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="muted">No bullet examples available.</div>
            )}
          </div>

          {/* Top Job Keywords */}
          <div className="card" style={{ marginTop: 14 }}>
            <div className="cardTitle">
              <h3>Top Job Keywords</h3>
              <span className="pill">{result.top_job_keywords?.length ?? 0}</span>
            </div>

            {result.top_job_keywords?.length ? (
              <ul className="ul">
                {result.top_job_keywords.map((x, idx) => (
                  <li key={`${x.term}-${idx}`}>
                    {x.term} <span className="muted">(weight: {x.weight})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="muted">No top keywords available.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
