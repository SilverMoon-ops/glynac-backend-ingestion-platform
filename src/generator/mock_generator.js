const OBJECTS = [
  "Accounts",
  "Contacts",
  "Opportunities",
  "Leads",
  "Tasks",
  "Cases",
  "Products",
  "PricebookEntries",
  "Contracts",
  "Assets",
];

function generateMockData(objectName, count = 100) {
  const records = [];
  const orgId = "00D80000000LkoE";

  for (let i = 1; i <= count; i++) {
    records.push({
      id: `${objectName.substring(0, 3).toUpperCase()}_${Date.now()}_${i}`,
      organisation_id: orgId,
      name: `${objectName} Record #${i}`,
      status: i % 2 === 0 ? "Active" : "Pending",
      created_date: new Date().toISOString(),
      value: Math.floor(Math.random() * 50000),
    });
  }
  return { orgId, records };
}

function generateAll() {
  const dataset = {};
  OBJECTS.forEach((obj) => {
    dataset[obj] = generateMockData(obj, 50);
  });
  return dataset;
}

module.exports = { generateAll, OBJECTS };
