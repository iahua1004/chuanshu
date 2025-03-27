import { Box, Button, Text, Progress, VStack, Input, useToast } from '@chakra-ui/react';
import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

interface FileTransferProps {
  socket: Socket;
  partnerId: string;
}

interface FileInfo {
  name: string;
  size: number;
  type: string;
}

const CHUNK_SIZE = 16384; // 16KB chunks

const FileTransfer = ({ socket, partnerId }: FileTransferProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [isTransferring, setIsTransferring] = useState(false);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const toast = useToast();
  const receivedChunks = useRef<Blob[]>([]);
  const receivedSize = useRef(0);
  const fileInfo = useRef<FileInfo | null>(null);
  const startTime = useRef<number>(0);

  useEffect(() => {
    // 初始化WebRTC连接
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    peerConnection.current = pc;

    // 创建数据通道
    const dc = pc.createDataChannel('fileTransfer');
    dataChannel.current = dc;
    setupDataChannel(dc);

    // 监听ICE候选
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          target: partnerId,
          candidate: event.candidate
        });
      }
    };

    // 监听数据通道
    pc.ondatachannel = (event) => {
      const receiveChannel = event.channel;
      setupDataChannel(receiveChannel);
    };

    // 创建offer
    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      socket.emit('offer', { target: partnerId, offer });
    });

    // 监听WebRTC信令
    socket.on('offer', async ({ from, offer }) => {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { target: from, answer });
    });

    socket.on('answer', async ({ from, answer }) => {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => {
      pc.close();
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
    };
  }, [socket, partnerId]);

  const setupDataChannel = (channel: RTCDataChannel) => {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      toast({
        title: '连接已建立',
        status: 'success',
        duration: 3000,
      });
    };

    channel.onclose = () => {
      toast({
        title: '连接已断开',
        status: 'warning',
        duration: 3000,
      });
    };

    channel.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        // 接收文件信息
        const info = JSON.parse(event.data);
        fileInfo.current = info;
        receivedChunks.current = [];
        receivedSize.current = 0;
        startTime.current = Date.now();
      } else {
        // 接收文件数据
        receivedChunks.current.push(new Blob([event.data]));
        receivedSize.current += event.data.byteLength;

        if (fileInfo.current) {
          const progress = (receivedSize.current / fileInfo.current.size) * 100;
          setProgress(progress);

          const elapsedTime = (Date.now() - startTime.current) / 1000; // 秒
          const speed = receivedSize.current / elapsedTime; // 字节/秒
          setSpeed(speed);

          if (receivedSize.current === fileInfo.current.size) {
            // 文件接收完成
            const blob = new Blob(receivedChunks.current);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileInfo.current.name;
            a.click();
            URL.revokeObjectURL(url);

            toast({
              title: '文件接收完成',
              status: 'success',
              duration: 3000,
            });

            setProgress(0);
            setSpeed(0);
            fileInfo.current = null;
            receivedChunks.current = [];
            receivedSize.current = 0;
          }
        }
      }
    };
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const sendFile = async () => {
    if (!selectedFile || !dataChannel.current || dataChannel.current.readyState !== 'open') {
      return;
    }

    setIsTransferring(true);
    startTime.current = Date.now();

    // 发送文件信息
    const fileInfo = {
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type
    };
    dataChannel.current.send(JSON.stringify(fileInfo));

    // 分片发送文件
    const chunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
    for (let i = 0; i < chunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
      const chunk = await selectedFile.slice(start, end).arrayBuffer();
      
      if (dataChannel.current.readyState === 'open') {
        dataChannel.current.send(chunk);
        const progress = ((i + 1) / chunks) * 100;
        setProgress(progress);

        const elapsedTime = (Date.now() - startTime.current) / 1000; // 秒
        const speed = (start + chunk.byteLength) / elapsedTime; // 字节/秒
        setSpeed(speed);
      } else {
        break;
      }
    }

    setIsTransferring(false);
    setSelectedFile(null);
    setProgress(0);
    setSpeed(0);

    toast({
      title: '文件发送完成',
      status: 'success',
      duration: 3000,
    });
  };

  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(1)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  return (
    <Box p={4} borderWidth="1px" borderRadius="lg">
      <VStack spacing={4} align="stretch">
        <Text fontSize="lg" fontWeight="bold">文件传输</Text>

        <Input
          type="file"
          onChange={handleFileSelect}
          disabled={isTransferring}
        />

        {selectedFile && (
          <VStack spacing={2} align="stretch">
            <Text>已选择: {selectedFile.name}</Text>
            <Text>大小: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</Text>
            <Button
              colorScheme="blue"
              onClick={sendFile}
              isLoading={isTransferring}
              loadingText="发送中"
            >
              发送文件
            </Button>
          </VStack>
        )}

        {(progress > 0 || speed > 0) && (
          <Box>
            <Text mb={2}>传输进度: {progress.toFixed(1)}%</Text>
            <Progress value={progress} size="sm" colorScheme="blue" mb={2} />
            <Text>传输速度: {formatSpeed(speed)}</Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default FileTransfer;