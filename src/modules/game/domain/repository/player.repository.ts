export abstract class PlayerRepository {
  abstract markPlayerAsDefeated(
    gameId: number,
    playerId: number,
  ): Promise<void>;

  abstract markPlayerAsDefeatedById(id: number): Promise<void>;

  abstract markPlayerAsWinner(playerId: number): Promise<void>;

  abstract markTeamPlayersAsWinners(
    gameId: number,
    team: number | null,
  ): Promise<void>;
}
