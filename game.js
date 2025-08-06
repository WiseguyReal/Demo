// Game canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
let gameRunning = false;
let lastTime = 0;

// Physics constants
const GRAVITY = 0.15; // Very light gravity to keep balls bouncing high
const FRICTION = 0.999; // Minimal friction to maintain energy
const BOUNCE_DAMPING = 0.95; // High bounce retention for energetic bounces
const COLLISION_THRESHOLD = 50; // Distance for combat collision (ball to ball)
const WEAPON_COLLISION_THRESHOLD = 30; // Distance for weapon collision
const MIN_VELOCITY = 1.0; // Higher minimum velocity to ensure active bouncing
const GROUND_BOUNCE_BOOST = 1.2; // Extra boost when hitting ground
const WEAPON_LENGTH = 40; // Length of weapon extending from ball

// Particle effects array
let particles = [];
let damageTexts = [];

// Ball class for physics simulation
class Ball {
    constructor(x, y, radius, color, weapon) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = radius;
        this.color = color;
        this.weapon = weapon;
        this.trail = [];
        this.maxTrailLength = 10;
    }

    update(deltaTime) {
        // Update weapon effects
        this.weapon.update(deltaTime);
        
        // Apply gravity
        this.vy += GRAVITY;
        
        // Update position
        this.x += this.vx;
        this.y += this.vy;
        
        // Apply friction
        this.vx *= FRICTION;
        this.vy *= FRICTION;
        
        // Ensure minimum velocity to keep balls moving energetically
        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (currentSpeed < MIN_VELOCITY && currentSpeed > 0.01) {
            const scale = MIN_VELOCITY / currentSpeed;
            this.vx *= scale;
            this.vy *= scale;
        }
        
        // Add energetic random forces more frequently to maintain chaos
        if (Math.random() < 0.01) { // 1% chance per frame for more action
            this.vx += (Math.random() - 0.5) * 1.5;
            this.vy += (Math.random() - 0.5) * 1.5;
        }
        
        // Prevent balls from getting too slow vertically (anti-ground stick)
        if (Math.abs(this.vy) < 0.3 && this.y > canvas.height - this.radius - 10) {
            this.vy = (this.vy < 0 ? -1 : 1) * MIN_VELOCITY;
        }
        
        // Boundary collisions with high-energy bounces
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.vx = -this.vx * BOUNCE_DAMPING;
            // Add energetic random component
            this.vy += (Math.random() - 0.5) * 2;
        }
        if (this.x + this.radius > canvas.width) {
            this.x = canvas.width - this.radius;
            this.vx = -this.vx * BOUNCE_DAMPING;
            this.vy += (Math.random() - 0.5) * 2;
        }
        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.vy = -this.vy * BOUNCE_DAMPING;
            this.vx += (Math.random() - 0.5) * 2;
        }
        // Ground collision with extra bounce boost
        if (this.y + this.radius > canvas.height) {
            this.y = canvas.height - this.radius;
            this.vy = -Math.abs(this.vy) * BOUNCE_DAMPING * GROUND_BOUNCE_BOOST; // Always bounce up with boost
            this.vx += (Math.random() - 0.5) * 2;
            
            // Ensure minimum upward velocity to prevent ground sticking
            if (this.vy > -MIN_VELOCITY) {
                this.vy = -MIN_VELOCITY * 2; // Strong upward bounce
            }
        }
        
        // Update trail
        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > this.maxTrailLength) {
            this.trail.shift();
        }
    }

    draw() {
        // Draw trail
        ctx.strokeStyle = this.color + '40';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 1; i < this.trail.length; i++) {
            ctx.moveTo(this.trail[i-1].x, this.trail[i-1].y);
            ctx.lineTo(this.trail[i].x, this.trail[i].y);
        }
        ctx.stroke();
        
        // Calculate weapon position based on movement direction
        const angle = Math.atan2(this.vy, this.vx);
        const weaponTipX = this.x + Math.cos(angle) * WEAPON_LENGTH;
        const weaponTipY = this.y + Math.sin(angle) * WEAPON_LENGTH;
        
        // Draw weapon
        this.weapon.drawWeapon(ctx, this.x, this.y, weaponTipX, weaponTipY, angle);
        
        // Draw ball
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw weapon icon on ball
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.weapon.icon, this.x, this.y + 5);
        
        // Draw status effects
        this.weapon.drawEffects(ctx, this.x, this.y - this.radius - 20);
    }

    getWeaponTip() {
        const angle = Math.atan2(this.vy, this.vx);
        return {
            x: this.x + Math.cos(angle) * WEAPON_LENGTH,
            y: this.y + Math.sin(angle) * WEAPON_LENGTH,
            angle: angle
        };
    }

    applyForce(fx, fy) {
        this.vx += fx;
        this.vy += fy;
    }
}

