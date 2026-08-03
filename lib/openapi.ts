export const openApiDocument = {
  openapi: "3.0.3",

  info: {
    title: "RTIG REST-to-TCP Adapter API",
    version: "1.0.0",
    description:
      "Receives RTIG priority XML, validates and stores the original payload, and forwards individual rtig_tlp messages over TCP.",
  },

  servers: [
    {
      url: "/",
      description: "Current server",
    },
  ],

  tags: [
    {
      name: "System",
      description: "Application health",
    },
    {
      name: "RTIG",
      description: "RTIG priority XML integration",
    },
  ],

  paths: {
    "/api/health": {
      get: {
        tags: ["System"],
        summary: "Check adapter health",
        operationId: "getHealth",
        responses: {
          "200": {
            description: "Adapter is running",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      example: "ok",
                    },
                    timestamp: {
                      type: "string",
                      format: "date-time",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/api/rtig/priority": {
      post: {
        tags: ["RTIG"],
        summary: "Receive and forward RTIG priority XML",
        description:
          "Accepts one complete rtig_priority_samples XML document. The document may contain one or multiple self-closing rtig_tlp records. The original request bytes are stored, while each rtig_tlp is extracted and forwarded individually over TCP.",
        operationId: "submitRtigPriority",

        parameters: [
          {
            name: "Correlation-Id",
            in: "header",
            required: false,
            description:
              "Optional request tracking identifier. A UUID is generated when omitted.",
            schema: {
              type: "string",
            },
            example: "SWAGGER-TEST-001",
          },
        ],

        requestBody: {
          required: true,
          content: {
            "application/xml": {
              schema: {
                type: "string",
                description:
                  "Complete RTIG XML document containing one or multiple rtig_tlp records.",
              },
              example: `<?xml version="1.0" encoding="UTF-8"?>
<rtig_priority_samples generated="2026-08-03T12:00:00+04:00">
  <rtig_tlp version="1.2" traffic_signal="1111" movement="5" trigger_point="4" priority="1" schedule_deviation="0" operator="MoreBUS" local_vcc="0" vehicle="2718" date_time="2026-08-03T12:00:01+04:00" sequence="2547"/>
  <rtig_tlp version="1.2" traffic_signal="1111" movement="4" trigger_point="3" priority="1" schedule_deviation="5" operator="MoreBUS" local_vcc="0" vehicle="2719" date_time="2026-08-03T12:00:02+04:00" sequence="2548"/>
</rtig_priority_samples>`,
            },

            "text/xml": {
              schema: {
                type: "string",
              },
            },
          },
        },

        responses: {
          "200": {
            description:
              "Payload validated and stored. TCP forwarding either completed or was disabled.",
            headers: {
              "Correlation-Id": {
                description: "Request tracking identifier",
                schema: {
                  type: "string",
                },
              },
            },
            content: {
              "application/xml": {
                schema: {
                  type: "string",
                },
                example: `<?xml version="1.0" encoding="UTF-8"?>
<acknowledgement>
  <status>SUCCESS</status>
  <message>Payload received and 2 RTIG message(s) written to the UTC TCP connection</message>
  <correlation_id>SWAGGER-TEST-001</correlation_id>
  <message_count>2</message_count>
  <bytes_received>850</bytes_received>
</acknowledgement>`,
              },
            },
          },

          "400": {
            description: "Invalid XML, encoding, structure, or required fields",
            content: {
              "application/xml": {
                schema: {
                  type: "string",
                },
                example: `<?xml version="1.0" encoding="UTF-8"?>
<acknowledgement>
  <status>ERROR</status>
  <error_code>INVALID_PAYLOAD</error_code>
  <message>At least one rtig_tlp element is required</message>
  <correlation_id>SWAGGER-TEST-001</correlation_id>
</acknowledgement>`,
              },
            },
          },

          "413": {
            description: "Complete REST payload exceeds 1 MB",
            content: {
              "application/xml": {
                schema: {
                  type: "string",
                },
              },
            },
          },

          "415": {
            description: "Unsupported Content-Type",
            content: {
              "application/xml": {
                schema: {
                  type: "string",
                },
              },
            },
          },

          "500": {
            description:
              "Storage, extraction, TCP connection, TCP timeout, or forwarding failure",
            content: {
              "application/xml": {
                schema: {
                  type: "string",
                },
                example: `<?xml version="1.0" encoding="UTF-8"?>
<acknowledgement>
  <status>ERROR</status>
  <error_code>ADAPTER_FAILURE</error_code>
  <message>Internal adapter failure</message>
  <correlation_id>SWAGGER-TEST-001</correlation_id>
</acknowledgement>`,
              },
            },
          },
        },
      },
    },
  },
} as const;