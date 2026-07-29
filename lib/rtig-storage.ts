import { promises as fs } from "node:fs";
import path from "node:path";

import type { RtigMetadata } from "./rtig-validation";

const RECEIVED_DIRECTORY =
  process.env.RTIG_RECEIVED_DIRECTORY ??
  "C:\\UTCAdapter\\data\\received";

const AUDIT_DIRECTORY =
  process.env.RTIG_AUDIT_DIRECTORY ??
  "C:\\UTCAdapter\\logs";

function safeFilePart(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
}

export type SaveRtigInput = {
  xmlBuffer: Buffer;
  correlationId: string;
  metadata: RtigMetadata;
  sourceIp?: string;
};

export type SaveRtigResult = {
  fileName: string;
  filePath: string;
  bytesReceived: number;
  receivedAt: string;
};

export async function saveRtigPayload(
  input: SaveRtigInput,
): Promise<SaveRtigResult> {
  await fs.mkdir(RECEIVED_DIRECTORY, { recursive: true });
  await fs.mkdir(AUDIT_DIRECTORY, { recursive: true });

  const receivedAt = new Date().toISOString();
  const timestamp = receivedAt.replace(/[:.]/g, "-");

  const firstSequence =
    input.metadata.sequences[0] ?? "unknown";

  const fileName =
    `${timestamp}` +
    `-seq-${safeFilePart(firstSequence)}` +
    `-${safeFilePart(input.correlationId)}.xml`;

  const filePath = path.join(RECEIVED_DIRECTORY, fileName);

  /*
   * Save the exact Buffer received from the HTTP request.
   * Do not parse and rebuild it before writing.
   */
  await fs.writeFile(filePath, input.xmlBuffer);

  const auditEntry = {
    receivedAt,
    correlationId: input.correlationId,
    sourceIp: input.sourceIp ?? "unknown",
    fileName,
    bytesReceived: input.xmlBuffer.length,
    generated: input.metadata.generated ?? null,
    messageCount: input.metadata.messageCount,
    sequences: input.metadata.sequences,
    dateTimes: input.metadata.dateTimes,
    status: "RECEIVED",
  };

  const auditFile = path.join(
    AUDIT_DIRECTORY,
    `rtig-${receivedAt.slice(0, 10)}.jsonl`,
  );

  await fs.appendFile(
    auditFile,
    `${JSON.stringify(auditEntry)}\n`,
    "utf8",
  );

  return {
    fileName,
    filePath,
    bytesReceived: input.xmlBuffer.length,
    receivedAt,
  };
}