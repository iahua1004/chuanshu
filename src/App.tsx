import { ChakraProvider, Container, VStack, Heading } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import PairCode from './components/PairCode';
import FileTransfer from './components/FileTransfer';

// 定义设备接口，用于类型检查
interface Device {
  id: string;      // 设备唯一标识符
  name: string;    // 设备名称
  socketId: string; // Socket.IO 连接ID
}

// 创建 Socket.IO 客户端连接，连接到本地服务器
const socket = io('http://192.168.31.230:3001');

function App() {
  // 状态管理：配对状态、配对码和伙伴ID
  const [isPaired, setIsPaired] = useState(false);
  const [pairCode, setPairCode] = useState('');
  const [partnerId, setPartnerId] = useState('');

  // 使用 useEffect 处理 Socket.IO 事件监听
  useEffect(() => {
    // 请求生成配对码
    socket.emit('generatePairCode');
    // 监听配对码生成事件
    socket.on('pairCode', (code: string) => {
      setPairCode(code);
    });

    // 监听配对成功事件
    socket.on('pairSuccess', (id: string) => {
      setPartnerId(id);
      setIsPaired(true);
    });

    // 清理函数：移除事件监听器
    return () => {
      socket.off('pairCode');
      socket.off('pairSuccess');
    };
  }, []);

  // 处理配对码提交
  const handlePairCodeSubmit = (code: string) => {
    socket.emit('verifyPairCode', code);
  };

  // 渲染应用界面
  return (
    <ChakraProvider>
      <Container maxW="container.md" py={8}>
        <VStack spacing={8} align="stretch">
          <Heading textAlign="center">局域网文件传输</Heading>
          
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