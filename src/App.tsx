import { ChakraProvider, Container, VStack, Heading } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import PairCode from './components/PairCode';
import FileTransfer from './components/FileTransfer';

// 创建 Socket.IO 客户端连接，使用相对路径连接到 Vercel API
const socket = io();

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