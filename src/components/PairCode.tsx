import { Box, Input, Button, Text, VStack, HStack, useToast } from '@chakra-ui/react';
import { useState } from 'react';

interface PairCodeProps {
  onSubmit: (code: string) => void;
}

const PairCode = ({ onSubmit }: PairCodeProps) => {
  const [inputCode, setInputCode] = useState('');
  const toast = useToast();

  const handleSubmit = () => {
    if (inputCode.length !== 4) {
      toast({
        title: '配对码格式错误',
        description: '请输入4位数字配对码',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    onSubmit(inputCode);
    setInputCode('');
  };

  return (
    <Box p={4} borderWidth="1px" borderRadius="lg">
      <VStack spacing={4} align="stretch">
        <VStack spacing={3}>
          <Text fontSize="lg" fontWeight="bold">
            输入配对码
          </Text>
          <HStack>
            <Input
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="请输入4位数字配对码"
              maxLength={4}
              pattern="[0-9]*"
              inputMode="numeric"
            />
            <Button colorScheme="blue" onClick={handleSubmit}>
              配对
            </Button>
          </HStack>
        </VStack>
      </VStack>
    </Box>
  );
};

export default PairCode;