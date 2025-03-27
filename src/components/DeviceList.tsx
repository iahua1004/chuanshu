import { Box, List, ListItem, Button, Text, VStack } from '@chakra-ui/react';

interface Device {
  id: string;
  name: string;
  socketId: string;
}

interface DeviceListProps {
  devices: Device[];
  selectedDevice: Device | null;
  onDeviceSelect: (device: Device) => void;
}

const DeviceList = ({ devices, selectedDevice, onDeviceSelect }: DeviceListProps) => {
  return (
    <Box>
      <Text fontSize="lg" fontWeight="bold" mb={4}>
        可用设备
      </Text>
      {devices.length === 0 ? (
        <Text color="gray.500">当前没有可用设备</Text>
      ) : (
        <List spacing={3}>
          {devices.map((device) => (
            <ListItem
              key={device.id}
              p={3}
              bg={selectedDevice?.id === device.id ? 'blue.50' : 'white'}
              borderRadius="md"
              border="1px"
              borderColor="gray.200"
              _hover={{ bg: 'gray.50' }}
            >
              <VStack align="stretch">
                <Text>{device.name}</Text>
                <Button
                  size="sm"
                  colorScheme={selectedDevice?.id === device.id ? 'blue' : 'gray'}
                  onClick={() => onDeviceSelect(device)}
                >
                  {selectedDevice?.id === device.id ? '已选择' : '选择此设备'}
                </Button>
              </VStack>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default DeviceList;