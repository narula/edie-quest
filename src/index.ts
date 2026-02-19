import { Game } from './game';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const game = new Game(canvas);
game.init();
