export interface PlayerJoinDto {
  gameId: number;
  role: 'player' | 'spectator';
}
