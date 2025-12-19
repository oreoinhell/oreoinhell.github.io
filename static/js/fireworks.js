(function() {
    // --- 1. 基础设置 ---
    var canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '-1'; 
    canvas.style.pointerEvents = 'none'; 
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let cw = window.innerWidth;
    let ch = window.innerHeight;
    
    // 设备检测
    let isMobile = cw < 768;

    // 交互状态
    let pointer = { x: -1000, y: -1000 };
    let lastMoveTime = 0; 

    function resizeCanvas() {
        cw = window.innerWidth;
        ch = window.innerHeight;
        canvas.width = cw;
        canvas.height = ch;
        isMobile = cw < 768;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // 交互监听
    function updatePointer(x, y) {
        pointer.x = x;
        pointer.y = y;
        lastMoveTime = Date.now();
    }
    window.addEventListener('mousemove', e => updatePointer(e.clientX, e.clientY));
    window.addEventListener('touchmove', e => {
        if(e.touches.length > 0) updatePointer(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('mouseout', () => { pointer.x = -1000; pointer.y = -1000; });
    window.addEventListener('touchend', () => { pointer.x = -1000; pointer.y = -1000; });


    // --- 2. 状态管理 ---
    let fireworks = [];
    let particles = [];
    let hue = 120;
    
    // 计时器 (单位改为毫秒，不再依赖帧数)
    let timerTotal = isMobile ? 300 : 200; 
    let randomTick = 0;   
    let pointerTick = 0;  

    let drops = [];
    // 目标数量
    const targetDropCount = isMobile ? 80 : 150; 

    function isDarkMode() {
        const body = document.body;
        const html = document.documentElement;
        if (body.classList.contains('dark-theme') || body.classList.contains('dark') || body.classList.contains('night')) return true;
        if (html.classList.contains('dark-theme') || html.classList.contains('dark') || html.classList.contains('night')) return true;
        if (body.getAttribute('data-theme') === 'dark' || html.getAttribute('data-theme') === 'dark') return true;
        const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const explicitLight = body.classList.contains('light-theme') || body.classList.contains('light') || body.getAttribute('data-theme') === 'light';
        if (systemDark && !explicitLight) return true;
        return false;
    }

    const observer = new MutationObserver(() => {
        if (isDarkMode()) {
            drops = []; 
        } else {
            fireworks = []; 
            particles = [];
            ctx.globalCompositeOperation = 'source-over';
        }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });

    function random(min, max) { return Math.random() * (max - min) + min; }
    function calculateDistance(p1x, p1y, p2x, p2y) { return Math.sqrt(Math.pow(p2x - p1x, 2) + Math.pow(p2y - p1y, 2)); }

    // --- 3. 核心对象 (加入 dt 参数) ---
    // dt = delta time (时间缩放因子)，1.0 代表 60FPS 的标准速度

    class Firework {
        constructor(sx, sy, tx, ty) {
            this.x = sx; this.y = sy; this.sx = sx; this.sy = sy;
            this.tx = tx; this.ty = ty;
            this.distanceToTarget = calculateDistance(sx, sy, tx, ty);
            this.distanceTraveled = 0;
            this.coordinates = [];
            this.coordinateCount = 3;
            while(this.coordinateCount--) { this.coordinates.push([this.x, this.y]); }
            this.angle = Math.atan2(ty - sy, tx - sx);
            this.speed = 2;
            this.acceleration = 1.05;
            this.brightness = random(50, 70);
        }
        update(index, dt) {
            this.coordinates.pop();
            this.coordinates.unshift([this.x, this.y]);
            
            // 速度也要受时间影响，但加速度是乘法，用幂运算校准
            this.speed *= Math.pow(this.acceleration, dt);
            
            let vx = Math.cos(this.angle) * this.speed;
            let vy = Math.sin(this.angle) * this.speed;
            
            // 距离 = 速度 * 时间
            this.distanceTraveled = calculateDistance(this.sx, this.sy, this.x + vx * dt, this.y + vy * dt);
            
            if (this.distanceTraveled >= this.distanceToTarget) {
                createParticles(this.tx, this.ty);
                fireworks.splice(index, 1);
            } else {
                this.x += vx * dt;
                this.y += vy * dt;
            }
        }
        draw() {
            ctx.beginPath();
            ctx.moveTo(this.coordinates[this.coordinates.length - 1][0], this.coordinates[this.coordinates.length - 1][1]);
            ctx.lineTo(this.x, this.y);
            ctx.strokeStyle = 'hsl(' + hue + ', 100%, ' + this.brightness + '%)';
            ctx.stroke();
        }
    }

    class Particle {
        constructor(x, y) {
            this.x = x; this.y = y;
            this.coordinates = [];
            this.coordinateCount = 5;
            while(this.coordinateCount--) { this.coordinates.push([this.x, this.y]); }
            this.angle = random(0, Math.PI * 2);
            this.speed = random(5, 15);
            this.friction = 0.96;
            this.gravity = 1;
            this.hue = random(hue - 50, hue + 50);
            this.brightness = random(50, 80);
            this.alpha = 1;
            this.decay = random(0.005, 0.015);
        }
        update(index, dt) {
            this.coordinates.pop();
            this.coordinates.unshift([this.x, this.y]);
            
            // 摩擦力校准
            this.speed *= Math.pow(this.friction, dt);
            
            this.x += Math.cos(this.angle) * this.speed * dt;
            // 重力也要乘 dt
            this.y += (Math.sin(this.angle) * this.speed + this.gravity) * dt;
            
            this.alpha -= this.decay * dt;
            
            if (this.alpha <= this.decay) { particles.splice(index, 1); }
        }
        draw() {
            ctx.beginPath();
            ctx.moveTo(this.coordinates[this.coordinates.length - 1][0], this.coordinates[this.coordinates.length - 1][1]);
            ctx.lineTo(this.x, this.y);
            ctx.strokeStyle = 'hsla(' + this.hue + ', 100%, ' + this.brightness + '%, ' + this.alpha + ')';
            ctx.stroke();
        }
    }

    function createParticles(x, y) {
        let particleCount = isMobile ? 20 : 30;
        while (particleCount--) { particles.push(new Particle(x, y)); }
    }

    class Drop {
        constructor() {
            this.reset(true);
        }
        reset(randomY) {
            this.x = Math.random() * cw;
            this.y = randomY ? Math.random() * ch : -10;
            this.vy = random(2, 5);
            this.vx = 0; 
            this.len = random(10, 20);
            this.color = `rgba(100, 160, 255, ${random(0.3, 0.6)})`;
        }
        update(dt) {
            // 所有位移乘以 dt
            this.y += this.vy * dt;
            this.x += this.vx * dt;
            
            // 交互
            const isMoving = (Date.now() - lastMoveTime < 100);
            if (isMoving) {
                let dx = this.x - pointer.x;
                let dy = this.y - pointer.y;
                let distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 80) {
                    let force = (80 - distance) / 80;
                    let angle = Math.atan2(dy, dx);
                    // 施加斥力 (同样受 dt 影响)
                    this.vx += Math.cos(angle) * force * 0.5 * dt; 
                }
            }

            // 阻力
            this.vx *= Math.pow(0.95, dt);

            if (this.y > ch) { this.reset(false); }
            if (this.x < 0) this.x = cw;
            if (this.x > cw) this.x = 0;
        }
        draw() {
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - this.vx * 2, this.y + this.len);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
    }

    // --- 4. 动画循环 (时间驱动) ---
    
    let lastTime = 0;

    function loop(timestamp) {
        requestAnimationFrame(loop);

        // 初始化时间
        if (!lastTime) lastTime = timestamp;
        
        // 计算两帧之间的时间差 (ms)
        const elapsed = timestamp - lastTime;
        lastTime = timestamp;

        // 计算时间缩放因子 (dt)
        // 目标是 60FPS (每帧约 16.67ms)
        // 如果 elapsed = 16.67, dt = 1.0 (正常速度)
        // 如果 elapsed = 33.33 (30FPS), dt = 2.0 (移动距离加倍，保持视觉速度一致)
        let dt = elapsed / (1000 / 60);

        // 限制 dt 最大值，防止切换标签页回来后画面爆炸
        if (dt > 4) dt = 4; 

        if (isDarkMode()) {
            hue += 0.5 * dt;
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = `rgba(0, 0, 0, ${0.1 * dt})`; // 拖尾也要随时间变化
            ctx.fillRect(0, 0, cw, ch);
            ctx.globalCompositeOperation = 'lighter';
            
            let i = fireworks.length;
            while(i--) { fireworks[i].draw(); fireworks[i].update(i, dt); }
            let k = particles.length;
            while(k--) { particles[k].draw(); particles[k].update(k, dt); }
            
            // 计时器累加 dt 对应的帧数 (约等于 elapsed / 16.67)
            randomTick += dt * (1000/60); // 换算回 ms 逻辑，或者直接用 elapsed
            // 简化逻辑：直接用毫秒计时
            
            // 下面用 elapsed 累加更直观
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, cw, ch);

            if (drops.length < targetDropCount) { drops.push(new Drop()); }
            
            for (let i = 0; i < drops.length; i++) {
                drops[i].update(dt);
                drops[i].draw();
            }
        }

        // 发射逻辑改用真实时间 elapsed 累加
        if (isDarkMode()) {
            randomTick += elapsed;
            pointerTick += elapsed;

            if (randomTick >= timerTotal) {
                fireworks.push(new Firework(random(0, cw), ch, random(0, cw), random(0, ch / 2)));
                randomTick = 0;
            }
            if (pointerTick >= timerTotal) {
                if (pointer.x !== -1000 && Date.now() - lastMoveTime < 1000) {
                    fireworks.push(new Firework(cw / 2, ch, pointer.x, pointer.y));
                }
                pointerTick = 0;
            }
        }
    }

    loop(0);
})();