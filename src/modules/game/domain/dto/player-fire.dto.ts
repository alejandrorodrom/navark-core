export interface PlayerFireDto {
  gameId: number;
  x: number; // Coordenada columna
  y: number; // Coordenada fila
  shotType: 'simple' | 'cross' | 'multi' | 'area' | 'scan' | 'nuclear';
}
