export async function GET() {
  return Response.json(
    {
      detail: "Offline mode has been removed from this build."
    },
    {
      status: 410
    }
  );
}
