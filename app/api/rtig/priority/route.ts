import crypto from "node:crypto";

import {
  RtigValidationError,
  validateRtigXml,
} from "@/lib/rtig-validation";
import { saveRtigPayload } from "@/lib/rtig-storage";

import { extractRtigTcpMessages } from "@/lib/rtig-message-extractor";
import { sendRtigBatchOverTcp } from "@/lib/tcp-forwarder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 1024 * 1024;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xmlAcknowledgement(
  statusCode: number,
  status: "SUCCESS" | "ERROR",
  message: string,
  correlationId: string,
  errorCode?: string,
  extra?: {
    messageCount?: number;
    bytesReceived?: number;
  },
): Response {
  const errorPart = errorCode
    ? `\n  <error_code>${escapeXml(errorCode)}</error_code>`
    : "";

  const countPart =
    typeof extra?.messageCount === "number"
      ? `\n  <message_count>${extra.messageCount}</message_count>`
      : "";

  const bytesPart =
    typeof extra?.bytesReceived === "number"
      ? `\n  <bytes_received>${extra.bytesReceived}</bytes_received>`
      : "";

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<acknowledgement>",
    `  <status>${status}</status>`,
    errorPart,
    `\n  <message>${escapeXml(message)}</message>`,
    `  <correlation_id>${escapeXml(correlationId)}</correlation_id>`,
    countPart,
    bytesPart,
    "\n</acknowledgement>",
  ].join("");

  return new Response(body, {
    status: statusCode,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Correlation-Id": correlationId,
      "Cache-Control": "no-store",
    },
  });
}

function getSourceIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request): Promise<Response> {
  const suppliedCorrelationId =
    request.headers.get("correlation-id")?.trim();

  const correlationId =
    suppliedCorrelationId || crypto.randomUUID();

  try {
    const contentType =
      request.headers.get("content-type")?.toLowerCase() ?? "";

    if (
      !contentType.startsWith("application/xml") &&
      !contentType.startsWith("text/xml")
    ) {
      return xmlAcknowledgement(
        415,
        "ERROR",
        "Content-Type must be application/xml",
        correlationId,
        "UNSUPPORTED_MEDIA_TYPE",
      );
    }

    const xmlBuffer = Buffer.from(await request.arrayBuffer());

    if (xmlBuffer.length === 0) {
      return xmlAcknowledgement(
        400,
        "ERROR",
        "XML payload is empty",
        correlationId,
        "INVALID_PAYLOAD",
      );
    }

    if (xmlBuffer.length > MAX_REQUEST_BYTES) {
      return xmlAcknowledgement(
        413,
        "ERROR",
        "XML payload exceeds the current 1 MB limit",
        correlationId,
        "PAYLOAD_TOO_LARGE",
      );
    }

    let xmlText: string;

    try {
      xmlText = new TextDecoder("utf-8", {
        fatal: true,
      }).decode(xmlBuffer);
    } catch {
      return xmlAcknowledgement(
        400,
        "ERROR",
        "Payload must use valid UTF-8 encoding",
        correlationId,
        "INVALID_ENCODING",
      );
    }

    const metadata = validateRtigXml(xmlText);

    const saved = await saveRtigPayload({
      xmlBuffer,
      correlationId,
      metadata,
      sourceIp: getSourceIp(request),
    });

    const tcpMessages = extractRtigTcpMessages(xmlText);

    if (tcpMessages.length !== metadata.messageCount) {
    throw new Error(
        "Validated rtig_tlp count does not match extracted TCP message count",
    );
    }

    const tcpResult = await sendRtigBatchOverTcp(
    tcpMessages.map((message) => ({
        sequence: message.sequence,
        xml: message.xml,
    })),
    );

    console.info("RTIG payload forwarded", {
        correlationId,
        tcpEnabled: tcpResult.enabled,
        tcpTarget: `${tcpResult.host}:${tcpResult.port}`,
        sentCount: tcpResult.sentCount,
        totalBytes: tcpResult.totalBytes,
        sequences: metadata.sequences,
    });

    console.info("RTIG payload received", {
      correlationId,
      fileName: saved.fileName,
      messageCount: metadata.messageCount,
      bytesReceived: saved.bytesReceived,
      sequences: metadata.sequences,
    });

    return xmlAcknowledgement(
      200,
      "SUCCESS",
      tcpResult.enabled
        ? `Payload received and ${tcpResult.sentCount} RTIG message(s) written to the UTC TCP connection`
        : "Payload received successfully; UTC TCP forwarding is disabled",
      correlationId,
      undefined,
      {
        messageCount: metadata.messageCount,
        bytesReceived: saved.bytesReceived,
      },
    );
  } catch (error) {
    if (error instanceof RtigValidationError) {
      console.warn("RTIG payload rejected", {
        correlationId,
        reason: error.message,
      });

      return xmlAcknowledgement(
        400,
        "ERROR",
        error.message,
        correlationId,
        "INVALID_PAYLOAD",
      );
    }

    console.error("RTIG adapter failure", {
      correlationId,
      error,
    });

    return xmlAcknowledgement(
      500,
      "ERROR",
      "Internal adapter failure",
      correlationId,
      "ADAPTER_FAILURE",
    );
  }
}