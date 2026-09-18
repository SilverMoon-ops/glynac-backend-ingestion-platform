require("dotenv").config();
const express = require("express");
const path = require("path");
const { runIngestion } = require("../ingestion/bulk_ingest");

const app = express();
const PORT = process.env.PORT || 3000;

let jobLogs = [];
let isSyncRunning = false;

app.use(express.static(path.join(__dirname)));

app.get("/api/status", (req, res) => {
  res.json({ jobs: jobLogs, isSyncRunning });
});

app.post("/api/sync", async (req, res) => {
  if (isSyncRunning) {
    return res
      .status(409)
      .json({ success: false, error: "A sync job is already running." });
  }

  isSyncRunning = true;
  try {
    const { summary, overallStatus } = await runIngestion();
    const logEntry = {
      timestamp: new Date().toISOString(),
      status: overallStatus,
      details: summary,
    };
    jobLogs.unshift(logEntry);
    res.json({ success: true, log: logEntry });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    isSyncRunning = false;
  }
});

app.listen(PORT, () => {
  console.log(
    `[Dashboard] Monitoring Console active at http://localhost:${PORT}`,
  );
});
