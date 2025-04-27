import { Socket } from 'socket.io';

export interface SocketWithUser extends Socket {
  data: {
    userId: number;
    nickname: string;
    isGuest: boolean;
  };
}
