(function() {
    // --- 1. 基础画布设置 ---
    var canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let cw, ch, isMobile;

    function resizeCanvas() {
        cw = window.innerWidth; 
        ch = window.innerHeight;
        canvas.width = cw; 
        canvas.height = ch;
        isMobile = cw < 768;
        if (typeof getBackgroundState === 'function' && getBackgroundState() === 'RIPPLES') initStars();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // 交互状态
    let pointer = { x: -1000, y: -1000 };
    let lastMoveTime = 0;
    
    function updatePointer(x, y) {
        pointer.x = x; 
        pointer.y = y;
        lastMoveTime = Date.now();
        if (typeof getBackgroundState === 'function' && getBackgroundState() === 'RIPPLES') addRipple(x, y);
    }
    
    window.addEventListener('mousemove', e => updatePointer(e.clientX, e.clientY));
    window.addEventListener('touchmove', e => {
        if(e.touches.length > 0) updatePointer(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    // --- 2. 状态判定 ---
    function getBackgroundState() {
        const isNight = document.body.classList.contains('night');
        
        // 春节日期 (年份: "MM-DD")
        const LUNAR_NEW_YEARS = { 
            2025: "01-29", 2026: "02-17", 2027: "02-06", 2028: "01-26", 2029: "02-13" 
        };
        
        const today = new Date();
        const year = today.getFullYear();
        const dateStr = (today.getMonth() + 1).toString().padStart(2, '0') + "-" + today.getDate().toString().padStart(2, '0');
        
        const isHoliday = (dateStr === "01-01" || dateStr === LUNAR_NEW_YEARS[year]);

        if (!isNight) return 'RAIN';           // 浅色模式 -> 雨帘
        if (isHoliday) return 'FIREWORKS';     // 深色 + 节日 -> 烟花
        return 'RIPPLES';                      // 深色 + 平日 -> 星空涟漪
    }

    // --- 3. 核心特效类 ---
    function random(min, max) { return Math.random() * (max - min) + min; }

    class Firework {
        constructor(sx, sy, tx, ty) {
            this.x = sx; this.y = sy; this.sx = sx; this.sy = sy;
            this.tx = tx; this.ty = ty;
            this.distanceToTarget = Math.hypot(tx - sx, ty - sy);
            this.coordinates = [[this.x, this.y], [this.x, this.y], [this.x, this.y]];
            this.angle = Math.atan2(ty - sy, tx - sx);
            this.speed = 2; 
            this.acceleration = 1.05; 
            this.brightness = random(50, 75);
        }
        update(index, dt) {
            this.coordinates.pop(); 
            this.coordinates.unshift([this.x, this.y]);
            this.speed *= Math.pow(this.acceleration, dt);
            let vx = Math.cos(this.angle) * this.speed;
            let vy = Math.sin(this.angle) * this.speed;
            let distanceTraveled = Math.hypot(this.sx - this.x, this.sy - this.y);
            
            if (distanceTraveled >= this.distanceToTarget) {
                createParticles(this.tx, this.ty);
                fireworks.splice(index, 1);
            } else { 
                this.x += vx * dt; 
                this.y += vy * dt; 
            }
        }
        draw() {
            ctx.beginPath(); 
            ctx.strokeStyle = `hsl(${hue}, 100%, ${this.brightness}%)`;
            ctx.moveTo(this.coordinates[this.coordinates.length - 1][0], this.coordinates[this.coordinates.length - 1][1]);
            ctx.lineTo(this.x, this.y); 
            ctx.stroke();
        }
    }

    class Particle {
        constructor(x, y) {
            this.x = x; 
            this.y = y;
            this.coordinates = [[x,y], [x,y], [x,y], [x,y]];
            this.angle = random(0, Math.PI * 2); 
            
            this.speed = random(8, 20); 
            
            // 【改动点】摩擦力减小，飞得更远
            this.friction = 0.97; 
            
            this.gravity = 1; 
            this.hue = random(hue - 50, hue + 50);
            this.alpha = 1; 
            
            // 【改动点】衰减变慢，存活更久 (拖尾更长)
            this.decay = random(0.022, 0.052); 
        }
        update(index, dt) {
            this.coordinates.pop(); 
            this.coordinates.unshift([this.x, this.y]);
            this.speed *= Math.pow(this.friction, dt);
            this.x += Math.cos(this.angle) * this.speed * dt;
            this.y += (Math.sin(this.angle) * this.speed + this.gravity) * dt;
            this.alpha -= this.decay * dt;
            
            if (this.alpha <= this.decay) particles.splice(index, 1);
        }
        draw() {
            ctx.beginPath(); 
            ctx.strokeStyle = `hsla(${this.hue}, 100%, 60%, ${this.alpha})`;
            // 加粗线条
            ctx.lineWidth = 2;
            ctx.moveTo(this.coordinates[this.coordinates.length-1][0], this.coordinates[this.coordinates.length-1][1]);
            ctx.lineTo(this.x, this.y); 
            ctx.stroke();
            ctx.lineWidth = 1;
        }
    }

// --- 4. 新增：飞溅水珠类 (用于“划碎”效果) ---
    class Splash {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            // 随机向四周炸开
            this.vx = (Math.random() - 0.5) * 10;
            this.vy = (Math.random() - 0.5) * 10;
            this.gravity = 0.5;
            this.life = 1.0; // 存活时间
            this.decay = random(0.03, 0.05); // 消失速度
        }
        update(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.vy += this.gravity * dt; // 重力下坠
            this.life -= this.decay * dt;
        }
        draw() {
            ctx.globalAlpha = this.life;
            ctx.fillStyle = 'rgba(100, 160, 255, 0.8)';
            // 画成小小的水珠
            ctx.beginPath();
            ctx.arc(this.x, this.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }

    // --- 5. 修改：雨滴逻辑 (撞击破碎) ---
    class Drop {
        constructor() { this.reset(true); }
        reset(randomY) {
            this.x = Math.random() * cw; 
            this.y = randomY ? Math.random() * ch : -60;
            this.vy = random(6, 10); 
            this.len = random(35, 60);
        }
        update(dt) {
            this.y += this.vy * dt; 
            
            // 【核心修改：划碎逻辑】
            // 如果雨滴碰到了鼠标附近
            if (Date.now() - lastMoveTime < 200) {
                let dx = this.x - pointer.x;
                let dy = this.y - pointer.y;
                // 判定范围：40px (像一把剑的宽度)
                if (Math.abs(dx) < 40 && Math.abs(dy) < 40) {
                    // 1. 产生飞溅效果 (生成 3-5 个小水珠)
                    let splashCount = Math.floor(random(3, 6));
                    createSplashes(this.x, this.y, splashCount);
                    
                    // 2. 这滴雨“死”了，立刻在顶部重置
                    this.reset(false);
                }
            }
            
            if (this.y > ch) this.reset(false);
        }
        draw() {
            ctx.beginPath(); 
            ctx.strokeStyle = 'rgba(130, 170, 255, 0.35)'; 
            ctx.lineWidth = 1.5;
            ctx.moveTo(this.x, this.y); 
            ctx.lineTo(this.x, this.y + this.len); 
            ctx.stroke();
        }
    }

    // --- 6. 星空逻辑 ---
    let stars = [], ripples = [];
    function initStars() {
        stars = [];
        for(let i=0; i<200; i++) {
            stars.push({ x: Math.random()*cw, y: Math.random()*ch, size: Math.random()*2, alpha: Math.random(), baseAlpha: Math.random() });
        }
    }
    let lastRippleX, lastRippleY;
    function addRipple(x, y) {
        if (!lastRippleX || Math.hypot(x - lastRippleX, y - lastRippleY) > 50) {
            ripples.push({ x: x, y: y, r: 0, life: 1 });
            lastRippleX = x; lastRippleY = y;
        }
    }
    function drawRipples(dt) {
        ctx.fillStyle = '#0a0e14'; 
        ctx.fillRect(0, 0, cw, ch);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        for(let i=ripples.length-1; i>=0; i--) {
            let r = ripples[i]; 
            r.r += 2 * dt; 
            r.life -= 0.008 * dt;
            if(r.life <= 0) ripples.splice(i, 1);
            else {
                ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.stroke();
            }
        }
        stars.forEach(s => {
            let ox = 0, oy = 0;
            ripples.forEach(r => {
                let d = Math.hypot(s.x - r.x, s.y - r.y);
                if (Math.abs(d - r.r) < 50) {
                    let str = (1 - Math.abs(d - r.r)/50) * r.life * 10;
                    let ang = Math.atan2(s.y - r.y, s.x - r.x);
                    ox += Math.cos(ang) * str; oy += Math.sin(ang) * str;
                }
            });
            ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
            ctx.beginPath(); ctx.arc(s.x + ox, s.y + oy, s.size, 0, Math.PI*2); ctx.fill();
            s.alpha = s.baseAlpha + Math.sin(Date.now()/500 + s.x)*0.2;
        });
    }

    // --- 7. 主循环 ---
    let fireworks = [], particles = [], drops = [], splashes = [], hue = 120;
    let lastTime = 0, randomTick = 0, pointerTick = 0;

    function createParticles(x, y) {
        let count = isMobile ? 20 : 50;
        while(count--) particles.push(new Particle(x, y));
    }

    // 创建飞溅水珠
    function createSplashes(x, y, count) {
        while(count--) splashes.push(new Splash(x, y));
    }

    function loop(timestamp) {
        requestAnimationFrame(loop);
        const state = getBackgroundState();
        
        if (!lastTime) lastTime = timestamp;
        const elapsed = timestamp - lastTime;
        lastTime = timestamp;
        let dt = elapsed / (1000/60);
        if (dt > 4) dt = 4;

        if (state === 'FIREWORKS') {
            hue += 0.5 * dt;
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'rgba(10, 14, 20, 0.15)'; 
            ctx.fillRect(0, 0, cw, ch);
            ctx.globalCompositeOperation = 'lighter';
            
            let i = fireworks.length; 
            while(i--) { fireworks[i].draw(); fireworks[i].update(i, dt); }
            let k = particles.length; 
            while(k--) { particles[k].draw(); particles[k].update(k, dt); }
            
            randomTick += elapsed;
            if (randomTick > 800) { 
                fireworks.push(new Firework(random(0, cw), ch, random(0, cw), random(0, ch/2)));
                randomTick = 0;
            }
            if (pointer.x !== -1000 && Date.now() - lastMoveTime < 100) {
                pointerTick += elapsed;
                if (pointerTick > 200) {
                    fireworks.push(new Firework(cw/2, ch, pointer.x, pointer.y));
                    pointerTick = 0;
                }
            }
            
        } else if (state === 'RAIN') {
            // 雨帘模式
            ctx.globalCompositeOperation = 'source-over'; 
            ctx.clearRect(0, 0, cw, ch);
            
            // 补充雨滴
            if (drops.length < (isMobile ? 60 : 120)) drops.push(new Drop());
            
            // 更新雨滴
            drops.forEach(d => { d.update(dt); d.draw(); });

            // 更新飞溅效果 (Splash)
            for (let i = splashes.length - 1; i >= 0; i--) {
                let s = splashes[i];
                s.update(dt);
                s.draw();
                if (s.life <= 0) splashes.splice(i, 1);
            }
            
        } else {
            drawRipples(dt);
        }
    }
    
    initStars();
    loop(0);
})();