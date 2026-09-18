const Minio = require("minio");
const { createClient } = require("@clickhouse/client");
const { generateAll } = require("../generator/mock_generator");

const minioClient = new Minio.Client({
  endPoint: "localhost",
  port: 9000,
  useSSL: false,
  accessKey: "minioadmin",
  secretKey: "minioadminpassword",
});

const clickhouse = createClient({
  url: "http://localhost:8123",
  username: "default",
  password: "",
});

const BUCKET_NAME = "salesforce";

async function setupClickHouseTables(objects) {
  for (const obj of objects) {
    const tableName = `salesforce_${obj.toLowerCase()}`;
    await clickhouse.command({
      query: `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id String,
          organisation_id String,
          name String,
          status String,
          created_date String,
          value UInt32
        ) ENGINE = MergeTree()
        PRIMARY KEY id
      `,
    });
  }
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

  for (const [objectName, { orgId, records }] of Object.entries(dataset)) {
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

    summary.push({
      object: objectName,
      path: `${BUCKET_NAME}/${objectPath}`,
      rows: records.length,
    });
  }
  return summary;
}

module.exports = { runIngestion };
