(() => {
  "use strict";

  const orb = document.querySelector(".orb");
  if (!orb) return;

  // Hovering or focusing the buttons turns the page dark and the buttons bright.
  const choices = document.querySelector(".choices");
  const setDark = (on) => document.body.classList.toggle("is-dark", on);
  if (choices) {
    choices.addEventListener("pointerenter", (e) => { if (e.pointerType !== "touch") setDark(true); });
    choices.addEventListener("pointerleave", () => setDark(false));
    choices.addEventListener("focusin", (e) => { if (e.target.matches(":focus-visible")) setDark(true); });
    choices.addEventListener("focusout", () => setDark(false));
  }
  window.addEventListener("pageshow", () => setDark(false));

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const IMG_SRC = "/assets/images/landing/orb.webp";
  const IMG_DARK_SRC = "/assets/images/landing/orb-dark.webp";
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
    uniform sampler2D u_tex2;
    uniform float u_dark;
    uniform vec2 u_res;
    uniform vec4 u_rect;
    uniform float u_time;
    uniform vec2 u_mouse;
    uniform float u_hover;

    const vec2 C = vec2(0.715, 0.67);     // orb centre in image space
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
    vec3 sampleDark(vec2 uv, vec2 d) {
      return vec3(texture2D(u_tex2, uv + d).r,
                  texture2D(u_tex2, uv + d * 1.07).g,
                  texture2D(u_tex2, uv + d * 1.14).b);
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
      vec2 uvA = swirl(uv, t * 0.07, 1.4 * sin(t * 0.11), 1.0);
      vec2 uvB = swirl(uv, -t * 0.045 + 2.2, -1.1 * sin(t * 0.085 + 1.0), 1.06);
      float w = 0.5 + 0.5 * sin(t * 0.14);

      vec3 col = vec3(1.0);
      if (u_dark < 0.999) {
        // Light: blend them like inks on white paper, deepening where they overlap
        vec3 inkA = 1.0 - sampleOrb(uvA, disp), inkB = 1.0 - sampleOrb(uvB, disp * 0.8);
        vec3 ink = mix(inkA, inkB, w) + 0.28 * min(inkA, inkB);
        col = clamp(1.0 - ink, 0.0, 1.0);
      }
      if (u_dark > 0.001) {
        // Dark: the same motion, but colours glow where they overlap, like light on black
        vec3 a2 = sampleDark(uvA, disp), b2 = sampleDark(uvB, disp * 0.8);
        vec3 colD = clamp(mix(a2, b2, w) + 0.22 * min(a2, b2), 0.0, 1.0);
        col = mix(col, colD, u_dark);
      }
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
  ["u_tex", "u_tex2", "u_dark", "u_res", "u_rect", "u_time", "u_mouse", "u_hover"].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));

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

  /* ---------- Textures + loop ---------- */
  const dark = { value: 0, ready: false };
  const darkImg = new Image();
  darkImg.onload = () => {
    const tex2 = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tex2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, darkImg);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(U.u_tex2, 1);
    gl.activeTexture(gl.TEXTURE0);
    dark.ready = true;
  };
  darkImg.src = IMG_DARK_SRC;

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
    let lastShade = -1;

    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      mouse.hover += (mouse.target - mouse.hover) * Math.min(dt * 3, 1);
      const darkTarget = dark.ready && document.body.classList.contains("is-dark") ? 1 : 0;
      dark.value += (darkTarget - dark.value) * Math.min(dt * 5, 1);
      if (Math.abs(darkTarget - dark.value) < 0.002) dark.value = darkTarget;
      // Keep the page colour in lock-step with the orb so there is never a visible band between them
      const shade = Math.round(255 * (1 - dark.value));
      if (shade !== lastShade) {
        lastShade = shade;
        document.body.style.backgroundColor = `rgb(${shade}, ${shade}, ${shade})`;
      }

      gl.uniform2f(U.u_res, W, H);
      gl.uniform4f(U.u_rect, rect[0], rect[1], rect[2], rect[3]);
      gl.uniform1f(U.u_time, now / 1000);
      gl.uniform2f(U.u_mouse, mouse.x, mouse.y);
      gl.uniform1f(U.u_hover, mouse.hover);
      gl.uniform1f(U.u_dark, dark.value);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (first) { first = false; orb.classList.add("gl-on"); document.body.classList.add("gl-bg"); }
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
