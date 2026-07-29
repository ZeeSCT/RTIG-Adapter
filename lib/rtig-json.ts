export type RtigJsonPayload = {
  version: string;
  traffic_signal: string;
  movement: string;
  trigger_point: string;
  priority: string;
  schedule_deviation: string;
  local_vcc: string;
  operator: string;
  vehicle: string;
  date_time: string;
  sequence: string;
};

const REQUIRED_FIELDS: Array<keyof RtigJsonPayload> = [
  "version",
  "traffic_signal",
  "movement",
  "trigger_point",
  "priority",
  "schedule_deviation",
  "local_vcc",
  "operator",
  "vehicle",
  "date_time",
  "sequence",
];

function escapeXmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("'", "&apos;");
}

export function validateRtigJson(
  input: unknown,
): asserts input is RtigJsonPayload {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Request body must be a JSON object");
  }

  const body = input as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    const value = body[field];

    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Required field '${field}' must be a non-empty string`);
    }
  }
}

export function rtigJsonToXml(payload: RtigJsonPayload): string {
  const attributes = REQUIRED_FIELDS.map((field) => {
    const value = escapeXmlAttribute(payload[field].trim());
    return `${field}="${value}"`;
  }).join(" ");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rtig_tlp',
    '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '  xsi:noNamespaceSchemaLocation="RTIGT031-1%201%20Centrecentre%20TLP%20XML%20Schema.xsd"',
    `  ${attributes}`,
    "/>",
  ].join("\n");
}