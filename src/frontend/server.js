// Cammelot Frontend Server — 16-bit SNES RPG Style
// Serves the game world visualization + static assets

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3014;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  const url = req.url.split("?")[0];
  
  if (url === "/" || url === "/index.html") {
    const html = await readFile(join(__dirname, "v4.html"), "utf-8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  // Serve static files from /assets/ → ../../assets/
  if (url.startsWith("/assets/")) {
    try {
      const safePath = url.replace(/\.\./g, '').replace(/^\/assets\//, '');
      const filePath = join(__dirname, '..', '..', 'assets', safePath);
      const ext = extname(filePath).toLowerCase();
      let mime = MIME[ext] || 'application/octet-stream';
      const data = await readFile(filePath);
      // Detect actual image format from magic bytes
      if (data[0] === 0xFF && data[1] === 0xD8) mime = 'image/jpeg';
      else if (data[0] === 0x89 && data[1] === 0x50) mime = 'image/png';
      res.writeHead(200, { "Content-Type": mime, "Cache-Control": "public, max-age=3600" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`\n🏰 Cammelot is alive at http://localhost:${PORT}\n`);
});
