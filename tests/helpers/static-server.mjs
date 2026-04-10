import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import http from "node:http";

const port = Number.parseInt(process.argv[2] || "4173", 10);
const root = resolve(process.cwd());

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon"
};

function safePath(pathname) {
  const normalized = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidate = resolve(join(root, normalized));
  if (!candidate.startsWith(root)) return null;
  return candidate;
}

function fileFromRequest(urlPath) {
  if (urlPath === "/" || urlPath === "") return resolve(root, "index.html");
  return safePath(urlPath.replace(/^\//, ""));
}

function sendNotFound(res) {
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("Not found");
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    let filePath = fileFromRequest(url.pathname);
    if (!filePath) return sendNotFound(res);

    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = resolve(filePath, "index.html");
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      return sendNotFound(res);
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "content-type": contentType });
    createReadStream(filePath).pipe(res);
  } catch {
    sendNotFound(res);
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`[playwright-static-server] http://127.0.0.1:${port}\n`);
});
