import http from "http";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import createHttpError, { isHttpError, type HttpError } from "http-errors";

import { env } from "./config/env.js";
import { bootstrapSocket } from "./config/socket.js";
import { roomRouter } from "./routes/roomRoutes.js";
import { logger } from "./lib/logger.js";
import { initDb } from "./config/db.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "512kb" }));

// General API rate limit: 120 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please slow down." },
});

app.use("/api", apiLimiter);

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/rooms", roomRouter);

app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(createHttpError(404, "Route not found"));
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof Error) {
    logger.error(err.message);
  }

  if (isHttpError(err)) {
    const httpErr = err as HttpError;
    return res.status(httpErr.statusCode ?? 500).json({ message: httpErr.message });
  }

  res.status(500).json({ message: "Something went wrong" });
});

const start = async () => {
  try {
    await initDb();
    const server = http.createServer(app);
    bootstrapSocket(server);
    server.listen(env.PORT, () => {
      logger.info(`Server listening on http://localhost:${env.PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
};

void start();
