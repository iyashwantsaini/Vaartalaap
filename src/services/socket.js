import io from "socket.io-client";
import { serverurl } from "../config";
export const socketconnect = io(`${serverurl}`);
