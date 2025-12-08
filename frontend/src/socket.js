import { io } from "socket.io-client";
import API_URL from "./config/api"; 

// Initialize the socket connection
const socket = io(API_URL); 

export default socket;