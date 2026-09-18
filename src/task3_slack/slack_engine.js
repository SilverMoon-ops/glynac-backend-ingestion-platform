require("dotenv").config();
const fs = require("fs");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const { createClient } = require("@clickhouse/client");
const minioModule = require("../ingestion/minio_client");
const minioClient = minioModule.minioClient || minioModule;

const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
});

const BUCKET_NAME = process.env.MINIO_BUCKET || "salesforce";
const CHECKPOINT_FILE = path.join(__dirname, "checkpoint.json");

let isPaused = false;
let wsClient = null;

function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf-8"));
  }
  return {};
}

function saveCheckpoint(channelId, lastTs) {
  const cp = loadCheckpoint();
  cp[channelId] = lastTs;
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
  console.log(`[CHECKPOINT] Saved state for ${channelId} at ts=${lastTs}`);
}

async function setupClickHouseSlackSchema() {
  await clickhouse.command({
    query: `
      CREATE TABLE IF NOT EXISTS slack_messages (
        channel_id String,
        message_ts String,
        user_id String,
        text String,
        thread_ts Nullable(String),
        ingested_at DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(ingested_at)
      PRIMARY KEY (channel_id, message_ts)
    `,
  });

  await clickhouse.command({
    query: `
      CREATE VIEW IF NOT EXISTS v_slack_compliance_timeline AS
      SELECT channel_id, message_ts, user_id, text, ingested_at
      FROM slack_messages
      ORDER BY message_ts DESC
    `,
  });
}

async function processMessageBatch(channelId, messages, mode) {
  if (messages.length === 0) return;

  const dateStr = new Date().toISOString().split("T")[0];
  const objectPath = `slack/${mode}/${channelId}/${dateStr}/batch_${Date.now()}.json`;
  const jsonData = JSON.stringify(messages, null, 2);

  await minioClient.putObject(
    BUCKET_NAME,
    objectPath,
    Buffer.from(jsonData),
    jsonData.length,
    { "Content-Type": "application/json" },
  );

  await clickhouse.insert({
    table: "slack_messages",
    values: messages.map((m) => ({
      channel_id: m.channel_id,
      message_ts: m.message_ts,
      user_id: m.user_id,
      text: m.text,
      thread_ts: m.thread_ts || null,
    })),
    format: "JSONEachRow",
  });

  const lastMsg = messages[messages.length - 1];
  saveCheckpoint(channelId, lastMsg.message_ts);
}

async function runHistoricalBackfill(channelId) {
  if (isPaused) return;
  console.log(
    `[BACKFILL] Starting historical ingestion for channel ${channelId}...`,
  );
  const checkpoint = loadCheckpoint();
  const lastTs = checkpoint[channelId] || "0";

  http.get(
    `http://localhost:3001/api/conversations.history?channel=${channelId}&limit=15`,
    (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", async () => {
        const data = JSON.parse(raw);
        if (data.ok) {
          const newMessages = data.messages.filter(
            (m) => m.message_ts > lastTs,
          );
          console.log(
            `[BACKFILL] Found ${newMessages.length} new historical messages for ${channelId}`,
          );
          await processMessageBatch(channelId, newMessages, "historical");
        }
      });
    },
  );
}

function startRealtimeStream() {
  console.log("[STREAMING] Connecting to Real-time Slack WebSocket...");
  wsClient = new WebSocket("ws://localhost:8080");

  wsClient.on("message", async (data) => {
    if (isPaused) return;
    const event = JSON.parse(data.toString());
    if (event.type === "message") {
      console.log(
        `[STREAMING] Received live message in ${event.channel_id}: "${event.text}"`,
      );
      await processMessageBatch(event.channel_id, [event], "realtime");
    }
  });
}

function setPauseState(paused) {
  isPaused = paused;
  console.log(
    `[ENGINE STATE] Engine state changed: ${isPaused ? "PAUSED" : "RUNNING"}`,
  );
}

module.exports = {
  setupClickHouseSlackSchema,
  runHistoricalBackfill,
  startRealtimeStream,
  setPauseState,
};
