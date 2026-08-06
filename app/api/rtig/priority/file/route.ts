import { POST as processRawXmlRequest } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 1024 * 1024; // 1 MB

function createXmlErrorResponse(
  status: number,
  errorCode: string,
  message: string,
  correlationId: string,
): Response {
  const escapedMessage = message
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

  const escapedCorrelationId = correlationId
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<acknowledgement>
  <status>ERROR</status>
  <error_code>${errorCode}</error_code>
  <message>${escapedMessage}</message>
  <correlation_id>${escapedCorrelationId}</correlation_id>
  <message_count>0</message_count>
  <bytes_received>0</bytes_received>
</acknowledgement>`;

  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Correlation-Id": correlationId,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const correlationId =
    request.headers.get("Correlation-Id")?.trim() || crypto.randomUUID();

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return createXmlErrorResponse(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Type must be multipart/form-data",
      correlationId,
    );
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return createXmlErrorResponse(
      400,
      "INVALID_FORM_DATA",
      "The multipart form-data request could not be read",
      correlationId,
    );
  }

  const uploadedValue = formData.get("file");

  if (!(uploadedValue instanceof File)) {
    return createXmlErrorResponse(
      400,
      "FILE_REQUIRED",
      'An XML file must be provided using the form field named "file"',
      correlationId,
    );
  }

  if (uploadedValue.size === 0) {
    return createXmlErrorResponse(
      400,
      "EMPTY_FILE",
      "The uploaded XML file is empty",
      correlationId,
    );
  }

  if (uploadedValue.size > MAX_FILE_BYTES) {
    return createXmlErrorResponse(
      413,
      "PAYLOAD_TOO_LARGE",
      "The uploaded XML file exceeds the 1 MB limit",
      correlationId,
    );
  }

  const fileName = uploadedValue.name.trim();
  const extensionIsXml = fileName.toLowerCase().endsWith(".xml");

  const allowedMediaTypes = new Set([
    "",
    "application/xml",
    "text/xml",
    "application/octet-stream",
  ]);

  const mediaTypeIsAllowed = allowedMediaTypes.has(
    uploadedValue.type.toLowerCase(),
  );

  if (!extensionIsXml && !mediaTypeIsAllowed) {
    return createXmlErrorResponse(
      415,
      "UNSUPPORTED_FILE_TYPE",
      "The uploaded file must be an XML file",
      correlationId,
    );
  }

  const xmlBytes = await uploadedValue.arrayBuffer();

  /*
   * Convert the multipart file into the same raw XML request structure
   * already handled by /api/rtig/priority.
   */
  const rawXmlRequest = new Request(request.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/xml",
      "Correlation-Id": correlationId,
      "X-Uploaded-File-Name": fileName,
      "X-Forwarded-For": request.headers.get("X-Forwarded-For") ?? "",
    },
    body: xmlBytes,
  });

  return processRawXmlRequest(rawXmlRequest);
}