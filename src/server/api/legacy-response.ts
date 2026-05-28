export type LegacyApiResponse =
  | {
      status: "success";
      data: unknown;
    }
  | {
      status: "error";
      message: string;
    };

export function legacySuccess(data: unknown): LegacyApiResponse {
  return {
    status: "success",
    data: serializeLegacyValue(data),
  };
}

export function legacyError(message: string): LegacyApiResponse {
  return {
    status: "error",
    message,
  };
}

function serializeLegacyValue(value: unknown): unknown {
  if (value instanceof Date) {
    return formatMysqlDateTime(value);
  }

  if (Array.isArray(value)) {
    return value.map(serializeLegacyValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeLegacyValue(item)]),
    );
  }

  return value;
}

function formatMysqlDateTime(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
