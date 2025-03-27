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
    console.log('Initializing WebRTC connection...');
    // 初始化WebRTC连接
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });
    peerConnection.current = pc;

    // 创建数据通道
    const dc = pc.createDataChannel('fileTransfer', {
      ordered: true,
      maxRetransmits: 3
    });
    dataChannel.current = dc;
    setupDataChannel(dc);

    // 监听ICE候选
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate to partner');
        socket.emit('ice-candidate', {
          target: partnerId,
          candidate: event.candidate
        });
      }
    };

    // 监听ICE连接状态
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected') {
        toast({
          title: 'WebRTC 连接已建立',
          status: 'success',
          duration: 3000,
        });
      } else if (pc.iceConnectionState === 'failed') {
        toast({
          title: 'WebRTC 连接失败',
          status: 'error',
          duration: 3000,
        });
      }
    };

    // 监听数据通道
    pc.ondatachannel = (event) => {
      console.log('Received data channel');
      const receiveChannel = event.channel;
      setupDataChannel(receiveChannel);
    };

    // 创建offer
    pc.createOffer().then(offer => {
      console.log('Created offer');
      pc.setLocalDescription(offer);
      socket.emit('offer', { target: partnerId, offer });
    }).catch(error => {
      console.error('Error creating offer:', error);
      toast({
        title: '创建连接失败',
        status: 'error',
        duration: 3000,
      });
    });

    // 监听offer
    socket.on('offer', ({ offer }) => {
      console.log('Received offer');
      if (peerConnection.current) {
        peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer))
          .then(() => peerConnection.current?.createAnswer())
          .then(answer => {
            if (peerConnection.current) {
              peerConnection.current.setLocalDescription(answer);
              socket.emit('answer', { target: partnerId, answer });
            }
          })
          .catch(error => {
            console.error('Error handling offer:', error);
            toast({
              title: '处理连接请求失败',
              status: 'error',
              duration: 3000,
            });
          });
      }
    });

    // 监听answer
    socket.on('answer', ({ answer }) => {
      console.log('Received answer');
      if (peerConnection.current) {
        peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer))
          .catch(error => {
            console.error('Error setting remote description:', error);
            toast({
              title: '设置远程描述失败',
              status: 'error',
              duration: 3000,
            });
          });
      }
    });

    // 监听ICE候选
    socket.on('ice-candidate', ({ candidate }) => {
      console.log('Received ICE candidate');
      if (peerConnection.current) {
        peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate))
          .catch(error => {
            console.error('Error adding ICE candidate:', error);
          });
      }
    });

    return () => {
      console.log('Cleaning up WebRTC connection');
      pc.close();
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
    };
  }, [socket, partnerId, toast]);

  const setupDataChannel = (channel: RTCDataChannel) => {
    console.log('Setting up data channel:', channel.label);
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      console.log('Data channel opened');
      toast({
        title: '连接已建立',
        status: 'success',
        duration: 3000,
      });
    };

    channel.onclose = () => {
      console.log('Data channel closed');
      toast({
        title: '连接已断开',
        status: 'warning',
        duration: 3000,
      });
    };

    channel.onerror = (error) => {
      console.error('Data channel error:', error);
      toast({
        title: '连接错误',
        status: 'error',
        duration: 3000,
      });
    };

    channel.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        // 接收文件信息
        const info = JSON.parse(event.data);
        console.log('Received file info:', info);
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
            console.log('File received completely');
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
      console.log('Selected file:', file.name, file.size);
      setSelectedFile(file);
    }
  };

  const sendFile = async () => {
    if (!selectedFile || !dataChannel.current || dataChannel.current.readyState !== 'open') {
      console.error('Cannot send file:', {
        hasFile: !!selectedFile,
        hasDataChannel: !!dataChannel.current,
        dataChannelState: dataChannel.current?.readyState
      });
      toast({
        title: '无法发送文件',
        description: '请确保连接已建立',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setIsTransferring(true);
    startTime.current = Date.now();

    try {
      // 发送文件信息
      const fileInfo = {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type
      };
      console.log('Sending file info:', fileInfo);
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

          const elapsedTime = (Date.now() - startTime.current) / 1000;
          const speed = (start + chunk.byteLength) / elapsedTime;
          setSpeed(speed);
        } else {
          console.error('Data channel closed during transfer');
          break;
        }
      }

      toast({
        title: '文件发送完成',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('Error sending file:', error);
      toast({
        title: '发送文件失败',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsTransferring(false);
      setSelectedFile(null);
      setProgress(0);
      setSpeed(0);
    }
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