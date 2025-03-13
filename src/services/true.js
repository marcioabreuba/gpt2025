import { processImage } from './servidorImagem.js';
import config from '../config.js';

export const updateQueueTraining = async () => {
  try {
    await processImage(`https://f004.backblazeb2.com/file/temp-file-download/instances/${config.zapi.instanceId}/DB54CE848B1EA346B6C8A6A1C1AA5D24/ktl-GOqtswH9z4EKRV5wdw==.jpeg`)
  } catch (error) {
    throw new Error("");
  }
};