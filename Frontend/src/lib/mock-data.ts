export const geopoliticalRows = [
  { destination: "Port of Rotterdam", status: "Stable — normal ops", risk: 22 },
  { destination: "Suez Canal", status: "Congestion advisory", risk: 68 },
  { destination: "Strait of Hormuz", status: "Elevated tensions", risk: 84 },
  { destination: "Port of Singapore", status: "Stable", risk: 18 },
  { destination: "Panama Canal", status: "Drought restrictions", risk: 55 },
  { destination: "Red Sea Corridor", status: "Active disruption", risk: 91 },
  { destination: "Port of Mumbai", status: "Monsoon delays", risk: 41 },
  { destination: "Port of Shanghai", status: "Stable", risk: 25 },
];

export const scenarioRows = [
  {
    probability: 72,
    scenario: "Regional strike halts port operations",
    delays: "2 Weeks",
    costUp: true,
    description:
      "Coordinated labor action across three major terminals leading to full operational halt. Recovery expected within 10-14 days after resolution.",
    risk: "High cascading impact across Northern Europe imports.",
  },
  {
    probability: 45,
    scenario: "Weather disruption on Trans-Atlantic route",
    delays: "3 Days",
    costUp: true,
    description:
      "Severe Atlantic storm system forecast to force rerouting of 40% of scheduled vessels.",
    risk: "Moderate — insurable event with historical playbook.",
  },
  {
    probability: 28,
    scenario: "Fuel price stabilization",
    delays: "10 Hours",
    costUp: false,
    description: "OPEC+ production adjustment expected to ease bunker fuel costs by 6-9%.",
    risk: "Low — favorable to operators with flexible contracts.",
  },
  {
    probability: 61,
    scenario: "New tariff regime imposed",
    delays: "1 Week",
    costUp: true,
    description: "Bilateral tariff escalation on manufactured goods.",
    risk: "High — margin compression for commercial imports.",
  },
  {
    probability: 33,
    scenario: "Alternate rail corridor opens",
    delays: "5 Days",
    costUp: false,
    description: "Northern Corridor rail agreement finalized, offering redundant path.",
    risk: "Low — positive optionality.",
  },
];

export const supplyChainAnalysis = [
  {
    title: "Supply Chain Stability",
    value: "Moderate",
    tone: "warning" as const,
    note: "3 of 8 nodes showing stress indicators",
  },
  {
    title: "Current Bottlenecks",
    value: "Suez transit",
    tone: "danger" as const,
    note: "Avg 6.2 day queue vs 2.1 baseline",
  },
  {
    title: "Recommended Mitigation",
    value: "Cape reroute",
    tone: "primary" as const,
    note: "+11 days, -14% risk exposure",
  },
  {
    title: "Expected Recovery Time",
    value: "18 Days",
    tone: "secondary" as const,
    note: "Based on 12-month scenario avg",
  },
  {
    title: "Inventory Risk",
    value: "Elevated",
    tone: "warning" as const,
    note: "SKU coverage at 22 days",
  },
  {
    title: "Supplier Reliability",
    value: "94.2%",
    tone: "success" as const,
    note: "On-time delivery, trailing 90d",
  },
];

export const routeOptRows = [
  {
    route: "Mumbai → Suez → Rotterdam",
    risk: 78,
    summary: "Primary lane, exposed to Red Sea disruption.",
    cost: "$1.84M",
    time: "22 Days",
    advantages: [
      "Shortest transit distance",
      "Established carrier network",
      "Lowest baseline cost",
    ],
    disadvantages: [
      "High geopolitical exposure",
      "War-risk premiums active",
      "Recent schedule reliability at 61%",
    ],
    alternatives: ["Mumbai → Cape → Rotterdam", "Mumbai → Rail (Northern Corridor) → Rotterdam"],
  },
  {
    route: "Mumbai → Cape → Rotterdam",
    risk: 34,
    summary: "Longer but politically resilient path around the Cape of Good Hope.",
    cost: "$2.11M",
    time: "33 Days",
    advantages: ["Very low security risk", "Predictable schedules", "No canal transit fees"],
    disadvantages: ["+11 day transit", "Higher bunker fuel burn", "Weather exposure off S. Africa"],
    alternatives: ["Split shipment Suez/Cape 30/70"],
  },
  {
    route: "Shanghai → Panama → New York",
    risk: 48,
    summary: "Trans-Pacific with canal draft restrictions.",
    cost: "$2.36M",
    time: "26 Days",
    advantages: ["Direct east-coast delivery", "Mature port infrastructure"],
    disadvantages: ["Panama draft caps", "Booking scarcity"],
    alternatives: ["Shanghai → LA → Rail → NY"],
  },
  {
    route: "Dubai → Air Freight → Frankfurt",
    risk: 15,
    summary: "Premium airfreight for time-critical cargo.",
    cost: "$4.72M",
    time: "2 Days",
    advantages: ["Fastest transit", "Lowest inventory carrying cost"],
    disadvantages: ["3–4x sea cost", "Volume-limited"],
    alternatives: ["Sea-air hybrid via Jebel Ali"],
  },
];

export type Recommendation = "Proceed" | "Caution" | "Wait" | "Use Alternate Route";
export const recommendations: Recommendation[] = [
  "Proceed",
  "Caution",
  "Wait",
  "Use Alternate Route",
];

export const decisionReasons = [
  "Weather disruptions along primary corridor",
  "Border congestion at key crossings",
  "Political unrest reported in transit region",
  "Elevated transportation cost vs benchmark",
];

export const decisionFactors = [
  "Fuel price volatility",
  "Trade restrictions and tariffs",
  "Port capacity utilization",
  "Demand surge in destination market",
  "Customs clearance delays",
];

export const currencies = ["USD", "EUR", "GBP", "INR", "AED", "JPY", "CNY"] as const;

export const procurementUnits = [
  "kg",
  "gram",
  "ton",
  "litre",
  "millilitre",
  "gallon",
  "barrel",
  "piece",
  "packet",
  "container",
] as const;

export const procurementResult = {
  alternateMarkets: ["Vietnam", "Brazil", "South Africa", "Indonesia", "Turkey"],
  alternateSuppliers: [
    "Meridian Global Trading Co.",
    "Northwind Commodities Ltd.",
    "Auroria Supply Partners",
    "Silkline International",
  ],
  previousCost: 128400,
  optimizedCost: 104900,
};
