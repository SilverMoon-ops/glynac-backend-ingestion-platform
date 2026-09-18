const express = require("express");
const { WebSocketServer } = require("ws");

const app = express();
const PORT = 3001;
const WS_PORT = 8080;

app.use(express.json());

const channels = [
  { id: "C100_GENERAL", name: "general" },
  { id: "C200_COMPLIANCE", name: "compliance-alerts" },
];

const users = [
  { id: "U1", name: "alice_sec", role: "Compliance Officer" },
  { id: "U2", name: "bob_dev", role: "Backend Developer" },
];

app.get("/api/conversations.history", (req, res) => {
  const channelId = req.query.channel || "C100_GENERAL";
  const limit = parseInt(req.query.limit, 10) || 10;

  const messages = Array.from({ length: limit }, (_, i) => ({
    channel_id: channelId,
    message_ts: `${1740000000 + i * 60}.000100`,
    user_id: i % 2 === 0 ? "U1" : "U2",
    text: `Historical backfill log message #${i + 1} in ${channelId}`,
    thread_ts: null,
  }));

  res.json({ ok: true, messages, has_more: false });
});

app.get("/api/users.list", (req, res) =>
  res.json({ ok: true, members: users }),
);
app.get("/api/conversations.list", (req, res) =>
  res.json({ ok: true, channels }),
);

app.listen(PORT, () => {
  console.log(`[Mock Slack REST] Listening on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ port: WS_PORT });
console.log(`[Mock Slack WebSocket] Active on ws://localhost:${WS_PORT}`);

wss.on("connection", (ws) => {
  console.log("[Mock Slack WS] Real-time engine client connected.");
  let counter = 1;
  const interval = setInterval(() => {
    const liveMsg = {
      type: "message",
      channel_id: "C200_COMPLIANCE",
      message_ts: `${Math.floor(Date.now() / 1000)}.${counter}00`,
      user_id: "U1",
      text: `LIVE AUDIT EVENT: Policy check verified batch #${counter}`,
      thread_ts: null,
    };
    ws.send(JSON.stringify(liveMsg));
    counter++;
  }, 3000);

  ws.on("close", () => clearInterval(interval));
});
