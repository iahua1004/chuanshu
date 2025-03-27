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
  
  const serverUrl = process.env.NODE_ENV === 'production' 
    ? 'http://139.155.97.94:3001'
    : 'http://192.168.31.230:3001';

  const socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    path: '/socket.io',
    withCredentials: true
  });

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      socket.emit('generatePairCode');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setIsConnected(false);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    socket.on('pairCode', (code: string) => {
      console.log('Received pair code:', code);
    });

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
      socket.off('connect_error');
      socket.off('disconnect');
      socket.off('pairCode');
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