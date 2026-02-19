export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 400;
export const GROUND_Y = 320;
export const PLAYER_SPEED = 3;
export const SPRITE_SCALE = 0.12;

export enum GameState {
  TITLE = 'TITLE',
  PLAYING = 'PLAYING',
  WIN = 'WIN',
}

export interface Treat {
  x: number;
  y: number;
  collected: boolean;
}
