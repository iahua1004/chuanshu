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
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  path: '/socket.io'
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
    console.log('Verifying pair code:', code);
    const pairData = pairCodes.get(code);
    if (pairData && Date.now() - pairData.timestamp < 300000) { // 5分钟有效期
      console.log('Pair code verified for socket:', socket.id);
      socket.emit('pairSuccess', deviceId);
      socket.to(pairData.socketId).emit('pairSuccess', socket.id);
      pairCodes.delete(code);
    } else {
      console.log('Invalid pair code:', code);
      socket.emit('pairError', '无效的配对码或配对码已过期');
    }
  });

  // 处理断开连接
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.use(express.static(join(__dirname, 'dist')));

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// 导出服务器实例
export default server;