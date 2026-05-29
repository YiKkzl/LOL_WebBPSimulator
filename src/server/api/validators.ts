export type LegacyPostBody = Record<string, unknown>;

export function getQueryValue(searchParams: URLSearchParams, key: string): string {
  return searchParams.get(key) ?? "";
}

export function isLegacyEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "" || value === 0 || value === false;
}

export function legacyString(value: unknown, fallback = ""): string {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value);
}

export function legacyInt(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function legacyArrayField(value: unknown): string[] | string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  return [];
}

export async function readLegacyPostBody(request: Request): Promise<LegacyPostBody | null> {
  try {
    const data: unknown = await request.json();

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }

    const body = data as LegacyPostBody;
    return Object.keys(body).length > 0 ? body : null;
  } catch {
    return null;
  }
}
