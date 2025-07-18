import express from 'express';
import * as http from 'http';
import { Server } from "socket.io";
import ACTIONS from './Actions.js';

import * as dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Room from './models/Room.js';

mongoose.connect(process.env.MONGO_URI).then(() => console.log('MongoDB Atlas connected'))
  .catch(err => {console.error('MongoDB error', err);});



const app = express();

const server = http.createServer(app);

const PORT = process.env.PORT || 5000;


app.get('/health', (req, res) => res.status(200).send('OK'));


const io = new Server(server, {
  transports: ['websocket', 'polling'],
  cors: { origin: '*' },
  pingInterval: 15000,
  pingTimeout: 30000
});

const userSocketMap = {};

function getAllConnectedClients(roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => {
        return {
            socketId,
            username: userSocketMap[socketId],
        };
    });
}


io.on('connection', (socket) => {
    console.log('socket connected', socket.id);


    socket.on(ACTIONS.SAVE_CODE, async ({ roomId, code }) => {
        console.log("request for code save for room - ",roomId)
    try {
      await Room.findOneAndUpdate(
        { roomId },
        { code },
        { upsert: true, new: true }   // create if missing
      );                              // :contentReference[oaicite:7]{index=7}
      socket.emit(ACTIONS.SAVE_SUCCESS);
    } catch (e) {
      socket.emit(ACTIONS.SAVE_ERROR, { message: e.message });
    }
  });



    socket.on(ACTIONS.JOIN, async ({roomId, username}) => {
        // console.log("user joined", roomId, username);
        userSocketMap[socket.id] = username;
        socket.join(roomId);
        const clients = getAllConnectedClients(roomId);
        // console.log(clients);
        clients.forEach( ({socketId}) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id
            });
        })


        const saved = await Room.findOne({ roomId });
        if (saved?.code) {
        io.to(socket.id).emit(ACTIONS.CODE_CHANGE, { code: saved.code });
        }

    });


    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];
        socket.leave();
    });

})

server.listen(PORT, () => { console.log(`Listening on port ${PORT}`) } );