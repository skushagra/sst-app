import {decode} from 'base-64';
import {
  BleError,
  BleErrorCode,
  BleManager,
  State as BluetoothState,
} from 'react-native-ble-plx';

import {PermissionsAndroid, Platform} from 'react-native';

export const requestBluetoothPermission = async () => {
  if (Platform.OS === 'ios') {
    return true;
  }
  if (
    Platform.OS === 'android' &&
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  ) {
    const apiLevel = parseInt(Platform.Version.toString(), 10);

    if (apiLevel < 31) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    if (
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN &&
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
    ) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      return (
        result['android.permission.BLUETOOTH_CONNECT'] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        result['android.permission.BLUETOOTH_SCAN'] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        result['android.permission.ACCESS_FINE_LOCATION'] ===
          PermissionsAndroid.RESULTS.GRANTED
      );
    }
  }

  return false;
};

const getBluetoothService = () => {
  const manager = new BleManager();
  return {
    destroy: () => {
      manager.destroy();
    },
    connectToDevice: manager.connectToDevice,
    cancelDeviceConnection: manager.cancelDeviceConnection,
    startScan: (serviceUUID, deviceIdentifiers) => {
      return new Promise((resolve, reject) => {
        manager.startDeviceScan(
          [serviceUUID],
          {allowDuplicates: true},
          (error, device) => {
            if (error) {
              manager.stopDeviceScan();
              reject({
                status: 'error',
                message: 'Cannot scan for bluetooth device',
                error: '',
              });
            } else {
              console.log(device.id);
              if (!deviceIdentifiers || deviceIdentifiers.includes(device.id)) {
                manager.stopDeviceScan();
                resolve({
                  device,
                  status: 'success',
                  message: 'Device found',
                });
              }
            }
          },
        );
      });
    },
    connectedDevices: manager.connectedDevices,
    stopScan: () => {
      manager.stopDeviceScan();
    },
    initializeBLE: onBluetoothPowerOff =>
      new Promise((resolve, reject) => {
        const subscription = manager.onStateChange(state => {
          switch (state) {
            case BluetoothState.Unsupported:
              subscription.remove();
              reject({
                status: 'error',
                message: 'BluetoothState Unsupported',
              });
              break;
            case BluetoothState.PoweredOff:
              onBluetoothPowerOff();
              manager.enable().catch((error: BleError) => {
                if (error.errorCode === BleErrorCode.BluetoothUnauthorized) {
                  requestBluetoothPermission();
                }
              });
              break;
            case BluetoothState.Unauthorized:
              requestBluetoothPermission();
              break;
            case BluetoothState.PoweredOn:
              resolve();
              subscription.remove();
              break;
            default:
            // console.error('Unsupported state: ', state);
          }
        }, true);
      }),

    connectAndReadCharacteristic: (device, serviceId, characteristicId) => {
      return new Promise((resolve, reject) => {
        device
          .connect()
          .then(dev => {
            return dev.discoverAllServicesAndCharacteristics();
          })
          .then(dev => {
            dev
              .readCharacteristicForService(serviceId, characteristicId)
              .then(res => {
                const encodedString = res.value;
                const decodedValue = decode(encodedString);

                resolve({
                  status: 'success',
                  message: 'Read characteristic successful',
                  data: decodedValue,
                });
              })
              .catch(error => {
                reject({
                  status: 'error',
                  message: 'Read characteristic failed',
                  error,
                });
              });
          })
          .catch(error => {
            reject({status: 'error', message: 'Connection failed', error});
          });
      });
    },
  };
};

export default getBluetoothService;
