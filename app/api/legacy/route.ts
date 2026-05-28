import { NextResponse } from "next/server";

import { handleLegacyAction } from "@/src/server/api/legacy-actions";
import { readLegacyPostBody } from "@/src/server/api/validators";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = await handleLegacyAction("GET", url.searchParams.get("action") ?? "", url.searchParams);

  return NextResponse.json(response);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = await readLegacyPostBody(request);
  const response = await handleLegacyAction(
    "POST",
    url.searchParams.get("action") ?? "",
    url.searchParams,
    body,
  );

  return NextResponse.json(response);
}
