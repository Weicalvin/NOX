import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";
import { createFile } from "../db";
import { storagePut } from "../storage";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // Media bytes are sent as a raw request so the server can stream them into
  // S3-compatible storage without putting them in the database.
  app.post("/api/files/upload", express.raw({ limit: "1gb", type: () => true }), async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const body = req.body as Buffer;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ message: "檔案內容為空" });
        return;
      }
      if (body.length > 1024 * 1024 * 1024) {
        res.status(413).json({ message: "檔案不可超過 1 GB" });
        return;
      }
      const encodedName = req.header("x-file-name");
      const originalName = encodedName ? decodeURIComponent(encodedName) : "未命名媒體";
      const safeName = originalName.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 180) || "media";
      const mimeType = req.header("x-file-type") || "application/octet-stream";
      const uploaded = await storagePut(`users/${user.id}/media/${safeName}`, body, mimeType);
      const file = await createFile({
        userId: user.id, originalName, mimeType, size: body.length,
        storageKey: uploaded.key, storageUrl: uploaded.url,
      });
      res.status(201).json(file);
    } catch (error) {
      console.error("[Files] Upload failed", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "檔案上傳失敗" });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
