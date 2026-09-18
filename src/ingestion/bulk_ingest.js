require("dotenv").config();
const { createClient } = require("@clickhouse/client");
const { generateAll } = require("../generator/mock_generator");
const { minioClient } = require("./minio_client");

const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
});

const BUCKET_NAME = process.env.MINIO_BUCKET || "salesforce";

async function setupClickHouseTables(objects) {
  for (const obj of objects) {
    const tableName = `salesforce_${obj.toLowerCase()}`;
    // ReplacingMergeTree keeps the pipeline safe once real, stable
    // Salesforce record IDs replace the mock generator's IDs: re-ingesting
    // the same id will dedupe (keeping the row with the latest created_date)
    // instead of silently accumulating duplicates the way MergeTree would.
    await clickhouse.command({
      query: `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id String,
          organisation_id String,
          name String,
          status String,
          created_date String,
          value UInt32
        ) ENGINE = ReplacingMergeTree(created_date)
        PRIMARY KEY id
      `,
    });
  }
}

async function ingestObject(objectName, orgId, records, dateStr) {
  const objectPath = `${objectName.toLowerCase()}/${orgId}/${dateStr}/batch_${Date.now()}.json`;
  const jsonData = JSON.stringify(records, null, 2);

  await minioClient.putObject(
    BUCKET_NAME,
    objectPath,
    Buffer.from(jsonData),
    jsonData.length,
    { "Content-Type": "application/json" },
  );

  const tableName = `salesforce_${objectName.toLowerCase()}`;
  await clickhouse.insert({
    table: tableName,
    values: records,
    format: "JSONEachRow",
  });

  return {
    object: objectName,
    path: `${BUCKET_NAME}/${objectPath}`,
    rows: records.length,
    status: "success",
  };
}

async function runIngestion() {
  const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
  if (!bucketExists) {
    await minioClient.makeBucket(BUCKET_NAME);
  }

  const dataset = generateAll();
  await setupClickHouseTables(Object.keys(dataset));

  const dateStr = new Date().toISOString().split("T")[0];
  const summary = [];

  // Each object is isolated: one failing object no longer kills the whole
  // job or hides the results of objects that already succeeded.
  for (const [objectName, { orgId, records }] of Object.entries(dataset)) {
    try {
      const result = await ingestObject(objectName, orgId, records, dateStr);
      summary.push(result);
    } catch (err) {
      summary.push({
        object: objectName,
        rows: 0,
        status: "failed",
        error: err.message,
      });
    }
  }

  const failedCount = summary.filter((s) => s.status === "failed").length;
  const overallStatus =
    failedCount === 0
      ? "success"
      : failedCount === summary.length
        ? "failed"
        : "partial";

  return { summary, overallStatus };
}

module.exports = { runIngestion };
