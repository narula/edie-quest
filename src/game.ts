import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_Y,
  PLAYER_SPEED,
  SPRITE_SCALE,
  GameState,
  Treat,
} from './types';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gameState: GameState = GameState.TITLE;
  private playerX: number = 80;
  private playerDirection: 'left' | 'right' = 'right';
  private edieX: number = 650;
  private treats: Treat[] = [];
  private treatsCollected: number = 0;
  private keys: Set<string> = new Set();
  private animFrame: number = 0;
  private playerMoving: boolean = false;

  private meganSprite!: HTMLCanvasElement | HTMLImageElement;
  private edieSprite!: HTMLCanvasElement | HTMLImageElement;
  private pettingSprite!: HTMLCanvasElement | HTMLImageElement;
  private pettingScale: number = SPRITE_SCALE;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  async init(): Promise<void> {
    // Load sprites in parallel
    const [megan, edie, petting] = await Promise.all([
      this.loadImage('sprites/megan_walking.png'),
      this.loadImage('sprites/edie.png'),
      this.loadImage('sprites/megan_petting_edie.png'),
    ]);
    this.meganSprite = this.trimTransparent(this.removeBackground(megan));
    this.edieSprite = this.trimTransparent(this.removeBackground(edie));
    this.pettingSprite = this.trimTransparent(this.removeBackground(petting));

    // Scale petting sprite so Megan appears the same height as standalone
    this.pettingScale = (this.meganSprite.height / this.pettingSprite.height) * SPRITE_SCALE;

    // Generate 4 treats evenly spaced between player and Edie
    for (let i = 0; i < 4; i++) {
      this.treats.push({
        x: 180 + i * 120,
        y: GROUND_Y - 15,
        collected: false,
      });
    }

    // Set up input
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key);
      if (e.key === 'Enter' && this.gameState === GameState.TITLE) {
        this.gameState = GameState.PLAYING;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key);
    });

    // Start game loop
    this.gameLoop();
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  private removeBackground(img: HTMLImageElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Sample background color from top-left corner pixel
    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];
    const tolerance = 30;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (
        Math.abs(r - bgR) <= tolerance &&
        Math.abs(g - bgG) <= tolerance &&
        Math.abs(b - bgB) <= tolerance
      ) {
        data[i + 3] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  private trimTransparent(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;

    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // If fully transparent, return as-is
    if (maxX < minX || maxY < minY) return canvas;

    const trimmedWidth = maxX - minX + 1;
    const trimmedHeight = maxY - minY + 1;
    const trimmed = document.createElement('canvas');
    trimmed.width = trimmedWidth;
    trimmed.height = trimmedHeight;
    const trimmedCtx = trimmed.getContext('2d')!;
    trimmedCtx.drawImage(canvas, minX, minY, trimmedWidth, trimmedHeight, 0, 0, trimmedWidth, trimmedHeight);
    return trimmed;
  }

  private gameLoop = (): void => {
    this.update();
    this.render();
    requestAnimationFrame(this.gameLoop);
  };

  private update(): void {
    this.animFrame++;
    this.playerMoving = false;

    if (this.gameState !== GameState.PLAYING) return;

    // Movement
    if (this.keys.has('ArrowLeft') || this.keys.has('a') || this.keys.has('A')) {
      this.playerX -= PLAYER_SPEED;
      this.playerDirection = 'left';
      this.playerMoving = true;
    }
    if (this.keys.has('ArrowRight') || this.keys.has('d') || this.keys.has('D')) {
      this.playerX += PLAYER_SPEED;
      this.playerDirection = 'right';
      this.playerMoving = true;
    }

    // Clamp to canvas bounds
    const playerHalfWidth = (this.meganSprite.width * SPRITE_SCALE) / 2;
    this.playerX = Math.max(playerHalfWidth, Math.min(CANVAS_WIDTH - playerHalfWidth, this.playerX));

    // Check treat proximity
    for (const treat of this.treats) {
      if (!treat.collected && Math.abs(this.playerX - treat.x) < 30) {
        treat.collected = true;
        this.treatsCollected++;
      }
    }

    // Check if player reached Edie
    if (Math.abs(this.playerX - this.edieX) < 50) {
      this.gameState = GameState.WIN;
    }
  }

  private render(): void {
    this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    switch (this.gameState) {
      case GameState.TITLE:
        this.renderTitle();
        break;
      case GameState.PLAYING:
        this.renderPlaying();
        break;
      case GameState.WIN:
        this.renderWin();
        break;
    }
  }

  private drawBackground(): void {
    // Sky
    this.ctx.fillStyle = '#87CEEB';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, GROUND_Y);

    // Clouds
    this.drawClouds();

    // Grass
    this.ctx.fillStyle = '#4CAF50';
    this.ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
  }

  private drawClouds(): void {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    const clouds = [
      { x: 100, y: 60 },
      { x: 350, y: 90 },
      { x: 600, y: 50 },
      { x: 750, y: 100 },
    ];
    for (const cloud of clouds) {
      this.ctx.beginPath();
      this.ctx.arc(cloud.x, cloud.y, 25, 0, Math.PI * 2);
      this.ctx.arc(cloud.x + 30, cloud.y - 10, 30, 0, Math.PI * 2);
      this.ctx.arc(cloud.x + 60, cloud.y, 25, 0, Math.PI * 2);
      this.ctx.arc(cloud.x + 30, cloud.y + 5, 20, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawSprite(
    img: HTMLCanvasElement | HTMLImageElement,
    x: number,
    y: number,
    flip: boolean = false,
    scale: number = SPRITE_SCALE
  ): void {
    const w = img.width * scale;
    const h = img.height * scale;

    this.ctx.save();
    if (flip) {
      this.ctx.translate(x, y - h);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(img, -w / 2, 0, w, h);
    } else {
      this.ctx.drawImage(img, x - w / 2, y - h, w, h);
    }
    this.ctx.restore();
  }

  private drawTreat(x: number, y: number): void {
    // Dog bone shape: two circles connected by a rectangle
    this.ctx.fillStyle = '#D2B48C';
    // Left knob
    this.ctx.beginPath();
    this.ctx.arc(x - 8, y, 5, 0, Math.PI * 2);
    this.ctx.fill();
    // Right knob
    this.ctx.beginPath();
    this.ctx.arc(x + 8, y, 5, 0, Math.PI * 2);
    this.ctx.fill();
    // Center bar
    this.ctx.fillRect(x - 8, y - 3, 16, 6);
  }

  private drawEdieAnimated(x: number, y: number): void {
    const img = this.edieSprite;
    const w = img.width * SPRITE_SCALE;
    const h = img.height * SPRITE_SCALE;
    const overlap = 2;

    // Top 65% (static head/chest)
    const topSrcH = Math.floor(img.height * 0.65) + overlap;
    const topH = topSrcH * SPRITE_SCALE;
    this.ctx.drawImage(img, 0, 0, img.width, topSrcH, x - w / 2, y - h, w, topH);

    // Bottom 35% (wiggling rear) — overlap by 2 source pixels
    const bottomSrcY = Math.floor(img.height * 0.65) - overlap;
    const bottomSrcH = img.height - bottomSrcY;
    const bottomH = bottomSrcH * SPRITE_SCALE;
    const pivotX = x;
    const pivotY = y - h + Math.floor(img.height * 0.65) * SPRITE_SCALE;
    const angle = Math.sin(this.animFrame * 0.18) * 0.18;

    this.ctx.save();
    this.ctx.translate(pivotX, pivotY);
    this.ctx.rotate(angle);
    this.ctx.drawImage(
      img, 0, bottomSrcY, img.width, bottomSrcH,
      -w / 2, -overlap * SPRITE_SCALE, w, bottomH
    );
    this.ctx.restore();
  }

  private drawMeganAnimated(x: number, y: number, flip: boolean): void {
    const img = this.meganSprite;
    const w = img.width * SPRITE_SCALE;
    const h = img.height * SPRITE_SCALE;

    if (!this.playerMoving) {
      this.drawSprite(img, x, y, flip);
      return;
    }

    const overlap = 2;
    const topSrcH = Math.floor(img.height * 0.2) + overlap;
    const topH = topSrcH * SPRITE_SCALE;
    const bottomSrcY = Math.floor(img.height * 0.2) - overlap;
    const bottomSrcH = img.height - bottomSrcY;
    const bottomH = bottomSrcH * SPRITE_SCALE;
    const bounce = Math.sin(this.animFrame * 0.3) * 1.5;

    this.ctx.save();
    if (flip) {
      this.ctx.translate(x, y - h);
      this.ctx.scale(-1, 1);
      // Hair (top 20%) with bounce
      this.ctx.drawImage(img, 0, 0, img.width, topSrcH, -w / 2, bounce, w, topH);
      // Body (bottom 80%) static
      this.ctx.drawImage(
        img, 0, bottomSrcY, img.width, bottomSrcH,
        -w / 2, Math.floor(img.height * 0.2) * SPRITE_SCALE - overlap * SPRITE_SCALE, w, bottomH
      );
    } else {
      // Hair (top 20%) with bounce
      this.ctx.drawImage(img, 0, 0, img.width, topSrcH, x - w / 2, y - h + bounce, w, topH);
      // Body (bottom 80%) static
      this.ctx.drawImage(
        img, 0, bottomSrcY, img.width, bottomSrcH,
        x - w / 2, y - h + Math.floor(img.height * 0.2) * SPRITE_SCALE - overlap * SPRITE_SCALE, w, bottomH
      );
    }
    this.ctx.restore();
  }

  private renderTitle(): void {
    this.drawBackground();

    // Title text
    this.ctx.fillStyle = '#333';
    this.ctx.font = 'bold 48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Edie Quest', CANVAS_WIDTH / 2, 160);

    // Subtitle
    this.ctx.font = '20px Arial';
    this.ctx.fillStyle = '#555';
    this.ctx.fillText('Press Enter to Start', CANVAS_WIDTH / 2, 210);
  }

  private renderPlaying(): void {
    this.drawBackground();

    // Draw treats
    for (const treat of this.treats) {
      if (!treat.collected) {
        this.drawTreat(treat.x, treat.y);
      }
    }

    // Draw Edie
    this.drawEdieAnimated(this.edieX, GROUND_Y);

    // Draw Megan
    this.drawMeganAnimated(this.playerX, GROUND_Y, this.playerDirection === 'left');

    // Treat counter
    this.ctx.fillStyle = '#333';
    this.ctx.font = '16px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Treats: ${this.treatsCollected}/4`, 10, 25);
  }

  private renderWin(): void {
    this.drawBackground();

    // Draw petting sprite at Edie's position
    this.drawSprite(this.pettingSprite, this.edieX - 20, GROUND_Y, false, this.pettingScale);

    // Win text
    this.ctx.fillStyle = '#333';
    this.ctx.font = 'bold 48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('You Win!', CANVAS_WIDTH / 2, 100);

    // Birthday message
    this.ctx.font = 'bold 32px Arial';
    this.ctx.fillStyle = '#e05cb5';
    this.ctx.fillText('Happy Birthday Edie!', CANVAS_WIDTH / 2, 145);

    // Treat summary
    this.ctx.font = '20px Arial';
    this.ctx.fillStyle = '#555';
    this.ctx.fillText(
      `Treats collected: ${this.treatsCollected}/4`,
      CANVAS_WIDTH / 2,
      185
    );
  }
}
