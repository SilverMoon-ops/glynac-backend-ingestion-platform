function generateHubSpotData() {
  const timestamp = new Date().toISOString();

  const contacts = Array.from({ length: 35 }, (_, i) => ({
    id: `hs_contact_${1000 + i}`,
    properties: {
      email: `user${i}@example.com`,
      firstname: `ContactFirstName_${i}`,
      lastname: `ContactLastName_${i}`,
      hs_object_id: `${1000 + i}`,
      lastmodifieddate: timestamp,
    },
  }));

  const companies = Array.from({ length: 20 }, (_, i) => ({
    id: `hs_company_${2000 + i}`,
    properties: {
      name: `Enterprise Tech Corp ${i}`,
      domain: `techcorp${i}.com`,
      industry: i % 2 === 0 ? "Software" : "Finance",
      annualrevenue: (i + 1) * 150000,
      hs_object_id: `${2000 + i}`,
      lastmodifieddate: timestamp,
    },
  }));

  const deals = Array.from({ length: 25 }, (_, i) => ({
    id: `hs_deal_${3000 + i}`,
    properties: {
      dealname: `Expansion Deal Phase #${i}`,
      amount: (i + 1) * 12500,
      dealstage: i % 3 === 0 ? "closedwon" : "contractsent",
      pipeline: "default",
      hs_object_id: `${3000 + i}`,
      lastmodifieddate: timestamp,
    },
  }));

  return { contacts, companies, deals };
}

module.exports = { generateHubSpotData };
