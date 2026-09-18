const { runHubSpotPipeline } = require("./dlt_simulator");

(async () => {
  try {
    console.log("=== Starting Task 2: HubSpot & DLT Pipeline Sync ===");
    const results = await runHubSpotPipeline();
    console.log("\n=== Ingestion Summary ===");
    console.table(results);
    process.exit(0);
  } catch (err) {
    console.error("[Pipeline Failed]:", err);
    process.exit(1);
  }
})();
