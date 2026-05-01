import { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import createHttpError from "http-errors";
import { z } from "zod";
import { roomService, RoomFullError } from "../services/roomService.js";

const createRoomLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Room creation limit reached. Try again later." },
});

const roomRouter = Router();

const CreateRoomSchema = z.object({
  hostName: z.string().min(1).max(64).optional(),
});

roomRouter.post("/", createRoomLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = CreateRoomSchema.parse(req.body);
    const room = await roomService.createRoom(payload);
    res.status(201).json(room);
  } catch (error) {
    next(error);
  }
});

roomRouter.get("/:roomId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const room = await roomService.getRoom(req.params.roomId);
    if (!room) {
      return next(createHttpError(404, "Room not found"));
    }
    res.json(room);
  } catch (error) {
    next(error);
  }
});

const UpdateTabSchema = z.object({
  tab: z.enum(["code", "notes", "whiteboard"]),
});

roomRouter.patch("/:roomId/tab", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tab } = UpdateTabSchema.parse(req.body);
    const room = await roomService.updateActiveTab({ roomId: req.params.roomId, tab });
    if (!room) {
      return next(createHttpError(404, "Room not found"));
    }
    res.json(room);
  } catch (error) {
    next(error);
  }
});

const JoinRoomSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  participantId: z.string().optional(),
});

// Per-IP limiter on join — the global 120/min is too loose for an endpoint
// that writes to Mongo and can be flooded if a room link leaks.
const joinRoomLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many join attempts, please slow down." },
});

roomRouter.post("/:roomId/join", joinRoomLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = JoinRoomSchema.parse(req.body);
    const room = await roomService.joinRoom({ 
      roomId: req.params.roomId, 
      participantName: payload.displayName,
      participantId: payload.participantId
    });
    if (!room) {
      return next(createHttpError(404, "Room not found"));
    }
    res.status(200).json(room);
  } catch (error) {
    if (error instanceof RoomFullError) {
      return next(createHttpError(409, error.message));
    }
    next(error);
  }
});

export { roomRouter };
