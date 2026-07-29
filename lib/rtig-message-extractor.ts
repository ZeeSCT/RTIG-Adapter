export type ExtractedRtigMessage = {
  sequence: string;
  dateTime: string;
  xml: string;
  bytes: number;
};

const RTIG_ELEMENT_PATTERN = /<rtig_tlp\b[\s\S]*?\/>/gi;

function readAttribute(element: string, attribute: string): string {
  const pattern = new RegExp(
    `\\b${attribute}\\s*=\\s*["']([^"']+)["']`,
    "i",
  );

  const match = element.match(pattern);

  if (!match?.[1]) {
    throw new Error(`rtig_tlp is missing '${attribute}'`);
  }

  return match[1];
}

function requireVersion12(element: string): string {
  const version = readAttribute(element, "version");

  if (version !== "1.2") {
    throw new Error(
      `Unsupported RTIG version '${version}'; expected version '1.2'`,
    );
  }

  return element;
}

export function extractRtigTcpMessages(
  fullXml: string,
): ExtractedRtigMessage[] {
  const matches = fullXml.match(RTIG_ELEMENT_PATTERN) ?? [];

  if (matches.length === 0) {
    throw new Error("No rtig_tlp messages were found");
  }

  return matches.map((originalElement) => {
    const sequence = readAttribute(originalElement, "sequence");
    const dateTime = readAttribute(originalElement, "date_time");

    const version12Element = requireVersion12(originalElement);

    const xml = version12Element;

    return {
      sequence,
      dateTime,
      xml,
      bytes: Buffer.byteLength(xml, "utf8"),
    };
  });
}