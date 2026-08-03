import { openApiDocument } from "@/lib/openapi";

export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(openApiDocument, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}