const express = require("express");
const path = require("path");
const { runIngestion } = require("../ingestion/bulk_ingest");

const app = express();
const PORT = 3000;

let jobLogs = [];

app.use(express.static(path.join(__dirname)));

app.get("/api/status", (req, res) => {
  res.json({ jobs: jobLogs });
});

app.post("/api/sync", async (req, res) => {
  try {
    const results = await runIngestion();
    const logEntry = {
      timestamp: new Date().toISOString(),
      status: "JobComplete",
      details: results,
    };
    jobLogs.unshift(logEntry);
    res.json({ success: true, log: logEntry });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(
    `[Dashboard] Monitoring Console active at http://localhost:${PORT}`,
  );
});
