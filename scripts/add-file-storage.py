from pathlib import Path

root = Path('/home/ubuntu/nox-offline-player')

schema = root / 'drizzle/schema.ts'
s = schema.read_text()
s = s.replace('import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";', 'import { bigint, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";')
s = s.replace('// TODO: Add your tables here', '''\n/** Metadata for user-owned media stored in the S3-compatible object store.\n * File bytes never enter the database; storageKey is the only object reference.\n */\nexport const files = mysqlTable("files", {\n  id: int("id").autoincrement().primaryKey(),\n  userId: int("userId").notNull(),\n  originalName: varchar("originalName", { length: 255 }).notNull(),\n  mimeType: varchar("mimeType", { length: 128 }).notNull(),\n  size: bigint("size", { mode: "number" }).notNull(),\n  storageKey: varchar("storageKey", { length: 512 }).notNull().unique(),\n  storageUrl: varchar("storageUrl", { length: 1024 }).notNull(),\n  createdAt: timestamp("createdAt").defaultNow().notNull(),\n});\n\nexport type StoredFile = typeof files.$inferSelect;\nexport type InsertStoredFile = typeof files.$inferInsert;''')
schema.write_text(s)

db = root / 'server/db.ts'
s = db.read_text()
s = s.replace('import { eq } from "drizzle-orm";', 'import { desc, eq } from "drizzle-orm";')
s = s.replace('import { InsertUser, users } from "../drizzle/schema";', 'import { files, InsertStoredFile, InsertUser, users } from "../drizzle/schema";')
s = s.replace('// TODO: add feature queries here as your schema grows.', '''\nexport async function listFilesByUser(userId: number) {\n  const db = await getDb();\n  if (!db) throw new Error("Database is not available");\n  return db.select().from(files).where(eq(files.userId, userId)).orderBy(desc(files.createdAt));\n}\n\nexport async function createFile(file: InsertStoredFile) {\n  const db = await getDb();\n  if (!db) throw new Error("Database is not available");\n  await db.insert(files).values(file);\n  const rows = await db.select().from(files).where(eq(files.storageKey, file.storageKey)).limit(1);\n  return rows[0];\n}\n\nexport async function deleteFileForUser(id: number, userId: number) {\n  const db = await getDb();\n  if (!db) throw new Error("Database is not available");\n  const rows = await db.select().from(files).where(eq(files.id, id)).limit(1);\n  const file = rows[0];\n  if (!file || file.userId !== userId) return false;\n  await db.delete(files).where(eq(files.id, id));\n  return true;\n}''')
db.write_text(s)

router = root / 'server/routers.ts'
s = router.read_text()
s = s.replace('import { publicProcedure, router } from "./_core/trpc";', 'import { protectedProcedure, publicProcedure, router } from "./_core/trpc";\nimport * as db from "./db";\nimport { TRPCError } from "@trpc/server";\nimport { z } from "zod";')
s = s.replace('  // TODO: add feature routers here, e.g.', '''  files: router({\n    list: protectedProcedure.query(({ ctx }) => db.listFilesByUser(ctx.user.id)),\n    delete: protectedProcedure\n      .input(z.object({ id: z.number().int().positive() }))\n      .mutation(async ({ ctx, input }) => {\n        const deleted = await db.deleteFileForUser(input.id, ctx.user.id);\n        if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "找不到檔案" });\n        return { success: true } as const;\n      }),\n  }),\n  // TODO: add feature routers here, e.g.''')
router.write_text(s)

index = root / 'server/_core/index.ts'
s = index.read_text()
s = s.replace('import { serveStatic, setupVite } from "./vite";', 'import { serveStatic, setupVite } from "./vite";\nimport { sdk } from "./sdk";\nimport { createFile } from "../db";\nimport { storagePut } from "../storage";')
needle = '  registerStorageProxy(app);\n  registerOAuthRoutes(app);'
replacement = '''  registerStorageProxy(app);\n  registerOAuthRoutes(app);\n\n  // Media bytes are sent as a raw request so the server can stream them into\n  // S3-compatible storage without putting them in the database.\n  app.post("/api/files/upload", express.raw({ limit: "1gb", type: () => true }), async (req, res) => {\n    try {\n      const user = await sdk.authenticateRequest(req);\n      const body = req.body as Buffer;\n      if (!Buffer.isBuffer(body) || body.length === 0) {\n        res.status(400).json({ message: "檔案內容為空" });\n        return;\n      }\n      if (body.length > 1024 * 1024 * 1024) {\n        res.status(413).json({ message: "檔案不可超過 1 GB" });\n        return;\n      }\n      const encodedName = req.header("x-file-name");\n      const originalName = encodedName ? decodeURIComponent(encodedName) : "未命名媒體";\n      const safeName = originalName.replace(/[^\\p{L}\\p{N}._-]+/gu, "-").slice(0, 180) || "media";\n      const mimeType = req.header("x-file-type") || "application/octet-stream";\n      const uploaded = await storagePut(`users/${user.id}/media/${safeName}`, body, mimeType);\n      const file = await createFile({\n        userId: user.id, originalName, mimeType, size: body.length,\n        storageKey: uploaded.key, storageUrl: uploaded.url,\n      });\n      res.status(201).json(file);\n    } catch (error) {\n      console.error("[Files] Upload failed", error);\n      res.status(500).json({ message: error instanceof Error ? error.message : "檔案上傳失敗" });\n    }\n  });'''
if needle not in s:
    raise SystemExit('server insertion point not found')
s = s.replace(needle, replacement)
index.write_text(s)
