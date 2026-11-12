export class HttpError extends Error {
  constructor(status, detail, code) {
    super(detail);
    this.status = status;
    this.detail = detail;
    this.code = code;
  }
}

export const notFound = (detail = "Not found.") => new HttpError(404, detail);
export const conflict = (detail) => new HttpError(409, detail);
export const invalid = (detail, code) => new HttpError(422, detail, code);

export function readBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(invalid("The upload is too large.", "too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index > 0) out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

export function sendJson(res, status, body, headers = {}) {
  if (status === 204) {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(text);
}

/** Minimal multipart/form-data reader for a single file field. */
export function readMultipartFile(buffer, contentType, field) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? "");
  if (!match) throw invalid("Send the photo as a form upload.", "corrupt");
  const boundary = Buffer.from(`--${match[1] ?? match[2]}`);
  let start = buffer.indexOf(boundary);
  while (start !== -1) {
    const next = buffer.indexOf(boundary, start + boundary.length);
    if (next === -1) break;
    const part = buffer.subarray(start + boundary.length + 2, next - 2);
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd !== -1) {
      const headers = part.subarray(0, headerEnd).toString("utf8");
      if (new RegExp(`name="${field}"`).test(headers)) return part.subarray(headerEnd + 4);
    }
    start = next;
  }
  throw invalid("The photo is empty. Take it again.", "corrupt");
}

export function toCsv(rows, columns) {
  const escape = (value) => {
    if (value === null || value === undefined) return "";
    const text = Array.isArray(value) ? value.join(",") : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [columns.join(","), ...rows.map((row) => columns.map((c) => escape(row[c])).join(","))].join("\n") + "\n";
}
