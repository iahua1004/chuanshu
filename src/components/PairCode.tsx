import { Box, Input, Button, Text, VStack, HStack, useToast } from '@chakra-ui/react';
import { useState } from 'react';

interface PairCodeProps {
  code: string;
  onSubmit: (code: string) => void;
}

const PairCode = ({ code, onSubmit }: PairCodeProps) => {
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
        <Box
          p={4}
          bg="blue.50"
          borderRadius="md"
          textAlign="center"
        >
          <Text fontSize="lg" fontWeight="bold">
            您的配对码
          </Text>
          <Text fontSize="2xl" fontWeight="bold" color="blue.600" mt={2}>
            {code}
          </Text>
        </Box>

        <VStack spacing={3}>
          <Text fontSize="lg" fontWeight="bold">
            输入对方配对码
          </Text>
          <HStack>
            <Input
              placeholder="输入4位配对码"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              maxLength={4}
              pattern="\d*"
              type="number"
            />
            <Button
              colorScheme="blue"
              onClick={handleSubmit}
              isDisabled={inputCode.length !== 4}
            >
              确认
            </Button>
          </HStack>
        </VStack>
      </VStack>
    </Box>
  );
};

export default PairCode;