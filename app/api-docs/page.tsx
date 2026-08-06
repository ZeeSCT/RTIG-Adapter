import type { Metadata } from "next";
import RtigSwaggerUi from "./swagger-ui";

export const metadata: Metadata = {
  title: "RTIG Adapter API Documentation",
};

export default function ApiDocsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#ffffff" }}>
      <RtigSwaggerUi />
    </main>
  );
}