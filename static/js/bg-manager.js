(function() {
    // --- 1. 基础画布设置 & 变量集中声明 (搬家到这里！) ---
    var canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    
    // ✅ 所有变量都在这里先出生！
    let cw, ch, isMobile;
    let stars = [], ripples = [];              // 从第210行搬来的
    let lastRippleX, lastRippleY;              // 从第217行搬来的
    let fireworks = [], particles = [], drops = [], splashes = [], rainRipples = [], hue = 120; // 从第268行搬来的
    let lastTime = 0, randomTick = 0, pointerTick = 0; // 从第269行搬来的
    let pointer = { x: -1000, y: -1000 };
    let lastMoveTime = 0;

    // --- 之后才是函数逻辑 ---

    function resizeCanvas() {
        cw = window.innerWidth; 
        ch = window.innerHeight;
        canvas.width = cw; 
        canvas.height = ch;
        isMobile = cw < 768;
        // 现在这里调用 initStars 就安全了，因为 stars 已经在上面定义过了
        if (typeof getBackgroundState === 'function' && getBackgroundState() === 'RIPPLES') initStars();
    }
    
    // 监听窗口大小
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // 这里运行时，stars 已经存在了，不会报错！

    // 交互状态更新
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
        const today = new Date();
        const year = today.getFullYear();
        const dateStr = (today.getMonth() + 1).toString().padStart(2, '0') + "-" + today.getDate().toString().padStart(2, '0');
        var todayShort = dateStr;
        var todayLong = year + '-' + dateStr;

        var targetDates = window.fireworkDates || [];

        const isHoliday = (targetDates.includes(todayShort) || targetDates.includes(todayLong));

        if (!isNight) return 'RAIN';           
        if (isHoliday) return 'FIREWORKS';     
        return 'RIPPLES';                      
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
            this.friction = 0.97; 
            this.gravity = 1; 
            this.hue = random(hue - 50, hue + 50);
            this.alpha = 1; 
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
            ctx.lineWidth = 2;
            ctx.moveTo(this.coordinates[this.coordinates.length-1][0], this.coordinates[this.coordinates.length-1][1]);
            ctx.lineTo(this.x, this.y); 
            ctx.stroke();
            ctx.lineWidth = 1;
        }
    }

    class Splash {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * 10;
            this.vy = (Math.random() - 0.5) * 10;
            this.gravity = 0.5;
            this.life = 1.0; 
            this.decay = random(0.03, 0.05); 
        }
        update(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.vy += this.gravity * dt; 
            this.life -= this.decay * dt;
        }
        draw() {
            ctx.globalAlpha = this.life;
            ctx.fillStyle = 'rgba(100, 160, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }
    
    // --- 新增：雨水落地涟漪类 ---
    class RainRipple {
        // 👇 构造函数新增 dropLen 参数
        constructor(x, y, dropLen) {
            this.x = x;
            this.y = y;
            this.r = 1;        // 初始半径
            
            // ✨ 物理关联魔法：
            // 1. 速度：雨滴越长(max 80)，扩散越快；雨滴越短(min 25)，扩散越慢
            //    (计算公式：长度 / 60 -> 大约在 0.4 到 1.3 之间)
            this.speed = dropLen / 60; 

            // 2. 初始透明度：大雨滴的涟漪更明显
            this.a = dropLen / 80; 
            if (this.a > 1) this.a = 1; // 封顶

            // 3. 线条粗细：大雨滴涟漪稍微粗一点点
            this.width = dropLen / 40; 
        }

        update(dt) {
            this.r += this.speed * dt; // 使用计算出来的动态速度
            this.a *= 0.985;            // 衰减
        }

        draw() {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(160, 196, 255, ${this.a})`;
            
            // 👇 使用动态计算的粗细
            ctx.lineWidth = this.width;
            
            // 画椭圆
            ctx.ellipse(this.x, this.y, this.r, this.r * 0.4, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    class Drop {
        constructor() { this.reset(true); }
        
        reset(isInit) {
            this.x = Math.random() * cw; 
            
            // 1. 设定“地面”高度 (寿命)
            this.endY = random(ch * 0.43, ch * 1.01); // 稍微提高一点下限，让画面更有层次

            // 2. 设定初始位置
            // isInit ? 随机分布在天上 : 从屏幕顶端上方一点点开始
            this.y = isInit ? Math.random() * this.endY : -60;
            
            this.vy = random(6, 10); 
            this.len = random(25, 70);
            
            // 3. 标记：这滴雨是不是已经溅起过涟漪了？(防止一滴雨触发多次涟漪)
            this.hasRippled = false; 
        }

        update(dt) {
            // 雨滴继续无脑往下掉 (y 是雨滴的尾巴/顶端)
            this.y += this.vy * dt; 
            
            // 计算雨滴的“头” (最下面那一点)
            let dropTip = this.y + this.len;

            // --- 交互逻辑 (鼠标飞溅) ---
            if (Date.now() - lastMoveTime < 200) {
                let dx = this.x - pointer.x;
                let dy = this.y - pointer.y;
                // 如果鼠标碰到了雨滴的任何部分
                if (Math.abs(dx) < 40 && Math.abs(dy) < 40) {
                    createSplashes(this.x, this.y, Math.floor(random(3, 6)));
                    this.reset(false);
                    return; // 既然重置了，就不用执行下面的逻辑了
                }
            }

            // --- 💧 涟漪触发逻辑 ---
            // 如果“头”撞到了“地面”，并且还没触发过涟漪
            if (dropTip >= this.endY && !this.hasRippled) {
                rainRipples.push(new RainRipple(this.x, this.endY, this.len));
                this.hasRippled = true; // 标记一下，下次别再触发了
            }

            // --- 💀 销毁逻辑 ---
            // 只有当雨滴的“尾巴”(y) 也完全钻入地下后，才算彻底结束
            if (this.y > this.endY) {
                this.reset(false);
            }
        }

        draw() {
            ctx.beginPath(); 
            ctx.strokeStyle = 'rgba(130, 170, 255, 0.35)'; 
            ctx.lineWidth = 2;

            // --- ✨ 核心魔法：视觉截断 ---
            // 我们计算实际应该画到的终点：
            // 正常情况下是 y + len，但不能超过 endY (地面)
            let visualEndY = Math.min(this.y + this.len, this.endY);

            // 只有当雨滴还有一部分在地面之上时才画
            if (visualEndY > this.y) {
                ctx.moveTo(this.x, this.y);      // 从尾巴(上)
                ctx.lineTo(this.x, visualEndY);  // 画到视觉终点(下)
                ctx.stroke();
            }
        }
    }

    // --- 6. 星空逻辑 (变量已经搬家，这里只留函数) ---
    function initStars() {
        stars = [];
        for(let i=0; i<200; i++) {
            stars.push({ x: Math.random()*cw, y: Math.random()*ch, size: Math.random()*2, alpha: Math.random(), baseAlpha: Math.random() });
        }
    }

    function addRipple(x, y) {
        if (!lastRippleX || Math.hypot(x - lastRippleX, y - lastRippleY) > 50) {
            ripples.push({ x: x, y: y, r: 0, life: 1 });
            lastRippleX = x; lastRippleY = y;
        }
    }

    function drawRipples(dt) {
        ctx.fillStyle = '#0a0e14'; 
        ctx.fillRect(0, 0, cw, ch);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 0.3;
        for(let i=ripples.length-1; i>=0; i--) {
            let r = ripples[i]; 
            r.r += 1 * dt; 
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
    function createParticles(x, y) {
        let count = isMobile ? 20 : 50;
        while(count--) particles.push(new Particle(x, y));
    }

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

            // 👇 新增：更新落地涟漪 (RainRipple)
            for (let i = rainRipples.length - 1; i >= 0; i--) {
                let r = rainRipples[i];
                r.update(dt);
                r.draw();
                // 如果透明度太低看不见了，就删掉
                if (r.a < 0.01) rainRipples.splice(i, 1);
            }
 
        } else {
            drawRipples(dt);
        }
    }
    
    // 初始化
    initStars();
    loop(0);
})();