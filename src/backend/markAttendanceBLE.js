import getBluetoothService, {
  requestBluetoothPermission,
} from '../services/BluetoothService';

const markAttendanceBLE = () => {
  return new Promise(async (resolve, reject) => {
    try {
      const bluetoothService = getBluetoothService();
      await bluetoothService.initializeBLE(() => {});
      const tokenBLE = await getMessageFromBLE(bluetoothService);
      bluetoothService.destroy();

      resolve({
        status: 'success',
        message: 'Marked successfully',
        data: tokenBLE.data,
      });
    } catch (error) {
      reject(error);
    }
  });
};

const getMessageFromBLE = BluetoothService => {
  const serviceUUID = '1821';
  const characteristicUUID = '1822';
  // const deviceIdentifiers = ['7C:70:DB:2D:D4:F7'];
  const deviceIdentifiers = null;

  return new Promise(async (resolve, reject) => {
    const hasPermission = await requestBluetoothPermission();
    if (!hasPermission) {
      reject({
        status: 'error',
        message: 'Permission has not been granted',
        error: '',
      });
    }

    try {
      const scanPromise = BluetoothService.startScan(
        serviceUUID,
        deviceIdentifiers,
      );

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject({
            status: 'error',
            message: 'Scan timed out',
            error: '',
          });
        }, 5000); // Set your desired timeout here (e.g., 5000 milliseconds)
      });

      const {device} = await Promise.race([scanPromise, timeoutPromise]);

      const res = await BluetoothService.connectAndReadCharacteristic(
        device,
        serviceUUID,
        characteristicUUID,
      );

      resolve(res);
    } catch (error) {
      reject(error);
    } finally {
      BluetoothService.stopScan();
    }
  });
};

export default markAttendanceBLE;
