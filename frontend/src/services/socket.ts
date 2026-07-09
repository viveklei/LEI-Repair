import { io } from 'socket.io-client';
import { BASE_SERVER_URL } from '../utils/urls';

export const socket = io(BASE_SERVER_URL, {
  autoConnect: true,
  reconnection: true
});
