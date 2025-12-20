(function() {
    // --- 1. 画布与基础设置 ---
    var canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let cw, ch, isMobile;
    let stars = [];
    let ripples = [];

    function resize() {
        cw = window.innerWidth;
        ch = window.innerHeight;
        canvas.width = cw;
        canvas.height = ch;
        isMobile = cw < 768;
        initStars(); 
    }

    function initStars() {
        stars = [];
        for(let i=0; i<200; i++) {
            stars.push({ x: Math.random()*cw, y: Math.random()*ch, size: Math.random()*2, baseAlpha: Math.random(), alpha: Math.random() });
        }
    }
    window.addEventListener('resize', resize);
    resize();

    // 交互状态
    let pointer = { x: -1000, y: -1000 };
    let lastMoveTime = 0;
    function updatePointer(x, y) {
        pointer.x = x; pointer.y = y;
        lastMoveTime = Date.now();
        if (window.getBackgroundState && window.getBackgroundState() === 'RIPPLES') {
            if (!this.lastR || Math.hypot(x-this.lastX, y-this.lastY) > 50) {
                ripples.push({x: x, y: y, r: 0, life: 1});
                this.lastX = x; this.lastY = y;
            }
        }
    }
    window.addEventListener('mousemove', e => updatePointer(e.clientX, e.clientY));

    // --- 2. 核心类 (Firework, Particle, Drop) ---
    // [此处建议保留你原本代码中定义的 Firework, Particle, Drop 类逻辑]
    // ... 

    // --- 3. 星空涟漪渲染函数 ---
    function drawStarRipples(dt) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#0a0e14'; 
        ctx.fillRect(0, 0, cw, ch);

        // 更新波纹
        for(let i=ripples.length-1; i>=0; i--) {
            let r = ripples[i];
            r.r += 2 * dt;
            r.life -= 0.006 * dt;
            if(r.life <= 0) ripples.splice(i, 1);
        }

        // 绘星
        stars.forEach(s => {
            let ox = 0, oy = 0;
            ripples.forEach(r => {
                let d = Math.hypot(s.x-r.x, s.y-r.y);
                if (Math.abs(d - r.r) < 50) {
                    let str = (1 - Math.abs(d - r.r)/50) * r.life * 5;
                    let ang = Math.atan2(s.y-r.y, s.x-r.x);
                    ox += Math.cos(ang) * str; oy += Math.sin(ang) * str;
                }
            });
            ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
            ctx.beginPath();
            ctx.arc(s.x + ox, s.y + oy, s.size, 0, Math.PI*2);
            ctx.fill();
            s.alpha = s.baseAlpha + Math.sin(Date.now()/500 + s.x)*0.2;
        });
    }

    // --- 4. 主循环 ---
    let lastTime = 0;
    let fireworks = [], particles = [], drops = [], hue = 120, randomTick = 0, pointerTick = 0;

    function loop(timestamp) {
        requestAnimationFrame(loop);
        if (typeof window.getBackgroundState !== 'function') return;
        const state = window.getBackgroundState();

        const dt = (timestamp - lastTime) / (1000/60) || 1;
        const elapsed = timestamp - lastTime || 0;
        lastTime = timestamp;

        if (state === 'FIREWORKS') {
            hue += 0.5 * dt;
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = `rgba(0, 0, 0, ${0.1 * dt})`;
            ctx.fillRect(0, 0, cw, ch);
            ctx.globalCompositeOperation = 'lighter';
            // ... (执行烟花更新与绘制)
            
            randomTick += elapsed;
            if (randomTick >= 200) { /* 发射逻辑 */ randomTick = 0; }
        } else if (state === 'RAIN') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, cw, ch);
            // ... (执行雨帘更新与绘制)
        } else if (state === 'RIPPLES') {
            drawStarRipples(dt); // 绘制星空涟漪
        }
    }
    loop(0);
})();