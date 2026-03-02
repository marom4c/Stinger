import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  signal,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  template: `
    <!-- Desktop Background Wrapper -->
    <div class="fixed inset-0 flex items-center justify-center bg-gray-900 overflow-hidden" style="background-color: #121D2A; background-image: url('/desktop-bg.png'); background-size: cover; background-position: center;">
      
      <!-- Mobile Game Container (Fixed Aspect Ratio) -->
      <div 
        #gameContainer
        class="game-container relative shadow-2xl overflow-hidden" 
        style="background-color: #121D2A; max-width: 100%; max-height: 100%; aspect-ratio: 9/16; width: auto; height: 100vh;"
      >
        
        <!-- UI Overlay -->
        <div class="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-10 text-white font-bold text-sm md:text-base pointer-events-none drop-shadow-md">
          <div>SKÓRE: {{ score() }}</div>
          <div>ÚROVEŇ: {{ level() }}</div>
          <div>ŽIVOTY: {{ lives() }}</div>
        </div>

        <!-- Game Canvas -->
        <canvas
          #gameCanvas
          class="block touch-none cursor-pointer"
          (mousemove)="onMouseMove($event)"
          (touchmove)="onTouchMove($event)"
          (touchstart)="onTouchStart($event)"
          (click)="onCanvasClick()"
        ></canvas>

        <!-- Screens -->
        @if (gameState() === 'start') {
          <div class="absolute inset-0 flex flex-col items-center justify-center z-20 text-center p-6">
            <div class="bg-white/90 p-8 md:p-12 rounded-3xl shadow-2xl flex flex-col items-center max-w-md border-4" style="border-color: #FFCC00;">
              <img src="/logo.png" alt="STING" class="w-64 mb-6" onerror="this.style.display='none'">
              <p class="text-xl md:text-2xl mb-8 font-bold" style="color: #121D2A;">
                Vyšli STINGERA do světa a posbírej co nejvíce bodů. Padající klíče jsou bonusové body.
              </p>
              <button 
                (click)="startGame()"
                class="px-10 py-4 font-black rounded-full text-2xl transition-transform hover:scale-105 shadow-lg w-full"
                style="background-color: #FFCC00; color: #121D2A;"
              >
                HRÁT
              </button>
            </div>
          </div>
        }

        @if (gameState() === 'ready') {
          <div class="absolute inset-0 flex flex-col items-center justify-center z-20 text-white pointer-events-none" style="background-color: rgba(18, 29, 42, 0.3);">
            <h2 class="text-4xl md:text-5xl font-black mb-4 animate-pulse drop-shadow-lg text-center" style="color: #FFCC00;">PŘIPRAVIT...</h2>
            <p class="text-xl md:text-2xl drop-shadow-md text-center">Klepnutím odstartuj</p>
          </div>
        }

        @if (gameState() === 'gameover') {
          <div class="absolute inset-0 flex flex-col items-center justify-center z-20 text-center p-6">
            <div class="bg-white/90 p-8 md:p-12 rounded-3xl shadow-2xl flex flex-col items-center max-w-md border-4 w-full" style="border-color: #FFCC00;">
              <h1 class="text-3xl md:text-4xl font-black mb-2 tracking-tighter" style="color: #121D2A;">Krásné skóre</h1>
              <p class="text-5xl font-black mb-8 drop-shadow-sm" style="color: #FFCC00;">{{ score() }}</p>
              
              <div class="flex flex-col gap-4 w-full">
                <button 
                  (click)="resetGame()"
                  class="px-6 py-3 font-black rounded-full text-lg transition-transform hover:scale-105 shadow-lg w-full"
                  style="background-color: #FFCC00; color: #121D2A;"
                >
                  HRÁT ZNOVU
                </button>
                <button 
                  (click)="shareScore()"
                  class="px-6 py-3 font-black rounded-full text-lg transition-transform hover:scale-105 shadow-lg w-full flex items-center justify-center gap-2"
                  style="background-color: #121D2A; color: #FFCC00;"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                  POCHLUBIT SE
                </button>
              </div>
            </div>
          </div>
        }

        @if (gameState() === 'levelcomplete') {
          <div class="absolute inset-0 flex flex-col items-center justify-center z-20 text-white" style="background-color: rgba(18, 29, 42, 0.9);">
            <h1 class="text-4xl md:text-5xl font-black text-green-400 mb-4 tracking-tighter text-center">ÚROVEŇ DOKONČENA!</h1>
            <button 
              (click)="nextLevel()"
              class="px-8 py-4 bg-white font-bold rounded-full text-xl md:text-2xl hover:bg-gray-200 transition-colors shadow-lg"
              style="color: #121D2A;"
            >
              DALŠÍ ÚROVEŇ
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class App implements OnInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('gameContainer', { static: true }) containerRef!: ElementRef<HTMLDivElement>;
  
  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number = 0;
  private resizeObserver!: ResizeObserver;
  private isBrowser: boolean;

  // Game State Signals
  gameState = signal<'start' | 'ready' | 'playing' | 'gameover' | 'levelcomplete'>('start');
  score = signal(0);
  lives = signal(3);
  level = signal(1);

  // Logical Game Constants (Internal resolution 1080x1920 for 9:16 aspect ratio)
  private readonly LOGICAL_WIDTH = 1080;
  private readonly LOGICAL_HEIGHT = 1920;
  
  private readonly PADDLE_HEIGHT = 100;
  private readonly PADDLE_WIDTH = 250;
  private readonly BALL_RADIUS = 50;
  private readonly BRICK_ROW_COUNT = 6;
  private readonly BRICK_COLUMN_COUNT = 7;
  private readonly BRICK_PADDING = 15; // Adjusted padding for fixed size
  private readonly BRICK_OFFSET_TOP = 200;
  private readonly BRICK_SIZE = 120;
  private readonly KEYS_PER_LEVEL = 6;
  private readonly KEY_SIZE = 80;
  
  // Game Objects (using logical coordinates)
  private paddle = { x: 0, y: 0, width: this.PADDLE_WIDTH, height: this.PADDLE_HEIGHT };
  private ball = { x: 0, y: 0, dx: 0, dy: 0, radius: this.BALL_RADIUS };
  private bricks: any[][] = [];
  private bonuses: {x: number, y: number, width: number, height: number, active: boolean, dy: number}[] = [];

  // Input State
  private rightPressed = false;
  private leftPressed = false;

  // Colors
  private colors = {
    primary: '#FFCC00', // Stinger Yellow
    secondary: '#121D2A', // Stinger Dark
  };

  // Images
  private images: Record<string, HTMLImageElement> = {};

  // Actual Canvas Dimensions (scaled)
  private scale = 1;

  constructor(
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit() {
    if (!this.isBrowser) return;

    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    
    this.loadImages();
    this.setupResizeObserver();
    this.initBricks();
    this.resetBallAndPaddle();
    setTimeout(() => this.draw(), 100);
  }

  private loadImages() {
    if (!this.isBrowser) return;
    const imgNames = ['stinger', 'logo', 'brick', 'key', 'background'];
    imgNames.forEach(name => {
      const img = new Image();
      img.src = `/${name}.png`;
      this.images[name] = img;
    });
  }

  ngOnDestroy() {
    if (!this.isBrowser) return;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (!this.isBrowser) return;
    if (event.key === 'Right' || event.key === 'ArrowRight') {
      this.rightPressed = true;
    } else if (event.key === 'Left' || event.key === 'ArrowLeft') {
      this.leftPressed = true;
    } else if (event.code === 'Space') {
      this.launchBall();
    }
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyUp(event: KeyboardEvent) {
    if (!this.isBrowser) return;
    if (event.key === 'Right' || event.key === 'ArrowRight') {
      this.rightPressed = false;
    } else if (event.key === 'Left' || event.key === 'ArrowLeft') {
      this.leftPressed = false;
    }
  }

  private setupResizeObserver() {
    if (!this.isBrowser) return;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const container = this.containerRef.nativeElement;
        const rect = container.getBoundingClientRect();
        
        // Set actual canvas size to match container
        this.canvasRef.nativeElement.width = rect.width;
        this.canvasRef.nativeElement.height = rect.height;
        
        // Calculate scale factor from logical to actual
        this.scale = rect.width / this.LOGICAL_WIDTH;
        
        // Context scaling is handled in draw()
        
        if (this.gameState() !== 'playing' && this.gameState() !== 'ready') {
          this.draw();
        }
      }
    });
    
    this.resizeObserver.observe(this.containerRef.nativeElement);
  }

  startGame() {
    if (!this.isBrowser) return;
    this.score.set(0);
    this.lives.set(3);
    this.level.set(1);
    this.bonuses = [];
    this.initBricks();
    this.resetBallAndPaddle();
    this.gameState.set('ready');
    this.gameLoop();
  }

  resetGame() {
    this.startGame();
  }

  nextLevel() {
    if (!this.isBrowser) return;
    this.level.update(l => l + 1);
    this.bonuses = [];
    
    this.initBricks();
    this.resetBallAndPaddle();
    this.gameState.set('ready');
    this.gameLoop();
  }

  launchBall() {
    if (this.gameState() === 'ready') {
      this.gameState.set('playing');
      this.updateBallSpeed();
    }
  }

  onCanvasClick() {
    this.launchBall();
  }

  private initBricks() {
    this.bricks = [];
    
    // Use fixed brick size
    const brickSize = this.BRICK_SIZE;
    
    // Center the grid
    const gridWidth = (brickSize * this.BRICK_COLUMN_COUNT) + (this.BRICK_PADDING * (this.BRICK_COLUMN_COUNT - 1));
    const offsetLeft = (this.LOGICAL_WIDTH - gridWidth) / 2;

    const availableBrickPositions = [];

    for (let c = 0; c < this.BRICK_COLUMN_COUNT; c++) {
      this.bricks[c] = [];
      for (let r = 0; r < this.BRICK_ROW_COUNT; r++) {
        this.bricks[c][r] = { 
          x: offsetLeft + c * (brickSize + this.BRICK_PADDING), 
          y: this.BRICK_OFFSET_TOP + r * (brickSize + this.BRICK_PADDING), 
          size: brickSize, // Use size instead of width/height for circles
          status: 1,
          hasBonus: false
        };
        availableBrickPositions.push({c, r});
      }
    }

    // Assign fixed number of bonuses randomly
    for (let i = 0; i < this.KEYS_PER_LEVEL; i++) {
      if (availableBrickPositions.length === 0) break;
      const idx = Math.floor(Math.random() * availableBrickPositions.length);
      const pos = availableBrickPositions.splice(idx, 1)[0];
      this.bricks[pos.c][pos.r].hasBonus = true;
    }
  }

  private resetBallAndPaddle() {
    this.paddle.x = (this.LOGICAL_WIDTH - this.paddle.width) / 2;
    this.paddle.y = this.LOGICAL_HEIGHT - this.paddle.height - 150; // Higher up for mobile
    
    this.ball.x = this.paddle.x + this.paddle.width / 2;
    this.ball.y = this.paddle.y - this.ball.radius - 2;
    this.ball.dx = 0;
    this.ball.dy = 0;
  }

  private updateBallSpeed() {
    // Each level increases speed by 20%
    const speedMultiplier = 1 + ((this.level() - 1) * 0.2);
    // Base speed is slower (20% of the original fast speed, let's use 6)
    const baseSpeed = 6; 
    const currentSpeed = baseSpeed * speedMultiplier;
    
    this.ball.dx = currentSpeed * (Math.random() > 0.5 ? 1 : -1);
    this.ball.dy = -currentSpeed;
  }

  private gameLoop = () => {
    if (!this.isBrowser || (this.gameState() !== 'playing' && this.gameState() !== 'ready')) return;

    this.update();
    this.draw();

    this.ngZone.runOutsideAngular(() => {
      this.animationFrameId = requestAnimationFrame(this.gameLoop);
    });
  }

  private update() {
    // Keyboard movement
    if (this.rightPressed) {
      this.paddle.x = Math.min(this.paddle.x + 15, this.LOGICAL_WIDTH - this.paddle.width);
    } else if (this.leftPressed) {
      this.paddle.x = Math.max(this.paddle.x - 15, 0);
    }

    if (this.gameState() === 'ready') {
      // Ball sticks to paddle
      this.ball.x = this.paddle.x + this.paddle.width / 2;
      this.ball.y = this.paddle.y - this.ball.radius - 2;
      return; // Skip physics and collisions
    }

    // Move ball
    this.ball.x += this.ball.dx;
    this.ball.y += this.ball.dy;

    // Wall collision (left/right)
    if (this.ball.x + this.ball.dx > this.LOGICAL_WIDTH - this.ball.radius || this.ball.x + this.ball.dx < this.ball.radius) {
      this.ball.dx = -this.ball.dx;
    }
    
    // Wall collision (top)
    if (this.ball.y + this.ball.dy < this.ball.radius) {
      this.ball.dy = -this.ball.dy;
    } 
    // Bottom collision (lose life)
    else if (this.ball.y + this.ball.dy > this.LOGICAL_HEIGHT - this.ball.radius) {
      this.lives.update(l => l - 1);
      if (this.lives() === 0) {
        this.gameState.set('gameover');
      } else {
        this.resetBallAndPaddle();
        this.gameState.set('ready');
      }
    }

    // Paddle collision (Fixed: Only bounce off the top edge)
    // Check if ball is moving down
    if (this.ball.dy > 0) {
      // Check if ball's bottom edge crosses paddle's top edge
      const ballBottom = this.ball.y + this.ball.radius;
      const nextBallBottom = ballBottom + this.ball.dy;
      const paddleTop = this.paddle.y;
      
      if (ballBottom <= paddleTop && nextBallBottom >= paddleTop) {
        // Check horizontal bounds (with slight forgiveness)
        if (this.ball.x > this.paddle.x - this.ball.radius && this.ball.x < this.paddle.x + this.paddle.width + this.ball.radius) {
          // Hit paddle top!
          this.ball.y = paddleTop - this.ball.radius; // Snap to top
          this.ball.dy = -this.ball.dy;
          
          // Add english (spin)
          const hitPoint = this.ball.x - (this.paddle.x + this.paddle.width / 2);
          this.ball.dx = hitPoint * 0.08; // Adjusted for logical resolution
          
          // Ensure minimum vertical speed
          if (Math.abs(this.ball.dy) < 5) {
            this.ball.dy = this.ball.dy > 0 ? 5 : -5;
          }
        }
      }
    }

    // Brick collision (Circular)
    this.collisionDetection();

    // Update bonuses
    this.updateBonuses();
  }

  private updateBonuses() {
    for (let i = this.bonuses.length - 1; i >= 0; i--) {
      const b = this.bonuses[i];
      if (b.active) {
        b.y += b.dy;
        
        // Check collision with paddle
        if (b.y + b.height > this.paddle.y && b.y < this.paddle.y + this.paddle.height &&
            b.x + b.width > this.paddle.x && b.x < this.paddle.x + this.paddle.width) {
          b.active = false;
          this.score.update(s => s + 100);
          
          const currentSpeed = Math.sqrt(this.ball.dx * this.ball.dx + this.ball.dy * this.ball.dy);
          const newSpeed = currentSpeed * 1.02;
          const ratio = newSpeed / currentSpeed;
          this.ball.dx *= ratio;
          this.ball.dy *= ratio;
          
        } else if (b.y > this.LOGICAL_HEIGHT) {
          b.active = false;
        }
      } else {
        this.bonuses.splice(i, 1);
      }
    }
  }

  private collisionDetection() {
    let activeBricks = 0;
    for (let c = 0; c < this.BRICK_COLUMN_COUNT; c++) {
      for (let r = 0; r < this.BRICK_ROW_COUNT; r++) {
        const b = this.bricks[c][r];
        if (b.status === 1) {
          activeBricks++;
          
          // Circle-Circle collision for bricks
          const brickCenterX = b.x + b.size / 2;
          const brickCenterY = b.y + b.size / 2;
          const brickRadius = b.size / 2;
          
          const dx = this.ball.x - brickCenterX;
          const dy = this.ball.y - brickCenterY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < this.ball.radius + brickRadius) {
            // Collision detected!
            
            // Simple bounce logic based on relative position
            if (Math.abs(dx) > Math.abs(dy)) {
              this.ball.dx = -this.ball.dx; // Hit side
            } else {
              this.ball.dy = -this.ball.dy; // Hit top/bottom
            }
            
            b.status = 0;
            this.score.update(s => s + 10);

            if (b.hasBonus) {
              this.bonuses.push({
                x: brickCenterX - (this.KEY_SIZE / 2),
                y: brickCenterY,
                width: this.KEY_SIZE,
                height: this.KEY_SIZE,
                active: true,
                dy: 6 + (this.level() * 1)
              });
            }
          }
        }
      }
    }

    if (activeBricks === 0) {
      this.gameState.set('levelcomplete');
    }
  }

  private draw() {
    if (!this.ctx) return;
    
    // Save context and apply scaling
    this.ctx.save();
    this.ctx.scale(this.scale, this.scale);
    
    // Clear logical canvas area
    this.ctx.clearRect(0, 0, this.LOGICAL_WIDTH, this.LOGICAL_HEIGHT);
    
    // Draw background
    const bgImg = this.images['background'];
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      this.ctx.drawImage(bgImg, 0, 0, this.LOGICAL_WIDTH, this.LOGICAL_HEIGHT);
    } else {
      this.ctx.fillStyle = '#FFF8D6';
      this.ctx.fillRect(0, 0, this.LOGICAL_WIDTH, this.LOGICAL_HEIGHT);
      
      this.ctx.fillStyle = '#FFE066';
      this.ctx.fillRect(100, this.LOGICAL_HEIGHT - 400, 200, 400);
      this.ctx.fillRect(400, this.LOGICAL_HEIGHT - 600, 250, 600);
      this.ctx.fillRect(800, this.LOGICAL_HEIGHT - 300, 150, 300);
      
      // Schematic background text
      this.ctx.fillStyle = 'rgba(0,0,0,0.1)';
      this.ctx.font = 'bold 60px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`POZADÍ (1080x1920)`, this.LOGICAL_WIDTH / 2, this.LOGICAL_HEIGHT / 2);
    }

    this.drawBricks();
    this.drawBonuses();
    this.drawBall();
    this.drawPaddle();
    
    this.ctx.restore();
  }

  private drawBonuses() {
    const keyImg = this.images['key'];
    this.bonuses.forEach(b => {
      if (b.active) {
        if (keyImg && keyImg.complete && keyImg.naturalWidth > 0) {
          this.ctx.drawImage(keyImg, b.x, b.y, b.width, b.height);
        } else {
          // Schematic Key
          this.ctx.fillStyle = '#FF5555';
          this.ctx.fillRect(b.x, b.y, b.width, b.height);
          this.ctx.strokeStyle = '#FFFFFF';
          this.ctx.lineWidth = 4;
          this.ctx.strokeRect(b.x, b.y, b.width, b.height);
          
          this.ctx.fillStyle = '#FFFFFF';
          this.ctx.font = 'bold 24px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText(`KLÍČ`, b.x + b.width/2, b.y + b.height/2 - 15);
          this.ctx.font = 'bold 18px Arial';
          this.ctx.fillText(`(${b.width}x${b.height})`, b.x + b.width/2, b.y + b.height/2 + 15);
        }
      }
    });
  }

  private drawBall() {
    const stingerImg = this.images['stinger'];
    if (stingerImg && stingerImg.complete && stingerImg.naturalWidth > 0) {
      // Draw image centered on ball coordinates
      this.ctx.drawImage(stingerImg, this.ball.x - this.ball.radius, this.ball.y - this.ball.radius, this.ball.radius * 2, this.ball.radius * 2);
    } else {
      // Schematic Ball
      this.ctx.beginPath();
      this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = this.colors.primary;
      this.ctx.fill();
      this.ctx.strokeStyle = this.colors.secondary;
      this.ctx.lineWidth = 4;
      this.ctx.stroke();
      this.ctx.closePath();
      
      this.ctx.fillStyle = this.colors.secondary;
      this.ctx.font = 'bold 18px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('STINGER', this.ball.x, this.ball.y - 10);
      this.ctx.font = 'bold 14px Arial';
      this.ctx.fillText(`(${this.ball.radius * 2}x${this.ball.radius * 2})`, this.ball.x, this.ball.y + 10);
    }
  }

  private drawPaddle() {
    const logoImg = this.images['logo'];
    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
      this.ctx.drawImage(logoImg, this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
    } else {
      // Schematic Paddle
      this.ctx.fillStyle = this.colors.secondary;
      this.ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
      this.ctx.strokeStyle = this.colors.primary;
      this.ctx.lineWidth = 4;
      this.ctx.strokeRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);

      this.ctx.fillStyle = this.colors.primary;
      this.ctx.font = 'bold 24px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(`LOGO (${this.paddle.width}x${this.paddle.height})`, this.paddle.x + this.paddle.width / 2, this.paddle.y + this.paddle.height / 2);
    }
  }

  private drawBricks() {
    const brickImg = this.images['brick'];
    for (let c = 0; c < this.BRICK_COLUMN_COUNT; c++) {
      for (let r = 0; r < this.BRICK_ROW_COUNT; r++) {
        if (this.bricks[c][r].status === 1) {
          const b = this.bricks[c][r];
          
          if (brickImg && brickImg.complete && brickImg.naturalWidth > 0) {
            this.ctx.drawImage(brickImg, b.x, b.y, b.size, b.size);
          } else {
            // Schematic Brick
            const radius = b.size / 2;
            const centerX = b.x + radius;
            const centerY = b.y + radius;
            
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = '#FFD700';
            this.ctx.fill();
            this.ctx.strokeStyle = this.colors.secondary;
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            this.ctx.closePath();
            
            this.ctx.fillStyle = this.colors.secondary;
            this.ctx.font = 'bold 20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(`CIHLA`, centerX, centerY - 15);
            this.ctx.font = 'bold 16px Arial';
            this.ctx.fillText(`(${Math.round(b.size)}x${Math.round(b.size)})`, centerX, centerY + 15);
          }
        }
      }
    }
  }

  // Touch/Mouse Input Handling
  onMouseMove(e: MouseEvent) {
    if (!this.isBrowser || (this.gameState() !== 'playing' && this.gameState() !== 'ready')) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    // Calculate logical X position based on scale
    const relativeX = (e.clientX - rect.left) / this.scale;
    if (relativeX > 0 && relativeX < this.LOGICAL_WIDTH) {
      this.paddle.x = relativeX - this.paddle.width / 2;
      this.paddle.x = Math.max(0, Math.min(this.LOGICAL_WIDTH - this.paddle.width, this.paddle.x));
    }
  }

  onTouchMove(e: TouchEvent) {
    if (!this.isBrowser || (this.gameState() !== 'playing' && this.gameState() !== 'ready')) return;
    e.preventDefault();
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const relativeX = (e.touches[0].clientX - rect.left) / this.scale;
    if (relativeX > 0 && relativeX < this.LOGICAL_WIDTH) {
      this.paddle.x = relativeX - this.paddle.width / 2;
      this.paddle.x = Math.max(0, Math.min(this.LOGICAL_WIDTH - this.paddle.width, this.paddle.x));
    }
  }

  onTouchStart(e: TouchEvent) {
    if (!this.isBrowser || (this.gameState() !== 'playing' && this.gameState() !== 'ready')) return;
    this.launchBall();
  }

  async shareScore() {
    if (!this.isBrowser) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d')!;
    
    // Draw background
    const bgImg = this.images['background'];
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      ctx.drawImage(bgImg, 0, 0, 1080, 1920);
    } else {
      ctx.fillStyle = '#121D2A';
      ctx.fillRect(0, 0, 1080, 1920);
    }
    
    // Draw overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(140, 600, 800, 700, 40);
    } else {
      ctx.rect(140, 600, 800, 700);
    }
    ctx.fill();
    
    // Draw Logo
    const logoImg = this.images['logo'];
    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
      const logoWidth = 500;
      const logoHeight = (logoImg.naturalHeight / logoImg.naturalWidth) * logoWidth;
      ctx.drawImage(logoImg, 540 - logoWidth / 2, 700, logoWidth, logoHeight);
    } else {
      ctx.fillStyle = '#FFCC00';
      ctx.font = 'bold 100px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('STING', 540, 800);
    }
    
    // Draw Score
    ctx.fillStyle = '#121D2A';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Krásné skóre', 540, 1000);
    
    ctx.fillStyle = '#FFCC00';
    ctx.font = 'bold 200px Arial';
    ctx.fillText(this.score().toString(), 540, 1200);
    
    canvas.toBlob(async (blob) => {
      if (blob && navigator.share) {
        const file = new File([blob], 'stinger-skore.png', { type: 'image/png' });
        try {
          await navigator.share({
            title: 'Moje skóre ve hře STINGER',
            text: `Nahrál jsem ${this.score()} bodů ve hře STINGER! Překonáš mě?`,
            files: [file]
          });
        } catch (err) {
          console.log('Sdílení zrušeno nebo selhalo', err);
        }
      } else {
        alert('Sdílení není na tomto zařízení podporováno.');
      }
    });
  }
}


