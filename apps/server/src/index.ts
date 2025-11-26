import http from "http";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import createHttpError, { isHttpError, type HttpError } from "http-errors";

import { env } from "./config/env";
import { bootstrapSocket } from "./config/socket";
import { roomRouter } from "./routes/roomRoutes";
import { logger } from "./lib/logger";
import { initDb } from "./config/db";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());

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
