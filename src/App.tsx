import { ChakraProvider, Container, VStack, Heading, Text } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import PairCode from './components/PairCode';
import FileTransfer from './components/FileTransfer';

// 创建 Socket.IO 客户端连接，使用本机 IP 地址
const socket = io('http://192.168.31.230:3001', {
  transports: ['websocket', 'polling'], // 启用 WebSocket 和轮询
  reconnection: true, // 启用重连
  reconnectionAttempts: 5, // 最大重连次数
  reconnectionDelay: 1000, // 重连延迟
});

function App() {
  // 状态管理：配对状态、配对码和伙伴ID
  const [isPaired, setIsPaired] = useState(false);
  const [pairCode, setPairCode] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [isConnected, setIsConnected] = useState(false); // 添加连接状态

  // 使用 useEffect 处理 Socket.IO 事件监听
  useEffect(() => {
    // 监听连接状态
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
      // 连接成功后请求配对码
      socket.emit('generatePairCode');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    // 监听配对码生成事件
    socket.on('pairCode', (code: string) => {
      console.log('Received pair code:', code);
      setPairCode(code);
    });

    // 监听配对成功事件
    socket.on('pairSuccess', (id: string) => {
      console.log('Pair success with:', id);
      setPartnerId(id);
      setIsPaired(true);
    });

    // 监听配对错误
    socket.on('pairError', (error: string) => {
      console.error('Pair error:', error);
    });

    // 清理函数：移除事件监听器
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('pairCode');
      socket.off('pairSuccess');
      socket.off('pairError');
    };
  }, []);

  // 处理配对码提交
  const handlePairCodeSubmit = (code: string) => {
    console.log('Submitting pair code:', code);
    socket.emit('verifyPairCode', code);
  };

  // 渲染应用界面
  return (
    <ChakraProvider>
      <Container maxW="container.md" py={8}>
        <VStack spacing={8} align="stretch">
          <Heading textAlign="center">局域网文件传输</Heading>
          
          {/* 显示连接状态 */}
          <Text textAlign="center" color={isConnected ? "green.500" : "red.500"}>
            {isConnected ? "已连接到服务器" : "未连接到服务器"}
          </Text>
          
          {/* 根据配对状态显示不同的组件 */}
          {!isPaired ? (
            // 未配对时显示配对码组件
            <PairCode
              code={pairCode}
              onSubmit={handlePairCodeSubmit}
            />
          ) : (
            // 已配对时显示文件传输组件
            <FileTransfer
              socket={socket}
              partnerId={partnerId}
            />
          )}
        </VStack>
      </Container>
    </ChakraProvider>
  );
}

export default App;