import { getRecitationsPayload } from "@/lib/server/quran-api";

export async function GET() {
  const payload = await getRecitationsPayload();
  return Response.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"
    }
  });
}
