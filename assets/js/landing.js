(() => {
  "use strict";

  const orb = document.querySelector(".orb");
  if (!orb) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const IMG_SRC = "/assets/images/landing/orb.webp";
  const mobileMQ = window.matchMedia("(max-width: 760px), (max-aspect-ratio: 1/1)");
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  const canvas = document.createElement("canvas");
  canvas.className = "orb-gl";
  orb.append(canvas);

  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) {
    canvas.remove();
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

    const vec2 C = vec2(0.71, 0.57);      // orb centre in image space
    const vec2 ASPECT = vec2(1.5, 1.0);   // image width : height

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

    // Rotate around the orb's centre; the middle turns further than the rim, so it swirls.
    vec2 swirl(vec2 uv, float ang, float twist, float scale) {
      vec2 p = (uv - C) * ASPECT / scale;
      float r = length(p);
      float a = ang + twist * exp(-r * r * 7.0);
      float cs = cos(a), sn = sin(a);
      p = mat2(cs, -sn, sn, cs) * p;
      return p / ASPECT + C;
    }
    vec3 sampleOrb(vec2 uv, vec2 d) {
      return vec3(texture2D(u_tex, uv + d).r,
                  texture2D(u_tex, uv + d * 1.07).g,
                  texture2D(u_tex, uv + d * 1.14).b);
    }

    void main() {
      vec2 frag = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
      vec2 uv = (frag - u_rect.xy) / u_rect.zw;
      float t = u_time;

      // Liquid drift
      float f = t * 0.05;
      vec2 p = uv * vec2(3.0, 2.0) * 1.35;
      vec2 w1 = vec2(fbm(p + vec2(f, -f * 0.7)), fbm(p + vec2(5.2 - f * 0.8, 1.3 + f)));
      vec2 w2 = vec2(fbm(p * 1.7 + w1 * 2.2 + vec2(-f * 1.3, f * 0.5)),
                     fbm(p * 1.7 + w1 * 2.2 + vec2(3.1 + f * 0.6, 7.4 - f)));
      vec2 disp = (w2 - 0.5) * 0.04 + (w1 - 0.5) * 0.022;

      // Pointer gently parts the liquid
      vec2 m = (u_mouse - u_rect.xy) / u_rect.zw;
      vec2 dv = uv - m;
      disp += normalize(dv + 1e-5) * 0.03 * exp(-dot(dv, dv) * 45.0) * u_hover;

      // Two copies of the orb turning in opposite directions at different speeds
      vec3 a = sampleOrb(swirl(uv, t * 0.07, 1.4 * sin(t * 0.11), 1.0), disp);
      vec3 b = sampleOrb(swirl(uv, -t * 0.045 + 2.2, -1.1 * sin(t * 0.085 + 1.0), 1.06), disp * 0.8);

      // Blend them like inks on white paper: they merge, deepen where they overlap, then part again
      vec3 inkA = 1.0 - a, inkB = 1.0 - b;
      float w = 0.5 + 0.5 * sin(t * 0.14);
      vec3 ink = mix(inkA, inkB, w) + 0.28 * min(inkA, inkB);
      vec3 col = clamp(1.0 - ink, 0.0, 1.0);
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = clamp(mix(vec3(lum), col, 1.35), 0.0, 1.0);   // keep blended colours vivid

      col = hueShift(col, sin(t * 0.12) * 0.2);
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
    canvas.remove();
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
    canvas.width = W;
    canvas.height = H;
    gl.viewport(0, 0, W, H);

    let s, px;
    if (mobileMQ.matches) { s = h / IH; px = 0.84; }
    else { s = Math.max(w / IW, h / IH); px = 1; }
    rect = [(w - IW * s) * px * DPR, (h - IH * s) * 0.5 * DPR, IW * s * DPR, IH * s * DPR];
  }

  /* ---------- Pointer (desktop only) ---------- */
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
      mouse.hover += (mouse.target - mouse.hover) * Math.min(dt * 3, 1);

      gl.uniform2f(U.u_res, W, H);
      gl.uniform4f(U.u_rect, rect[0], rect[1], rect[2], rect[3]);
      gl.uniform1f(U.u_time, now / 1000);
      gl.uniform2f(U.u_mouse, mouse.x, mouse.y);
      gl.uniform1f(U.u_hover, mouse.hover);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (first) { first = false; orb.classList.add("gl-on"); }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  img.onerror = () => canvas.remove();
  img.src = IMG_SRC;

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 120);
  });
})();