// Base weapon class
class Weapon {
    constructor(name, icon, baseDamage, baseSpeed) {
        this.name = name;
        this.icon = icon;
        this.baseDamage = baseDamage;
        this.baseSpeed = baseSpeed;
        this.hp = 100;
        this.maxHp = 100;
    }

    update(deltaTime) {
        // Override in subclasses
    }

    attack(target) {
        // Override in subclasses
        return this.baseDamage;
    }

    takeDamage(damage) {
        this.hp = Math.max(0, this.hp - damage);
        return this.hp <= 0;
    }

    drawEffects(ctx, x, y) {
        // Override in subclasses
    }

    drawWeapon(ctx, ballX, ballY, tipX, tipY, angle) {
        // Override in subclasses
    }

    getCurrentDamage() {
        return this.baseDamage;
    }

    getCurrentSpeed() {
        return this.baseSpeed;
    }
}

// Katana weapon with bleed effect
class Katana extends Weapon {
    constructor() {
        super('Katana', '⚔️', 4, 3.5);
        this.bleedStacks = [];
    }

    update(deltaTime) {
        // Update bleed stacks
        this.bleedStacks = this.bleedStacks.filter(stack => {
            stack.duration -= deltaTime;
            return stack.duration > 0;
        });
    }

    attack(target) {
        const damage = this.getCurrentDamage();
        
        // Add bleed stack to target
        if (target instanceof Hammer) {
            target.addBleed(3000); // 3 seconds in milliseconds
            
            // Create bleed particle effect
            createBleedEffect(target.ball.x, target.ball.y);
        }
        
        return damage;
    }

    addBleed(duration) {
        this.bleedStacks.push({ duration: duration });
    }

    getBleedDamage() {
        return this.bleedStacks.length; // 1 damage per stack per second
    }

    drawWeapon(ctx, ballX, ballY, tipX, tipY, angle) {
        // Draw katana blade
        ctx.strokeStyle = '#C0C0C0'; // Silver blade
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        
        // Main blade
        ctx.beginPath();
        ctx.moveTo(ballX + Math.cos(angle) * 15, ballY + Math.sin(angle) * 15);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        
        // Katana edge highlight
        ctx.strokeStyle = '#E8E8E8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ballX + Math.cos(angle) * 15, ballY + Math.sin(angle) * 15);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        
        // Handle/Guard
        ctx.fillStyle = '#8B4513'; // Brown handle
        ctx.beginPath();
        ctx.arc(ballX + Math.cos(angle) * 10, ballY + Math.sin(angle) * 10, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    drawEffects(ctx, x, y) {
        if (this.bleedStacks.length > 0) {
            ctx.fillStyle = '#8B0000';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`🩸 ${this.bleedStacks.length}`, x, y);
        }
    }
}

// Hammer weapon with momentum rage
class Hammer extends Weapon {
    constructor() {
        super('Hammer', '🔨', 2, 2);
        this.rageStacks = 0;
        this.bleedStacks = [];
        this.lastBleedTick = 0;
    }

    update(deltaTime) {
        // Update bleed damage
        this.lastBleedTick += deltaTime;
        if (this.lastBleedTick >= 1000 && this.bleedStacks.length > 0) { // 1 second
            const bleedDamage = this.bleedStacks.length;
            this.takeDamage(bleedDamage);
            
            // Show damage text
            showDamageText(this.ball.x, this.ball.y, bleedDamage, '#8B0000');
            
            this.lastBleedTick = 0;
        }
        
        // Update bleed stacks
        this.bleedStacks = this.bleedStacks.filter(stack => {
            stack.duration -= deltaTime;
            return stack.duration > 0;
        });
    }

