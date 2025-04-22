export class User {
  id: number;
  username: string;
  isGuest: boolean;
  password: string | null;
  nickname: string;
  color: string;
  createdAt: Date;

  constructor(props: {
    id: number;
    username: string;
    isGuest: boolean;
    createdAt: Date;
    password?: string | null;
    nickname: string;
    color: string;
  }) {
    this.id = props.id;
    this.username = props.username;
    this.isGuest = props.isGuest;
    this.createdAt = props.createdAt;
    this.password = props.password ?? null;
    this.nickname = props.nickname;
    this.color = props.color;
  }
}
