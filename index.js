const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cors = require("cors");
const { USER_BOT } = require("./utils/variables");
const dayjs = require("dayjs");

const { addUser, removeUser, getUser, getUsersInRoom } = require("./users");

const router = require("./router");

const app = express();

const server = http.createServer(app);
const io = socketio(server);

app.use(cors());
app.use(router);

io.on("connect", (socket) => {
  socket.on("join", ({ name, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, name, room });

    if (error) return callback(error);

    socket.join(user.room);

    socket.emit("message", {
      user: USER_BOT,
      text: `${user.name}, welcome to room ${user.room}.`,
      time: dayjs().format("HH:mm"),
    });
    socket.broadcast.to(user.room).emit("message", {
      user: USER_BOT,
      text: `${user.name} has joined!`,
      time: dayjs().format("HH:mm"),
    });

    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room),
    });

    callback();
  });

  socket.on("typing", (data) => {
    socket.broadcast.to(data.room).emit("notifyTyping", {
      user: data.name,
      message: data.message,
    });
  });

  socket.on("stopTyping", (data) => {
    socket.broadcast.to(data.room).emit("notifyStopTyping");
  });

  socket.on("sendMessage", (message, callback) => {
    const user = getUser(socket.id);

    io.to(user.room).emit("message", {
      user: user.name,
      text: message,
      time: dayjs().format("HH:mm"),
    });

    callback();
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit("notifyStopTyping", {
        room: user.room,
      });
      io.to(user.room).emit("message", {
        user: USER_BOT,
        text: `${user.name} has left.`,
        time: dayjs().format("HH:mm"),
      });
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server has started on port ${PORT}.`));