    attack(target) {
        const damage = this.getCurrentDamage();
        
        // Add rage stack
        this.rageStacks++;
        
        // Create rage particle effect
        createRageEffect(this.ball.x, this.ball.y);
        
        return damage;
    }

    addBleed(duration) {
        this.bleedStacks.push({ duration: duration });
    }

    getCurrentDamage() {
        return this.baseDamage + (this.rageStacks * 0.5);
    }

    getCurrentSpeed() {
        return this.baseSpeed + (this.rageStacks * 0.5);
    }

    drawWeapon(ctx, ballX, ballY, tipX, tipY, angle) {
        // Draw hammer handle
        ctx.strokeStyle = '#8B4513'; // Brown handle
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        
        // Handle
        const handleLength = WEAPON_LENGTH * 0.7;
        const handleEndX = ballX + Math.cos(angle) * handleLength;
        const handleEndY = ballY + Math.sin(angle) * handleLength;
        
        ctx.beginPath();
        ctx.moveTo(ballX + Math.cos(angle) * 10, ballY + Math.sin(angle) * 10);
        ctx.lineTo(handleEndX, handleEndY);
        ctx.stroke();
        
        // Hammer head (perpendicular to handle)
        const hammerSize = 15;
        const perpAngle = angle + Math.PI / 2;
        
        ctx.fillStyle = '#696969'; // Dark gray hammer head
        ctx.strokeStyle = '#2F2F2F';
        ctx.lineWidth = 2;
        
        // Main hammer head rectangle
        ctx.save();
        ctx.translate(tipX, tipY);
        ctx.rotate(perpAngle);
        ctx.fillRect(-hammerSize, -hammerSize/3, hammerSize*2, hammerSize*2/3);
        ctx.strokeRect(-hammerSize, -hammerSize/3, hammerSize*2, hammerSize*2/3);
        ctx.restore();
        
        // Hammer head highlight
        ctx.fillStyle = '#A9A9A9';
        ctx.save();
        ctx.translate(tipX, tipY);
        ctx.rotate(perpAngle);
        ctx.fillRect(-hammerSize, -hammerSize/3, hammerSize*2, 3);
        ctx.restore();
    }

    drawEffects(ctx, x, y) {
        let yOffset = 0;
        
        if (this.rageStacks > 0) {
            ctx.fillStyle = '#ff4444';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`💢 ${this.rageStacks}`, x, y + yOffset);
            yOffset += 15;
        }
        
        if (this.bleedStacks.length > 0) {
            ctx.fillStyle = '#8B0000';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`🩸 ${this.bleedStacks.length}`, x, y + yOffset);
        }
    }
}

// Particle effect for visual feedback
class Particle {
    constructor(x, y, vx, vy, color, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = Math.random() * 3 + 2;
    }

    update(deltaTime) {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // Mini gravity
        this.life -= deltaTime;
        
        // Fade out
        const alpha = this.life / this.maxLife;
        this.color = this.color.replace(/[\d\.]+\)$/g, alpha + ')');
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }

    isDead() {
        return this.life <= 0;
    }
}

// Damage text display
class DamageText {
    constructor(x, y, damage, color) {
        this.x = x;
        this.y = y;
        this.damage = damage;
        this.color = color;
        this.life = 1500; // 1.5 seconds
        this.vy = -2;
    }

    update(deltaTime) {
        this.y += this.vy;
        this.life -= deltaTime;
    }

    draw() {
        const alpha = Math.max(0, this.life / 1500);
        ctx.fillStyle = this.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.strokeText(`-${this.damage}`, this.x, this.y);
        ctx.fillText(`-${this.damage}`, this.x, this.y);
    }

    isDead() {
        return this.life <= 0;
    }
}

// Game objects
let katana, hammer, katanaBall, hammerBall;

