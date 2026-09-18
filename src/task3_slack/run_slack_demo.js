const {
  setupClickHouseSlackSchema,
  runHistoricalBackfill,
  startRealtimeStream,
  setPauseState,
} = require("./slack_engine");

async function main() {
  console.log("=== Starting Task 3: Dual-Mode Slack Ingestion Engine ===");
  await setupClickHouseSlackSchema();

  console.log("\n--- 1. Executing Parallel Channel Backfill ---");
  await Promise.all([
    runHistoricalBackfill("C100_GENERAL"),
    runHistoricalBackfill("C200_COMPLIANCE"),
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  console.log("\n--- 2. Starting Real-Time Event Streaming Mode ---");
  startRealtimeStream();

  setTimeout(() => {
    console.log("\n--- 3. Testing Pause Control ---");
    setPauseState(true);
  }, 6000);

  setTimeout(() => {
    console.log("\n--- 4. Testing Resume Control ---");
    setPauseState(false);
  }, 10000);

  setTimeout(() => {
    console.log("\n=== Task 3 Engine Execution Complete ===");
    process.exit(0);
  }, 14000);
}

main().catch(console.error);
