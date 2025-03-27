import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// 添加 CORS 中间件
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// 存储配对码
const pairCodes = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  const deviceId = uuidv4();

  // 生成配对码
  socket.on('generatePairCode', () => {
    const pairCode = Math.floor(1000 + Math.random() * 9000).toString();
    pairCodes.set(pairCode, {
      socketId: socket.id,
      timestamp: Date.now()
    });
    console.log('Generated pair code:', pairCode, 'for socket:', socket.id);
    socket.emit('pairCode', pairCode);
  });

  // 验证配对码
  socket.on('verifyPairCode', (code) => {
    console.log('Verifying pair code:', code, 'from socket:', socket.id);
    const pairInfo = pairCodes.get(code);
    if (pairInfo && Date.now() - pairInfo.timestamp < 300000) { // 5分钟内有效
      const targetSocket = io.sockets.sockets.get(pairInfo.socketId);
      
      if (targetSocket) {
        console.log('Pair success between', socket.id, 'and', pairInfo.socketId);
        targetSocket.emit('pairSuccess', socket.id);
        socket.emit('pairSuccess', pairInfo.socketId);
        pairCodes.delete(code);
      } else {
        console.log('Target socket not found');
        socket.emit('pairError', '目标设备已断开连接');
      }
    } else {
      console.log('Invalid or expired pair code');
      socket.emit('pairError', '配对码无效或已过期');
    }
  });

  // 处理WebRTC信令
  socket.on('offer', ({ target, offer }) => {
    console.log('Forwarding offer from', socket.id, 'to', target);
    io.to(target).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ target, answer }) => {
    console.log('Forwarding answer from', socket.id, 'to', target);
    io.to(target).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ target, candidate }) => {
    console.log('Forwarding ICE candidate from', socket.id, 'to', target);
    io.to(target).emit('ice-candidate', { from: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // 清理该socket相关的配对码
    for (const [code, info] of pairCodes.entries()) {
      if (info.socketId === socket.id) {
        pairCodes.delete(code);
      }
    }
  });
});

app.use(express.static(join(__dirname, 'dist')));

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});