// Initialize game
function initGame() {
    katana = new Katana();
    hammer = new Hammer();
    
    // Adjust starting positions for smaller arena
    katanaBall = new Ball(150, 200, 25, '#00d4ff', katana);
    hammerBall = new Ball(450, 200, 25, '#ff8c00', hammer);
    
    katana.ball = katanaBall;
    hammer.ball = hammerBall;
    
    // Give initial strong velocities with emphasis on vertical movement
    katanaBall.applyForce((Math.random() - 0.5) * 10, -Math.random() * 8 - 5); // Upward bias
    hammerBall.applyForce((Math.random() - 0.5) * 10, -Math.random() * 8 - 5); // Upward bias
    
    updateUI();
}

// Collision detection and combat
function checkCollisions() {
    // Check weapon-to-weapon collision first
    const katanaWeapon = katanaBall.getWeaponTip();
    const hammerWeapon = hammerBall.getWeaponTip();
    
    // Check weapon tip to opposite ball collision
    const katanaToHammerBall = Math.sqrt(
        (katanaWeapon.x - hammerBall.x) ** 2 + (katanaWeapon.y - hammerBall.y) ** 2
    );
    const hammerToKatanaBall = Math.sqrt(
        (hammerWeapon.x - katanaBall.x) ** 2 + (hammerWeapon.y - katanaBall.y) ** 2
    );
    
    let combatOccurred = false;
    
    // Katana weapon hits Hammer ball
    if (katanaToHammerBall < WEAPON_COLLISION_THRESHOLD) {
        const damage = katana.attack(hammer);
        const isDead = hammer.takeDamage(damage);
        showDamageText(hammerBall.x, hammerBall.y, damage, '#ff0000');
        createHitEffect(hammerWeapon.x, hammerWeapon.y, '#00d4ff');
        createWeaponClash(katanaWeapon.x, katanaWeapon.y);
        
        if (isDead) {
            endGame('Katana');
            return;
        }
        combatOccurred = true;
    }
    
    // Hammer weapon hits Katana ball
    if (hammerToKatanaBall < WEAPON_COLLISION_THRESHOLD) {
        const damage = hammer.attack(katana);
        const isDead = katana.takeDamage(damage);
        showDamageText(katanaBall.x, katanaBall.y, damage, '#ff0000');
        createHitEffect(katanaWeapon.x, katanaWeapon.y, '#ff8c00');
        createWeaponClash(hammerWeapon.x, hammerWeapon.y);
        
        if (isDead) {
            endGame('Hammer');
            return;
        }
        combatOccurred = true;
    }
    
    // Check weapon-to-weapon parry/clash
    const weaponDistance = Math.sqrt(
        (katanaWeapon.x - hammerWeapon.x) ** 2 + (katanaWeapon.y - hammerWeapon.y) ** 2
    );
    
    if (weaponDistance < WEAPON_COLLISION_THRESHOLD / 2) {
        // Weapon clash/parry - create sparks and deflect balls
        createWeaponClash((katanaWeapon.x + hammerWeapon.x) / 2, (katanaWeapon.y + hammerWeapon.y) / 2);
        
        // Deflect balls away from each other
        const clashAngle = Math.atan2(hammerWeapon.y - katanaWeapon.y, hammerWeapon.x - katanaWeapon.x);
        const deflectForce = 6;
        
        katanaBall.applyForce(-Math.cos(clashAngle) * deflectForce, -Math.sin(clashAngle) * deflectForce);
        hammerBall.applyForce(Math.cos(clashAngle) * deflectForce, Math.sin(clashAngle) * deflectForce);
        
        combatOccurred = true;
    }
    
    // Ball-to-ball collision (backup/emergency collision)
    const ballDistance = Math.sqrt((katanaBall.x - hammerBall.x) ** 2 + (katanaBall.y - hammerBall.y) ** 2);
    if (ballDistance < katanaBall.radius + hammerBall.radius + 10) {
        // Separate balls to prevent sticking
        const angle = Math.atan2(hammerBall.y - katanaBall.y, hammerBall.x - katanaBall.x);
        const force = 5;
        
        katanaBall.applyForce(-Math.cos(angle) * force, -Math.sin(angle) * force);
        hammerBall.applyForce(Math.cos(angle) * force, Math.sin(angle) * force);
    }
    
    if (combatOccurred) {
        // Add some randomness to prevent predictable patterns
        katanaBall.applyForce((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
        hammerBall.applyForce((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
        
        updateUI();
    }
}

// Visual effects
function createHitEffect(x, y, color) {
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const speed = Math.random() * 3 + 2;
        particles.push(new Particle(
            x, y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            color.replace('#', 'rgba(').replace(/(..)(..)(..)/, '$1,$2,$3,1)'),
            800
        ));
    }
}

function createBleedEffect(x, y) {
    for (let i = 0; i < 5; i++) {
        particles.push(new Particle(
            x + (Math.random() - 0.5) * 20,
            y + (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 2,
            -Math.random() * 2,
            'rgba(139,0,0,1)',
            1000
        ));
    }
}

function createRageEffect(x, y) {
    for (let i = 0; i < 6; i++) {
        particles.push(new Particle(
            x + (Math.random() - 0.5) * 30,
            y + (Math.random() - 0.5) * 30,
            (Math.random() - 0.5) * 3,
            -Math.random() * 3,
            'rgba(255,68,68,1)',
            600
        ));
    }
}

function createWeaponClash(x, y) {
    // Create sparks for weapon clash
    for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12;
        const speed = Math.random() * 4 + 2;
        particles.push(new Particle(
            x, y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            'rgba(255,255,0,1)', // Yellow sparks
            400
        ));
    }
    
    // Add some white hot sparks
    for (let i = 0; i < 6; i++) {
        particles.push(new Particle(
            x + (Math.random() - 0.5) * 10,
            y + (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 6,
            'rgba(255,255,255,1)',
            300
        ));
    }
}

function showDamageText(x, y, damage, color) {
    damageTexts.push(new DamageText(x, y, damage, color));
}

// Update UI elements
function updateUI() {
    // Katana stats
    document.getElementById('katanaHP').textContent = Math.ceil(katana.hp);
    document.getElementById('katanaDamage').textContent = katana.getCurrentDamage();
    document.getElementById('katanaSpeed').textContent = katana.getCurrentSpeed().toFixed(1);
    document.getElementById('katanaBleed').textContent = hammer.bleedStacks.length;
    document.getElementById('katanaHealth').style.width = (katana.hp / katana.maxHp * 100) + '%';
    
    // Hammer stats
    document.getElementById('hammerHP').textContent = Math.ceil(hammer.hp);
    document.getElementById('hammerDamage').textContent = hammer.getCurrentDamage().toFixed(1);
    document.getElementById('hammerSpeed').textContent = hammer.getCurrentSpeed().toFixed(1);
    document.getElementById('hammerRage').textContent = hammer.rageStacks;
    document.getElementById('hammerHealth').style.width = (hammer.hp / hammer.maxHp * 100) + '%';
}

// Game loop
function gameLoop(currentTime) {
    if (!gameRunning) return;
    
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update game objects
    katanaBall.update(deltaTime);
    hammerBall.update(deltaTime);
    
    // Check collisions
    checkCollisions();
    
    // Update particles
    particles = particles.filter(particle => {
        particle.update(deltaTime);
        particle.draw();
        return !particle.isDead();
    });
    
    // Update damage texts
    damageTexts = damageTexts.filter(text => {
        text.update(deltaTime);
        text.draw();
        return !text.isDead();
    });
    
    // Draw balls
    katanaBall.draw();
    hammerBall.draw();
    
    // Continue game loop
    requestAnimationFrame(gameLoop);
}

// Game control functions
function startBattle() {
    if (!gameRunning) {
        gameRunning = true;
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
    }
}

function pauseBattle() {
    gameRunning = false;
}

function resetBattle() {
    gameRunning = false;
    particles = [];
    damageTexts = [];
    initGame();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    katanaBall.draw();
    hammerBall.draw();
}

function endGame(winner) {
    gameRunning = false;
    
    // Show winner message
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = winner === 'Katana' ? '#00d4ff' : '#ff8c00';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.strokeText(`${winner} Wins!`, canvas.width / 2, canvas.height / 2);
    ctx.fillText(`${winner} Wins!`, canvas.width / 2, canvas.height / 2);
}

// Initialize the game
initGame();

// Draw initial state
katanaBall.draw();
hammerBall.draw();