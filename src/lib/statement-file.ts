/**
 * Which kind of statement file an upload is, from its name and MIME type. Shared by the import
 * dialog (to reject a wrong file before uploading) and the server (to decide how to read it).
 *
 * Android often reports an empty or generic type (`application/octet-stream`) for files picked
 * from Downloads, Drive or LINE, so the file extension counts as much as the type.
 */
export type StatementFileKind = "pdf" | "sheet" | "image"

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/heic": "image/heic",
  "image/heif": "image/heif",
}
const IMAGE_EXTENSIONS: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
}

const extensionOf = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ""

export function statementFileKind(name: string, type: string): StatementFileKind | null {
  const ext = extensionOf(name)
  const mime = type.toLowerCase()
  if (mime === "application/pdf" || ext === "pdf") return "pdf"
  if (["csv", "xlsx", "xls"].includes(ext) || mime.includes("spreadsheet") || mime.includes("csv") || mime.includes("excel")) return "sheet"
  if (IMAGE_TYPES[mime] || IMAGE_EXTENSIONS[ext]) return "image"
  return null
}

/** The MIME type to send an image to the AI with, from its type or else its extension. */
export function statementImageMime(name: string, type: string): string | null {
  return IMAGE_TYPES[type.toLowerCase()] ?? IMAGE_EXTENSIONS[extensionOf(name)] ?? null
}

/**
 * The file input's `accept` list: MIME types and extensions both, because pickers match one or
 * the other. Android ignores it (see statementAccept): its pickers, and LINE's in-app browser in
 * particular, may open only the photo gallery or grey out PDF and Excel files when the list mixes
 * images with documents.
 */
export const STATEMENT_ACCEPT = [
  "application/pdf", ".pdf",
  "text/csv", ".csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx",
  "application/vnd.ms-excel", ".xls",
  "image/png", "image/jpeg", "image/webp",
].join(",")

/** `accept` for this browser: none on Android (any file can be picked; the kind is checked after picking). */
export function statementAccept(userAgent: string): string | undefined {
  return /android/i.test(userAgent) ? undefined : STATEMENT_ACCEPT
}
