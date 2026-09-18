require("dotenv").config();
const { createClient } = require("@clickhouse/client");
const { generateHubSpotData } = require("./mock_hubspot");

const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
});

function flattenHubSpotRecord(record) {
  // Format ISO string to ClickHouse DateTime64 compatible string: "YYYY-MM-DD HH:MM:SS.mmm"
  const now = new Date();
  const formattedDateTime = now
    .toISOString()
    .replace("T", " ")
    .replace("Z", "");

  return {
    id: String(record.id),
    ...record.properties,
    amount: record.properties.amount ? Number(record.properties.amount) : 0,
    annualrevenue: record.properties.annualrevenue
      ? Number(record.properties.annualrevenue)
      : 0,
    _dlt_loaded_at: formattedDateTime,
  };
}

async function setupHubSpotTable(tableName, sampleRow) {
  const columnDefs = Object.keys(sampleRow)
    .map((key) => {
      if (key === "_dlt_loaded_at") return `${key} DateTime64(3)`;
      if (key === "amount" || key === "annualrevenue") return `${key} Float64`;
      return `${key} String`;
    })
    .join(",\n");

  await clickhouse.command({
    query: `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnDefs}
      ) ENGINE = ReplacingMergeTree(_dlt_loaded_at)
      PRIMARY KEY id
    `,
  });
}

async function runHubSpotPipeline() {
  console.log("[DLT Pipeline] Extracting mock HubSpot endpoints...");
  const rawData = generateHubSpotData();
  const summary = [];

  for (const [entityName, records] of Object.entries(rawData)) {
    const tableName = `hubspot_${entityName}`;
    const normalizedRecords = records.map(flattenHubSpotRecord);

    if (normalizedRecords.length > 0) {
      await setupHubSpotTable(tableName, normalizedRecords[0]);

      await clickhouse.insert({
        table: tableName,
        values: normalizedRecords,
        format: "JSONEachRow",
      });

      console.log(
        `[DLT Pipeline] Processed & Normalized ${normalizedRecords.length} records into ClickHouse table: ${tableName}`,
      );
      summary.push({
        entity: entityName,
        table: tableName,
        rows: normalizedRecords.length,
        status: "SUCCESS",
      });
    }
  }

  return summary;
}

module.exports = { runHubSpotPipeline };
