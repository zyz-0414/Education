import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

export async function readCsvRows<T extends Record<string, string>>(path: string): Promise<T[]> {
  const content = await readFile(path, "utf8");
  return parse(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as T[];
}

export function requiredString(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing required field: ${field}`);
  }
  return normalized;
}

export function optionalString(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function requiredInt(value: string | undefined, field: string): number {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing required integer field: ${field}`);
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid integer field ${field}: ${value}`);
  }

  return parsed;
}

export function optionalInt(value: string | undefined): number | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid integer value: ${value}`);
  }

  return parsed;
}

export function optionalDate(value: string | undefined): Date | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }

  return date;
}

export function optionalJson(value: string | undefined): unknown | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  try {
    return JSON.parse(normalized) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON value: ${normalized}`, { cause: error });
  }
}
