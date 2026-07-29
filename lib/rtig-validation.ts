import { XMLParser, XMLValidator } from "fast-xml-parser";

const REQUIRED_RTIG_ATTRIBUTES = [
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
] as const;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false,
  trimValues: false,
});

export class RtigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RtigValidationError";
  }
}

type ParsedRtigRecord = Record<string, unknown>;

export type RtigMetadata = {
  generated?: string;
  messageCount: number;
  sequences: string[];
  dateTimes: string[];
};

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

export function validateRtigXml(xml: string): RtigMetadata {
  if (!xml.trim()) {
    throw new RtigValidationError("XML payload is empty");
  }

  /*
   * DTD/entity declarations are not required by this contract.
   * Rejecting them reduces XML entity-expansion and external-entity risk.
   */
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml)) {
    throw new RtigValidationError(
      "DOCTYPE and ENTITY declarations are not permitted",
    );
  }

  const syntaxValidation = XMLValidator.validate(xml);

  if (syntaxValidation !== true) {
    const detail =
      typeof syntaxValidation === "object" &&
      syntaxValidation !== null &&
      "err" in syntaxValidation
        ? String(syntaxValidation.err.msg)
        : "Unknown XML syntax error";

    throw new RtigValidationError(`Invalid XML: ${detail}`);
  }

  const document = parser.parse(xml) as Record<string, unknown>;
  const root = document.rtig_priority_samples;

  if (!root || typeof root !== "object" || Array.isArray(root)) {
    throw new RtigValidationError(
      "Root element must be rtig_priority_samples",
    );
  }

  const rootObject = root as Record<string, unknown>;
  const rawRecords = rootObject.rtig_tlp;

  if (!rawRecords) {
    throw new RtigValidationError(
      "At least one rtig_tlp element is required",
    );
  }

  const records: ParsedRtigRecord[] = Array.isArray(rawRecords)
    ? rawRecords
    : [rawRecords];

  const sequences: string[] = [];
  const dateTimes: string[] = [];

  records.forEach((record, index) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new RtigValidationError(
        `rtig_tlp element ${index + 1} is invalid`,
      );
    }

    for (const attribute of REQUIRED_RTIG_ATTRIBUTES) {
      const value = asNonEmptyString(record[attribute]);

      if (!value) {
        throw new RtigValidationError(
          `rtig_tlp element ${index + 1} is missing '${attribute}'`,
        );
      }
    }

    sequences.push(String(record.sequence));
    dateTimes.push(String(record.date_time));
  });

  return {
    generated: asNonEmptyString(rootObject.generated),
    messageCount: records.length,
    sequences,
    dateTimes,
  };
}