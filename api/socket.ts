import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

// 存储配对码
const pairCodes = new Map();

export default function handler(req: any, res: any) {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server);
    res.socket.server.io = io;

    io.on('connection', (socket) => {
      const deviceId = uuidv4();

      // 生成配对码
      socket.on('generatePairCode', () => {
        const pairCode = Math.floor(1000 + Math.random() * 9000).toString();
        pairCodes.set(pairCode, {
          socketId: socket.id,
          timestamp: Date.now()
        });
        socket.emit('pairCode', pairCode);
      });

      // 验证配对码
      socket.on('verifyPairCode', (code) => {
        const pairInfo = pairCodes.get(code);
        if (pairInfo && Date.now() - pairInfo.timestamp < 300000) { // 5分钟内有效
          const targetSocket = io.sockets.sockets.get(pairInfo.socketId);
          
          if (targetSocket) {
            targetSocket.emit('pairSuccess', socket.id);
            socket.emit('pairSuccess', pairInfo.socketId);
            pairCodes.delete(code);
          }
        } else {
          socket.emit('pairError', '配对码无效或已过期');
        }
      });

      // 处理WebRTC信令
      socket.on('offer', ({ target, offer }) => {
        io.to(target).emit('offer', { from: socket.id, offer });
      });

      socket.on('answer', ({ target, answer }) => {
        io.to(target).emit('answer', { from: socket.id, answer });
      });

      socket.on('ice-candidate', ({ target, candidate }) => {
        io.to(target).emit('ice-candidate', { from: socket.id, candidate });
      });

      socket.on('disconnect', () => {
        // 清理该socket相关的配对码
        for (const [code, info] of pairCodes.entries()) {
          if (info.socketId === socket.id) {
            pairCodes.delete(code);
          }
        }
      });
    });
  }

  res.end();
} 