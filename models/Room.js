// Room.js
import mongoose from 'mongoose';

const RoomSchema = new mongoose.Schema({
  roomId:   { type: String, unique: true },
  code:     { type: String },
  updatedAt:{ type: Date, default: Date.now },
});

export default mongoose.models.Room || mongoose.model('Room', RoomSchema);
