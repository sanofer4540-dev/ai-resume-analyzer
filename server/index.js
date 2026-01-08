console.log("RUNNING INDEX FILE:", import.meta.url);

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "server",
    time: new Date().toISOString(),
  });
});

// ✅ retry helper for Render cold starts (AI service sleeping)
async function postWithRetry(url, data, options = {}, retries = 4) {
  let lastErr;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await axios.post(url, data, options);
    } catch (err) {
      lastErr = err;

      const status = err?.response?.status;
      const isRetryable =
        status === 502 ||
        status === 503 ||
        status === 504 ||
        err.code === "ECONNRESET" ||
        err.code === "ETIMEDOUT" ||
        err.code === "ECONNABORTED";

      // Not a “service waking up” type error -> stop immediately
      if (!isRetryable) throw err;

      const waitMs = 1000 * attempt; // 1s, 2s, 3s, 4s
      console.log(
        `AI call failed (attempt ${attempt}/${retries}) - retrying in ${waitMs}ms...`,
        status || err.code
      );

      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  throw lastErr;
}

app.post("/api/match", async (req, res) => {
  try {
    const { resume_text, job_text } = req.body;

    if (!resume_text || !job_text) {
      return res.status(400).json({
        error: "resume_text and job_text are required",
      });
    }

    const aiUrl = process.env.AI_SERVICE_URL;

    if (!aiUrl) {
      return res.status(500).json({
        error: "AI_SERVICE_URL is not set",
        hint: "Set it in Render → Express service → Environment",
      });
    }

    const aiRes = await postWithRetry(
      `${aiUrl}/match`,
      { resume_text, job_text },
      { headers: { "Content-Type": "application/json" } },
      4
    );

    if (aiRes.data == null) {
      return res.status(502).json({
        error: "AI service returned null",
        hint: "Check ai-service is running the correct main.py and /match returns JSON",
      });
    }

    return res.json(aiRes.data);
  } catch (error) {
    const status = error?.response?.status;
    const detail = error?.response?.data;

    console.error("AI ERROR:", {
      message: error.message,
      status,
      detail,
      code: error.code,
    });

    return res.status(502).json({
      error: "AI service failed",
      status,
      detail,
      hint: "If status is 502/503/504, the AI service was likely sleeping; retry should handle it.",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
