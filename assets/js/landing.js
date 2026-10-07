(() => {
  "use strict";

  const orb = document.querySelector(".orb");
  if (!orb) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const IMG_SRC = "/assets/images/landing/orb.webp";
  const mobileMQ = window.matchMedia("(max-width: 760px), (max-aspect-ratio: 1/1)");
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  const glCanvas = document.createElement("canvas");
  glCanvas.className = "orb-gl";
  const fxCanvas = document.createElement("canvas");
  fxCanvas.className = "orb-fx";
  orb.append(glCanvas, fxCanvas);

  const gl = glCanvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) {
    glCanvas.remove();
    fxCanvas.remove();
    return;
  }

  /* ---------- Shader ---------- */
  const VERT = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

  const FRAG = `
    precision highp float;
    uniform sampler2D u_tex;
    uniform vec2 u_res;
    uniform vec4 u_rect;
    uniform float u_time;
    uniform vec2 u_mouse;
    uniform float u_hover;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
      return v;
    }
    vec3 hueShift(vec3 c, float ang) {
      vec3 k = vec3(0.57735);
      float cs = cos(ang), sn = sin(ang);
      return c * cs + cross(k, c) * sn + k * dot(k, c) * (1.0 - cs);
    }

    void main() {
      vec2 frag = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
      vec2 uv = (frag - u_rect.xy) / u_rect.zw;
      float t = u_time * 0.055;

      vec2 p = uv * vec2(3.0, 2.0) * 1.35;
      vec2 w1 = vec2(fbm(p + vec2(t, -t * 0.7)),
                     fbm(p + vec2(5.2 - t * 0.8, 1.3 + t)));
      vec2 w2 = vec2(fbm(p * 1.7 + w1 * 2.2 + vec2(-t * 1.3, t * 0.5)),
                     fbm(p * 1.7 + w1 * 2.2 + vec2(3.1 + t * 0.6, 7.4 - t)));
      vec2 disp = (w2 - 0.5) * 0.042 + (w1 - 0.5) * 0.024;

      vec2 m = (u_mouse - u_rect.xy) / u_rect.zw;
      vec2 dv = uv - m;
      float d2 = dot(dv, dv);
      disp += normalize(dv + 1e-5) * 0.035 * exp(-d2 * 45.0) * u_hover;

      vec3 col;
      col.r = texture2D(u_tex, uv + disp).r;
      col.g = texture2D(u_tex, uv + disp * 1.07).g;
      col.b = texture2D(u_tex, uv + disp * 1.14).b;

      col = hueShift(col, sin(u_time * 0.18) * 0.2);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };

  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) {
    glCanvas.remove();
    fxCanvas.remove();
    return;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ["u_tex", "u_res", "u_rect", "u_time", "u_mouse", "u_hover"].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));

  /* ---------- Layout (mirrors the CSS background sizing) ---------- */
  let IW = 2000, IH = 1333;
  let W = 0, H = 0;
  let rect = [0, 0, 1, 1];
  const mouse = { x: -9999, y: -9999, hover: 0, target: 0 };

  function layout() {
    const w = orb.clientWidth, h = orb.clientHeight;
    if (!w || !h) return;
    W = Math.round(w * DPR);
    H = Math.round(h * DPR);
    [glCanvas, fxCanvas].forEach((c) => { c.width = W; c.height = H; });
    gl.viewport(0, 0, W, H);

    let s, px;
    if (mobileMQ.matches) { s = h / IH; px = 0.84; }
    else { s = Math.max(w / IW, h / IH); px = 1; }
    rect = [(w - IW * s) * px * DPR, (h - IH * s) * 0.5 * DPR, IW * s * DPR, IH * s * DPR];
    while (particles.length < PARTICLES) particles.push({});
    particles.forEach((p) => spawn(p, true));
  }

  /* ---------- Particles ---------- */
  const fx = fxCanvas.getContext("2d");
  const COLORS = ["255,90,54", "196,47,168", "85,214,138", "255,181,46", "123,92,255"];
  const PARTICLES = mobileMQ.matches ? 26 : 40;
  const particles = [];

  function orbCenter() {
    return { x: rect[0] + 0.71 * rect[2], y: rect[1] + 0.57 * rect[3], rx: 0.24 * rect[2], ry: 0.36 * rect[3] };
  }
  function spawn(p, initial) {
    const c = orbCenter();
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 1.1;
    p.x = c.x + Math.cos(a) * c.rx * r;
    p.y = c.y + Math.sin(a) * c.ry * r;
    p.r = (1.4 + Math.random() * 3.6) * DPR;
    p.vx = (Math.random() - 0.5) * 9 * DPR;
    p.vy = -(5 + Math.random() * 16) * DPR;
    p.life = 7 + Math.random() * 9;
    p.age = initial ? Math.random() * p.life : 0;
    p.phase = Math.random() * Math.PI * 2;
    p.color = COLORS[(Math.random() * COLORS.length) | 0];
    return p;
  }
  
  function drawParticles(dt, time) {
    fx.clearRect(0, 0, W, H);
    for (const p of particles) {
      p.age += dt;
      if (p.age >= p.life) spawn(p, false);
      p.x += (p.vx + Math.sin(time * 0.6 + p.phase) * 6 * DPR) * dt;
      p.y += p.vy * dt;
      const k = Math.sin(Math.PI * (p.age / p.life));
      const alpha = 0.55 * k * k;
      const g = fx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
      g.addColorStop(0, `rgba(${p.color},${alpha})`);
      g.addColorStop(0.35, `rgba(${p.color},${alpha * 0.45})`);
      g.addColorStop(1, `rgba(${p.color},0)`);
      fx.fillStyle = g;
      fx.beginPath();
      fx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
      fx.fill();
    }
  }

  /* ---------- Pointer (desktop): the liquid gently parts around the cursor ---------- */
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const b = orb.getBoundingClientRect();
    mouse.x = (e.clientX - b.left) * DPR;
    mouse.y = (e.clientY - b.top) * DPR;
    mouse.target = 1;
    clearTimeout(mouse.timer);
    mouse.timer = setTimeout(() => (mouse.target = 0), 1400);
  }, { passive: true });

  /* ---------- Texture + loop ---------- */
  const img = new Image();
  img.onload = () => {
    IW = img.naturalWidth;
    IH = img.naturalHeight;
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(U.u_tex, 0);

    layout();
    let last = performance.now();
    let first = true;

    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const time = now / 1000;
      mouse.hover += (mouse.target - mouse.hover) * Math.min(dt * 3, 1);

      gl.uniform2f(U.u_res, W, H);
      gl.uniform4f(U.u_rect, rect[0], rect[1], rect[2], rect[3]);
      gl.uniform1f(U.u_time, time);
      gl.uniform2f(U.u_mouse, mouse.x, mouse.y);
      gl.uniform1f(U.u_hover, mouse.hover);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      drawParticles(dt, time);

      if (first) { first = false; orb.classList.add("gl-on"); }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  img.onerror = () => { glCanvas.remove(); fxCanvas.remove(); };
  img.src = IMG_SRC;

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 120);
  });
})();
