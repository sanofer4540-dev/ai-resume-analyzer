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
    time: new Date().toISOString()
  });
});

app.post("/api/match", async (req, res) => {
  try {
    // ✅ destructuring happens here
    const { resume_text, job_text } = req.body;

    // ✅ guard against empty body
    if (!resume_text || !job_text) {
      return res.status(400).json({
        error: "resume_text and job_text are required",
      });
    }

    const aiRes = await axios.post("http://127.0.0.1:8000/match", {
  resume_text,
  job_text,
}, {
  headers: { "Content-Type": "application/json" }
});

// If AI ever returns null/empty, surface it clearly
if (aiRes.data == null) {
  return res.status(502).json({
    error: "AI service returned null",
    hint: "Check ai-service is running the correct main.py and /match returns JSON",
  });
}

return res.json(aiRes.data);

  } catch (error) {
    console.error("AI ERROR:", error.message);
    return res.status(500).json({ error: "AI service failed" });
  }
});



const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

