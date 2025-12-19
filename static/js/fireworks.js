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
    
    // 鼠标状态管理
    let mouse = { x: -1000, y: -1000 };
    let lastMouseTime = 0; 

    function resizeCanvas() {
        cw = window.innerWidth;
        ch = window.innerHeight;
        canvas.width = cw;
        canvas.height = ch;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // 监听鼠标移动
    window.addEventListener('mousemove', function(e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        lastMouseTime = Date.now(); 
    });
    window.addEventListener('mouseout', function() {
        mouse.x = -1000;
        mouse.y = -1000;
    });

    // --- 2. 状态变量 ---
    // 烟花相关
    let fireworks = [];
    let particles = [];
    let hue = 120;
    
    // 发射控制器
    let timerTotal = 200; 
    let randomTick = 0;   
    let mouseTick = 100;  

    // 水幕相关
    let drops = [];
    const dropCount = 150; 

    // 深色模式检测
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

    // 模式切换监听
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

    // --- 3. 烟花类 ---
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
        update(index) {
            this.coordinates.pop();
            this.coordinates.unshift([this.x, this.y]);
            this.speed *= this.acceleration;
            let vx = Math.cos(this.angle) * this.speed;
            let vy = Math.sin(this.angle) * this.speed;
            this.distanceTraveled = calculateDistance(this.sx, this.sy, this.x + vx, this.y + vy);
            if (this.distanceTraveled >= this.distanceToTarget) {
                createParticles(this.tx, this.ty);
                fireworks.splice(index, 1);
            } else {
                this.x += vx; this.y += vy;
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
        update(index) {
            this.coordinates.pop();
            this.coordinates.unshift([this.x, this.y]);
            this.speed *= this.friction;
            this.x += Math.cos(this.angle) * this.speed;
            this.y += Math.sin(this.angle) * this.speed + this.gravity;
            this.alpha -= this.decay;
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
        let particleCount = 30;
        while (particleCount--) { particles.push(new Particle(x, y)); }
    }

    // --- 4. 水滴类 (智能互动 - 柔和版) ---
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

        update() {
            this.y += this.vy;
            this.x += this.vx;
            
            // 距离现在小于 100ms 内移动过鼠标才触发交互
            const isMouseMoving = (Date.now() - lastMouseTime < 100);

            if (isMouseMoving) {
                let dx = this.x - mouse.x;
                let dy = this.y - mouse.y;
                let distance = Math.sqrt(dx * dx + dy * dy);
                
                // 交互范围 60px
                if (distance < 60) {
                    let force = (60 - distance) / 60;
                    let angle = Math.atan2(dy, dx);
                    
                    // --- 修改点在这里 ---
                    // 将原来的 *2 改成了 *0.5，力度减小了 75%
                    this.vx += Math.cos(angle) * force * 0.9; 
                }
            }

            this.vx *= 0.95; // 阻力

            if (this.y > ch) {
                this.reset(false);
            }
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

    // --- 5. 动画主循环 ---
    function loop() {
        requestAnimationFrame(loop);

        if (isDarkMode()) {
            // === 深色模式：烟花 ===
            hue += 0.5;
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; 
            ctx.fillRect(0, 0, cw, ch);
            ctx.globalCompositeOperation = 'lighter';
            
            let i = fireworks.length;
            while(i--) { fireworks[i].draw(); fireworks[i].update(i); }
            let k = particles.length;
            while(k--) { particles[k].draw(); particles[k].update(k); }
            
            // 随机烟花
            if (randomTick >= timerTotal) {
                fireworks.push(new Firework(random(0, cw), ch, random(0, cw), random(0, ch / 2)));
                randomTick = 0;
            } else { randomTick++; }

            // 鼠标追踪烟花
            if (mouseTick >= timerTotal) {
                if (mouse.x !== -1000 && Date.now() - lastMouseTime < 1000) {
                    fireworks.push(new Firework(cw / 2, ch, mouse.x, mouse.y));
                }
                mouseTick = 0;
            } else { mouseTick++; }

        } else {
            // === 浅色模式：水滴 ===
            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, cw, ch);

            if (drops.length < dropCount) {
                drops.push(new Drop());
            }

            for (let i = 0; i < drops.length; i++) {
                drops[i].update();
                drops[i].draw();
            }
        }
    }

    loop();
})();