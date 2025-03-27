import { useState, useEffect } from 'react';
import { ChakraProvider, Box, VStack, Heading, Text, useToast } from '@chakra-ui/react';
import FileTransfer from './components/FileTransfer';
import { io } from 'socket.io-client';
import PairCode from './components/PairCode';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isPaired, setIsPaired] = useState(false);
  const [partnerId, setPartnerId] = useState<string>('');
  const toast = useToast();
  
  // 根据环境选择服务器地址
  const serverUrl = process.env.NODE_ENV === 'production' 
    ? 'https://chuanshu-1uz6ap4ua-muzis-projects-1557bc4b.vercel.app'
    : 'http://192.168.31.230:3001';

  const socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    path: '/api/socket' // Vercel 环境下的 Socket.IO 路径
  });

  useEffect(() => {
    // 监听连接状态
    socket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    // 监听配对成功
    socket.on('pairSuccess', (partner: string) => {
      console.log('Pairing successful with:', partner);
      setPartnerId(partner);
      setIsPaired(true);
      toast({
        title: '配对成功',
        description: `已与设备 ${partner} 配对`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    });

    // 监听配对失败
    socket.on('pairError', (error: string) => {
      console.error('Pairing error:', error);
      toast({
        title: '配对失败',
        description: error,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('pairSuccess');
      socket.off('pairError');
    };
  }, [socket, toast]);

  const handlePairCodeSubmit = (code: string) => {
    console.log('Submitting pair code:', code);
    socket.emit('verifyPairCode', code);
  };

  return (
    <ChakraProvider>
      <Box minH="100vh" bg="gray.50" py={10}>
        <VStack spacing={8} maxW="container.md" mx="auto" px={4}>
          <Heading>局域网文件传输</Heading>
          <Text color={isConnected ? 'green.500' : 'red.500'}>
            服务器连接状态: {isConnected ? '已连接' : '未连接'}
          </Text>
          {!isPaired ? (
            <PairCode onSubmit={handlePairCodeSubmit} />
          ) : (
            <FileTransfer socket={socket} partnerId={partnerId} />
          )}
        </VStack>
      </Box>
    </ChakraProvider>
  );
}

export default App;