(() => {
  "use strict";
  document.documentElement.classList.add("js");

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- State ---------- */
  const KEY = "think.v1";
  const defaults = () => ({
    problem: "",
    category: null,
    tool: null,
    pc: { pros: [], cons: [], reflection: "" },
    em: { stage: "collect", zones: { inbox: [], do: [], plan: [], delegate: [], drop: [] } },
    dt: { root: { id: uid(), children: [] } },
    pm: { step: 0, risks: [] },
  });
  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? Object.assign(defaults(), JSON.parse(raw)) : defaults();
    } catch (e) {
      return defaults();
    }
  };
  let S = load();
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ }
  };

  const TOOLS = {
    proscons: {
      name: "Pros & Cons",
      icon: "#ico-proscons",
      question: "What are the reasons for and against this choice?",
      why: "You’re comparing alternatives, so seeing the benefits and trade-offs side by side can make the decision clearer.",
    },
    eisenhower: {
      name: "Eisenhower Matrix",
      icon: "#ico-eisenhower",
      question: "Sort what you need to do by importance and urgency.",
      why: "You have more to do than you can do at once, so separating what’s important from what only feels urgent shows you where to start.",
    },
    tree: {
      name: "Decision Tree",
      icon: "#ico-tree",
      question: "Map out your options and where each one could lead.",
      why: "You’re weighing several options, so seeing them all in one place, with their possible outcomes, helps you decide faster and with more confidence.",
    },
    premortem: {
      name: "Pre-Mortem",
      icon: "#ico-premortem",
      question: "Find the risks now, while there’s still time to act on them.",
      why: "You want to pressure-test a plan, so imagining it has already failed helps you spot problems while you can still prevent them.",
    },
  };

  /* ---------- Elements ---------- */
  const wsProblem = $("#wsProblem");
  const recSection = $("#recommend");
  const recCard = $("#recCard");
  const wsSection = $("#workspace");
  const wsCard = $("#wsCard");
  const body = $("#toolBody");
  let recommended = null;
  let focusAfter = null;

  const replay = (el) => {
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  };
  const toView = (el) => el.scrollIntoView({ behavior: "smooth", block: "start" });
  const autosize = (t) => {
    t.style.height = "auto";
    t.style.height = t.scrollHeight + "px";
  };

  /* ---------- Problem ---------- */
  function setProblem(text, from) {
    S.problem = text;
    save();
    if (from !== "ws") wsProblem.value = text;
    updateRecProblem();
    updateTreePrompt();
  }
  function updateRecProblem() {
    const has = S.problem.trim().length > 0;
    $("#recProblemWrap").hidden = !has;
    $("#recProblem").textContent = has ? "“" + S.problem.trim() + "”" : "";
  }

  // Guided tools reveal their next step once a problem is written.
  const openAfterProblem = (now) => {
    if (!S.problem.trim()) return;
    if (S.tool === "proscons") pcOpenStep("thought", now);
    if (S.tool === "tree") dtOpenStep("decision", now);
    if (S.tool === "premortem") pmOpenStep("start", now);
  };
  wsProblem.addEventListener("input", () => {
    setProblem(wsProblem.value, "ws");
    openAfterProblem(false);
  });
  wsProblem.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !S.problem.trim()) return;
    const nextSel = { proscons: "#pcThought", tree: ".troot textarea", premortem: "#pmInput" }[S.tool];
    if (!nextSel) return;
    e.preventDefault();
    openAfterProblem(true);
    const next = $(nextSel, body);
    if (next) next.focus();
  });
  wsProblem.addEventListener("blur", () => openAfterProblem(true));

  /* ---------- Category -> recommendation -> workspace ---------- */
  function selectCategory(card) {
    S.category = card.dataset.cat;
    save();
    $$(".cat-card").forEach((c) => {
      const on = c === card;
      c.classList.toggle("is-selected", on);
      $(".cat-select", c).setAttribute("aria-pressed", String(on));
      $(".cat-reveal", c).hidden = !on;
    });
    showRecommendation(card.dataset.tool);
  }

  function showRecommendation(tool) {
    recommended = tool;
    const t = TOOLS[tool];
    recCard.dataset.tool = tool;
    $("#recName").textContent = t.name;
    $("#recIconUse").setAttribute("href", t.icon);
    $("#recWhy").textContent = t.why;
    updateRecProblem();
    const first = recSection.hidden;
    recSection.hidden = false;
    $("#recOthers").hidden = true;
    $("#recOther").setAttribute("aria-expanded", "false");
    if (!first) replay(recCard);
    setTimeout(() => toView(recSection), 60);
  }

  $$(".cat-select").forEach((b) => b.addEventListener("click", () => selectCategory(b.closest(".cat-card"))));
  $$(".cat-go").forEach((b) =>
    b.addEventListener("click", () => startTool(b.closest(".cat-card").dataset.tool))
  );
  $("#recStart").addEventListener("click", () => startTool(recommended));
  $("#recOther").addEventListener("click", (e) => {
    const box = $("#recOthers");
    box.hidden = !box.hidden;
    e.currentTarget.setAttribute("aria-expanded", String(!box.hidden));
  });
  $("#wsSwitch").addEventListener("click", (e) => {
    const box = $("#wsOthers");
    box.hidden = !box.hidden;
    e.currentTarget.setAttribute("aria-expanded", String(!box.hidden));
  });
  $$("[data-pick]").forEach((b) => b.addEventListener("click", () => startTool(b.dataset.pick)));
  $("#wsReset").addEventListener("click", () => {
    if (!confirm("Start over? This clears everything you’ve written on this device.")) return;
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    location.href = location.pathname + "#top";
    location.reload();
  });

  function startTool(tool) {
    if (!TOOLS[tool]) return;
    S.tool = tool;
    save();
    const t = TOOLS[tool];
    wsCard.dataset.tool = tool;
    $("#wsName").textContent = t.name;
    $("#wsQuestion").textContent = t.question;
    $(".ws-problem label").textContent = tool === "proscons" ? "Help me decide" : "Your problem";
    wsProblem.placeholder = tool === "proscons" ? "What are you trying to decide?" : "Describe what’s on your mind...";
    $("#wsIconUse").setAttribute("href", t.icon);
    wsProblem.value = S.problem;
    $("#wsOthers").hidden = true;
    $("#wsSwitch").setAttribute("aria-expanded", "false");
    const first = wsSection.hidden;
    wsSection.hidden = false;
    if (!first) replay(wsCard);
    renderTool();
    setTimeout(() => toView(wsSection), 60);
  }

  /* ---------- Tool dispatcher ---------- */
  const IMPL = {};
  function renderTool() {
    if (!S.tool) return;
    IMPL[S.tool].render();
    $$("textarea.autosize", body).forEach(autosize);
    if (S.tool === "tree") drawLines();
    if (focusAfter) {
      const el = $(focusAfter, body);
      if (el) el.focus({ preventScroll: false });
      focusAfter = null;
    }
  }
  body.addEventListener("click", (e) => S.tool && IMPL[S.tool].click && IMPL[S.tool].click(e));
  body.addEventListener("input", (e) => S.tool && IMPL[S.tool].input && IMPL[S.tool].input(e));
  body.addEventListener("submit", (e) => {
    e.preventDefault();
    if (S.tool && IMPL[S.tool].submit) IMPL[S.tool].submit(e);
  });
  body.addEventListener("change", (e) => S.tool && IMPL[S.tool].change && IMPL[S.tool].change(e));
  body.addEventListener("keydown", (e) => {
    const t = e.target;
    if (e.key === "Enter" && !e.shiftKey && t.matches("textarea.autosize, .em-collect textarea")) {
      e.preventDefault();
      const form = t.closest("form");
      if (form) form.requestSubmit();
      else t.blur();
    }
  });

  /* ---------- Drag & drop (shared) ---------- */
  const dropLine = document.createElement("div");
  dropLine.className = "drop-line";
  let drag = null;

  const currentZones = () => {
    if (S.tool === "proscons") return { pros: S.pc.pros, cons: S.pc.cons };
    if (S.tool === "eisenhower" && S.em.stage === "matrix") return S.em.zones;
    return null;
  };
  const indexAt = (dz, y) => {
    const cards = $$(".card:not(.is-dragging)", dz);
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return cards.length;
  };
  const clearDrag = () => {
    dropLine.remove();
    $$(".dz-over, .is-dragging", body).forEach((el) => el.classList.remove("dz-over", "is-dragging"));
    $$(".card[draggable='true']", body).forEach((c) => { if (c.querySelector(".card-text")) c.draggable = false; });
  };
  function moveItem(zones, from, id, to, index) {
    const src = zones[from];
    const i = src.findIndex((x) => x.id === id);
    if (i < 0) return;
    const [item] = src.splice(i, 1);
    zones[to].splice(Math.min(index, zones[to].length), 0, item);
  }

  body.addEventListener("pointerdown", (e) => {
    const grip = e.target.closest(".grip");
    if (grip) grip.closest(".card").draggable = true;
  });
  body.addEventListener("dragstart", (e) => {
    const card = e.target.closest && e.target.closest(".card");
    const dz = card && card.closest(".dz");
    if (!card || !dz || !card.draggable || !currentZones()) return;
    drag = { id: card.dataset.id, from: dz.dataset.zone };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", drag.id);
    requestAnimationFrame(() => card.classList.add("is-dragging"));
  });
  body.addEventListener("dragover", (e) => {
    const dz = e.target.closest && e.target.closest(".dz");
    if (!dz || !drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    $$(".dz-over", body).forEach((x) => x !== dz && x.classList.remove("dz-over"));
    dz.classList.add("dz-over");
    const idx = indexAt(dz, e.clientY);
    const cards = $$(".card:not(.is-dragging)", dz);
    if (cards[idx]) dz.insertBefore(dropLine, cards[idx]);
    else dz.appendChild(dropLine);
  });
  body.addEventListener("dragleave", (e) => {
    const dz = e.target.closest && e.target.closest(".dz");
    if (dz && !dz.contains(e.relatedTarget)) {
      dz.classList.remove("dz-over");
      dropLine.remove();
    }
  });
  body.addEventListener("drop", (e) => {
    const dz = e.target.closest && e.target.closest(".dz");
    const zones = currentZones();
    if (!dz || !drag || !zones) return;
    e.preventDefault();
    moveItem(zones, drag.from, drag.id, dz.dataset.zone, indexAt(dz, e.clientY));
    drag = null;
    save();
    renderTool();
  });
  body.addEventListener("dragend", () => {
    drag = null;
    clearDrag();
  });
  body.addEventListener("pointerup", () => {
    $$(".card", body).forEach((c) => { if (c.querySelector(".card-text")) c.draggable = false; });
  });

  /* ---------- Step-by-step reveal (shared) ---------- */
  let stepTimer = null;
  // Open a step once typing pauses, or right away on Enter/blur.
  const openStep = (open, step, stage, now) => {
    clearTimeout(stepTimer);
    if (open[step]) return;
    const go = () => { open[step] = true; stage(); };
    if (now) go(); else stepTimer = setTimeout(go, 450);
  };
  // Show/hide parts of a tool, animating anything that just appeared.
  const applyStage = (want, shown) => {
    Object.entries(want).forEach(([sel, on]) => {
      const el = $(sel, body);
      if (!el) return;
      el.hidden = !on;
      if (on && !shown[sel]) {
        el.classList.remove("pc-in");
        void el.offsetWidth;
        el.classList.add("pc-in");
        $$("textarea.autosize", el).forEach(autosize); // measured as 0 while hidden
      }
      shown[sel] = on;
    });
  };

  /* ---------- Pros & Cons ---------- */
  const pcCard = (it) => `
    <div class="card${it.important ? " is-important" : ""}" data-id="${it.id}">
      <button class="grip" type="button" aria-label="Drag to reorder" tabindex="-1">⋮⋮</button>
      <textarea class="card-text autosize" rows="1" aria-label="Edit this reason">${esc(it.text)}</textarea>
      <div class="card-actions">
        <button class="ic" type="button" data-act="up" title="Move up" aria-label="Move up">↑</button>
        <button class="ic" type="button" data-act="down" title="Move down" aria-label="Move down">↓</button>
        <button class="ic" type="button" data-act="swap" title="Move to the other side" aria-label="Move to the other side">⇄</button>
        <button class="ic del" type="button" data-act="del" title="Delete" aria-label="Delete">×</button>
      </div>
    </div>`;
  const SCALE = {
    "-2": { label: "Strong Con", side: "cons", strong: true },
    "-1": { label: "Con", side: "cons", strong: false },
    "0": { label: "", side: null, strong: false },
    "1": { label: "Pro", side: "pros", strong: false },
    "2": { label: "Strong Pro", side: "pros", strong: true },
  };
  let pcDraft = { text: "", val: 0 };
  let pcLastPct = 50;
  const pcWeight = (side) => S.pc[side].reduce((n, it) => n + (it.important ? 2 : 1), 0);
  const pcLead = (side) => {
    const diff = pcWeight(side) - pcWeight(side === "pros" ? "cons" : "pros");
    return diff > 0 ? "win" : diff < 0 ? "lose" : "";
  };
  const pcPct = () => {
    const p = pcWeight("pros"), c = pcWeight("cons");
    return p + c ? Math.round((p / (p + c)) * 100) : 50;
  };
  const pcMeter = () => {
    const p = pcWeight("pros"), c = pcWeight("cons");
    const verdict = !(p + c) ? "Add a thought below to see which way you’re leaning."
      : p > c ? "You’re leaning toward yes."
      : c > p ? "You’re leaning toward no."
      : "It’s evenly balanced right now.";
    return `
      <div class="pc-meter" data-lead="${!(p + c) ? "empty" : p > c ? "pros" : c > p ? "cons" : "even"}">
        <div class="pcm-head"><span>Pros</span><span>Cons</span></div>
        <div class="pcm-bar" role="img" aria-label="Pros ${pcPct()}%, cons ${100 - pcPct()}%">
          <div class="pcm-fill pcm-pros" style="width:${pcLastPct}%"><b>${S.pc.pros.length} (${p + c ? pcPct() : 0}%)</b></div>
          <div class="pcm-knob" aria-hidden="true"><span class="pcm-burst"><svg style="transform:rotate(${pcLastPct * 3.6}deg)"><use href="#ico-burst"/></svg></span></div>
          <div class="pcm-fill pcm-cons"><b>${S.pc.cons.length} (${p + c ? 100 - pcPct() : 0}%)</b></div>
        </div>
        <p class="pcm-verdict" aria-live="polite">${verdict}</p>
      </div>`;
  };
  const pcAdd = () => `
    <form class="pc-add" id="pcAdd">
      <label class="q" for="pcThought">Your thoughts</label>
      <textarea id="pcThought" class="pc-thought autosize" rows="1" placeholder="Write a thought about this decision..." maxlength="240">${esc(pcDraft.text)}</textarea>
      <div class="pc-classify">
      <div class="pc-scale" data-val="${pcDraft.val}">
        <input type="range" id="pcScale" min="-2" max="2" step="1" value="${pcDraft.val}" aria-label="Is this thought a pro or a con?">
        <div class="pc-ticks">
          ${["-2", "-1", "1", "2"].map((v) => `<button type="button" data-act="scale" data-val="${v}">${SCALE[v].label}</button>`).join("")}
        </div>
      </div>
      <div class="pc-add-foot">
        <p class="pc-scale-hint" id="pcHint"></p>
        <button class="btn btn-accent" type="submit" id="pcAddBtn">Add thought</button>
      </div>
      </div>
    </form>`;
  // Step-by-step reveal: decision -> thought field -> slider -> results.
  let pcOpen = { thought: false, slider: false };
  let pcShown = {};
  const pcHasItems = () => S.pc.pros.length + S.pc.cons.length > 0;
  const pcStage = () => {
    if (S.tool !== "proscons") return;
    const want = {
      "#pcAdd": pcOpen.thought || pcHasItems(),
      ".pc-classify": pcOpen.slider,
      ".pc-meter": pcHasItems(),
      ".pc": pcHasItems(),
      ".reflect": pcHasItems(),
    };
    applyStage(want, pcShown);
  };
  const pcOpenStep = (step, now) => openStep(pcOpen, step, pcStage, now);
  // Update the thought form in place (no re-render) so typing and sliding stay smooth.
  const pcSync = () => {
    const form = $("#pcAdd", body);
    if (!form) return;
    const v = SCALE[String(pcDraft.val)];
    $(".pc-scale", form).dataset.val = pcDraft.val;
    $("#pcScale", form).setAttribute("aria-valuetext", v.label || "Not chosen yet");
    $$(".pc-ticks button", form).forEach((b) => b.classList.toggle("is-on", b.dataset.val === String(pcDraft.val)));
    const hasText = pcDraft.text.trim().length > 0;
    $("#pcHint", form).textContent = !v.side
      ? "Slide to mark it as a pro or a con."
      : `This goes to ${v.side === "pros" ? "Pros" : "Cons"}${v.strong ? " as a strong reason (counts double)" : ""}.`;
    $("#pcAddBtn", form).disabled = !(hasText && v.side);
  };
  const pcCol = (side, title) => `
    <div class="pc-col" data-side="${side}"${pcLead(side) ? ` data-lead="${pcLead(side)}"` : ""}>
      <div class="pc-head"><span class="pc-badge" aria-hidden="true">${side === "pros" ? "+" : "−"}</span><h3>${title}</h3><span class="count">${S.pc[side].length}</span></div>
      <div class="dz" data-zone="${side}">${S.pc[side].map(pcCard).join("") || `<p class="dz-empty">Nothing here yet.</p>`}</div>
    </div>`;

  IMPL.proscons = {
    render() {
      body.innerHTML = `
        ${pcMeter()}
        ${pcAdd()}
        <div class="pc">
          ${pcCol("pros", "Pros")}
          ${pcCol("cons", "Cons")}
        </div>
        <div class="reflect">
          <label class="q" for="pcReflect">Looking at both sides, what stands out most?</label>
          <textarea id="pcReflect" placeholder="Write whatever comes to mind...">${esc(S.pc.reflection)}</textarea>
        </div>`;
      if (S.problem.trim()) pcOpen.thought = true;
      if (pcDraft.text.trim()) pcOpen.slider = true;
      pcShown = {};
      pcStage();
      pcSync();
      // Grow the bar from its previous split so the change is visible.
      const fill = $(".pcm-pros", body);
      const pct = pcPct();
      const burst = $(".pcm-knob svg", body);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        fill.style.width = pct + "%";
        burst.style.transform = `rotate(${pct * 3.6}deg)`;
      }));
      pcLastPct = pct;
    },
    submit(e) {
      if (e.target.id !== "pcAdd") return;
      const text = pcDraft.text.trim();
      const v = SCALE[String(pcDraft.val)];
      if (!text) { $("#pcThought", body).focus(); return; }
      if (!pcOpen.slider) { pcOpenStep("slider", true); $("#pcScale", body).focus(); return; }
      if (!v.side) {
        const scale = $(".pc-scale", body);
        scale.classList.remove("nudge");
        void scale.offsetWidth;
        scale.classList.add("nudge");
        $("#pcScale", body).focus();
        return;
      }
      S.pc[v.side].push({ id: uid(), text, important: v.strong });
      pcDraft = { text: "", val: 0 };
      pcOpen.slider = false;
      save();
      focusAfter = "#pcThought";
      renderTool();
    },
    input(e) {
      if (e.target.id === "pcReflect") { S.pc.reflection = e.target.value; save(); return; }
      if (e.target.id === "pcThought") {
        pcDraft.text = e.target.value;
        autosize(e.target);
        pcSync();
        if (pcDraft.text.trim()) pcOpenStep("slider");
        return;
      }
      if (e.target.id === "pcScale") { pcDraft.val = Number(e.target.value); pcSync(); return; }
      if (e.target.classList.contains("card-text")) {
        const card = e.target.closest(".card");
        const side = card.closest(".dz").dataset.zone;
        const it = S.pc[side].find((x) => x.id === card.dataset.id);
        if (it) { it.text = e.target.value; save(); }
        autosize(e.target);
      }
    },
    click(e) {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      if (btn.dataset.act === "scale") {
        pcDraft.val = Number(btn.dataset.val);
        $("#pcScale", body).value = pcDraft.val;
        pcSync();
        return;
      }
      const card = btn.closest(".card");
      const side = card.closest(".dz").dataset.zone;
      const list = S.pc[side];
      const i = list.findIndex((x) => x.id === card.dataset.id);
      if (i < 0) return;
      const act = btn.dataset.act;
      if (act === "del") list.splice(i, 1);
      else if (act === "up" && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
      else if (act === "down" && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
      else if (act === "swap") S.pc[side === "pros" ? "cons" : "pros"].push(list.splice(i, 1)[0]);
      save();
      renderTool();
    },
  };

  /* ---------- Eisenhower Matrix ---------- */
  const QUADS = [
    { key: "do", tag: "Important + Urgent", title: "Do it now", cls: "q-do" },
    { key: "plan", tag: "Important + Not Urgent", title: "Plan it", cls: "q-plan" },
    { key: "delegate", tag: "Not Important + Urgent", title: "Delegate or simplify", cls: "q-delegate" },
    { key: "drop", tag: "Not Important + Not Urgent", title: "Let it go", cls: "q-drop" },
  ];
  const ZONE_LABELS = { inbox: "Not sorted yet", do: "Do it now", plan: "Plan it", delegate: "Delegate or simplify", drop: "Let it go" };
  const emAll = () => Object.values(S.em.zones).reduce((n, z) => n + z.length, 0);
  const findTask = (id) => {
    for (const [zone, list] of Object.entries(S.em.zones)) {
      const it = list.find((x) => x.id === id);
      if (it) return { zone, list, it };
    }
    return null;
  };
  const taskCard = (it, zone, draggable) => `
    <div class="card task" data-id="${it.id}" ${draggable ? 'draggable="true"' : ""}>
      <span class="task-text">${esc(it.text)}</span>
      <span class="move-wrap" title="Move to…"><span aria-hidden="true">⇅</span>
        <select class="move" aria-label="Move “${esc(it.text)}” to another box">
          ${Object.entries(ZONE_LABELS).map(([k, v]) => `<option value="${k}"${k === zone ? " selected" : ""}>${v}</option>`).join("")}
        </select>
      </span>
      <button class="ic" type="button" data-act="edit" title="Edit" aria-label="Edit">✎</button>
      <button class="ic del" type="button" data-act="del" title="Delete" aria-label="Delete">×</button>
    </div>`;

  function addTasks(raw) {
    const lines = raw.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim()).filter(Boolean);
    lines.forEach((text) => S.em.zones.inbox.push({ id: uid(), text: text.slice(0, 240) }));
    save();
    return lines.length;
  }

  IMPL.eisenhower = {
    render() {
      if (S.em.stage === "collect") {
        const items = S.em.zones.inbox;
        body.innerHTML = `
          <div class="em-collect">
            <label class="q" for="emInput">What are all the things competing for your attention?</label>
            <p class="hint">Type one at a time and press Enter, or paste a whole list, one item per line.</p>
            <form class="add-row" data-em="collect">
              <textarea id="emInput" rows="2" placeholder="Add a task, request, or idea..." aria-label="Add tasks"></textarea>
              <button class="btn-add" type="submit" aria-label="Add">+</button>
            </form>
            <div class="em-list">${items.map((it) => `
              <div class="card" data-id="${it.id}"><span class="task-text">${esc(it.text)}</span>
              <button class="ic del" type="button" data-act="del" title="Delete" aria-label="Delete">×</button></div>`).join("")}</div>
            <div class="em-actions">
              <button class="btn btn-accent" type="button" data-act="sort"${items.length ? "" : " disabled"}>Sort them →</button>
              <span class="hint" style="margin:0">${items.length ? items.length + (items.length === 1 ? " thing" : " things") : "Add at least one thing to start sorting."}</span>
            </div>
          </div>`;
        return;
      }
      const z = S.em.zones;
      body.innerHTML = `
        <span class="q">Drag each task into the box where it belongs.</span>
        <p class="hint">Important = it moves you toward something that matters. Urgent = it needs attention soon.</p>
        <div class="em-wrap">
          <div class="em-tray">
            <div class="tray-head"><h3>Not sorted yet</h3><span class="count">${z.inbox.length}</span></div>
            <div class="dz" data-zone="inbox">${z.inbox.map((it) => taskCard(it, "inbox", true)).join("")}</div>
            <form class="add-row" data-em="tray">
              <input type="text" placeholder="Add another task..." aria-label="Add another task" maxlength="240" autocomplete="off">
              <button class="btn-add" type="submit" aria-label="Add">+</button>
            </form>
          </div>
          <div class="em-grid">
            <span class="axis axis-top-l">Urgent</span><span class="axis axis-top-r">Not urgent</span>
            <span class="axis axis-left-t">Important</span><span class="axis axis-left-b">Not important</span>
            ${QUADS.map((q) => `
              <section class="quad ${q.cls}">
                <header><span class="tag">${q.tag}</span><h3>${q.title}</h3></header>
                <div class="dz" data-zone="${q.key}">${z[q.key].map((it) => taskCard(it, q.key, true)).join("")}</div>
              </section>`).join("")}
          </div>
        </div>`;
    },
    submit(e) {
      const form = e.target.closest(".add-row");
      if (!form) return;
      const field = $("textarea, input", form);
      if (!field.value.trim()) return;
      addTasks(field.value);
      focusAfter = form.dataset.em === "collect" ? "#emInput" : ".add-row[data-em='tray'] input";
      renderTool();
    },
    click(e) {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      if (btn.dataset.act === "sort") {
        S.em.stage = "matrix";
        save();
        renderTool();
        return;
      }
      const card = btn.closest(".card");
      const found = findTask(card.dataset.id);
      if (!found) return;
      if (btn.dataset.act === "del") {
        found.list.splice(found.list.indexOf(found.it), 1);
        save();
        renderTool();
      } else if (btn.dataset.act === "edit") {
        startEdit(card, found.it);
      }
    },
    change(e) {
      if (!e.target.classList.contains("move")) return;
      const found = findTask(e.target.closest(".card").dataset.id);
      if (!found) return;
      moveItem(S.em.zones, found.zone, found.it.id, e.target.value, 9999);
      save();
      renderTool();
    },
  };

  function startEdit(card, item) {
    const span = $(".task-text", card);
    if (!span || $(".task-edit", card)) return;
    card.draggable = false;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "task-edit";
    input.value = item.text;
    input.maxLength = 240;
    input.setAttribute("aria-label", "Edit task");
    span.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      if (commit && input.value.trim()) item.text = input.value.trim();
      save();
      renderTool();
    };
    input.addEventListener("blur", () => finish(true));
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); finish(true); }
      if (ev.key === "Escape") finish(false);
    });
  }

  /* ---------- Decision Tree ---------- */
  const findNode = (node, id, parent = null) => {
    if (node.id === id) return { node, parent };
    for (const c of node.children) {
      const r = findNode(c, id, node);
      if (r) return r;
    }
    return null;
  };
  const treePrompt = () =>
    !(S.dt.root.text || "").trim() ? "What decision are you trying to make?"
      : S.dt.root.children.length === 0 ? "What are your main options?"
      : "What could happen if you choose each one?";
  const updateTreePrompt = () => {
    const el = $("#treePrompt");
    if (el) el.textContent = treePrompt();
  };

  function nodeHTML(node, depth) {
    const root = depth === 0;
    const text = node.text || "";
    const ph = root ? "Your decision..." : depth === 1 ? "Name this option..." : "What could happen?";
    const kids = node.children.map((c) => nodeHTML(c, depth + 1)).join("");
    const ghost =
      depth === 1 && node.children.length === 0 ? `<button class="ghost" type="button" data-act="add" data-nid="${node.id}"><span>＋</span>What could happen if you choose this?</button>`
      : "";
    const box = `
        <div class="tnode d${Math.min(depth, 3)}" data-id="${node.id}">
          <textarea class="autosize" rows="1" placeholder="${ph}" aria-label="${root ? "Your decision" : depth === 1 ? "Option" : "Outcome"}" data-nid="${node.id}" maxlength="240">${esc(text)}</textarea>
          <div class="tnode-actions">
            <button class="ic" type="button" data-act="add" data-nid="${node.id}" title="${root ? "Add an option" : "Add what could happen next"}" aria-label="${root ? "Add an option" : "Add what could happen next"}">＋</button>
            ${root ? "" : `<button class="ic del" type="button" data-act="del" data-nid="${node.id}" title="Delete" aria-label="Delete">×</button>`}
          </div>
        </div>`;
    // Root: decision on top, options side by side underneath it.
    if (root) {
      const cols = node.children.map((c) => `<div class="tcol">${nodeHTML(c, 1)}</div>`).join("");
      return `
        <div class="troot">${box}</div>
        <div class="tcols">${cols}<div class="tcol tcol-add"><button class="ghost" type="button" data-act="add" data-nid="${node.id}"><span>＋</span>Add an option</button></div></div>`;
    }
    // Options and outcomes: each column grows downward.
    return `
      <div class="trow">${box}
        ${kids || ghost ? `<div class="tchildren">${kids}${ghost}</div>` : ""}
      </div>`;
  }

  let treeObserver = null;
  let linePending = false;
  function drawLines() {
    if (linePending) return;
    linePending = true;
    requestAnimationFrame(() => {
      linePending = false;
      const tree = $("#tree", body);
      const svg = $("#treeLines", body);
      if (!tree || !svg) return;
      const tr = tree.getBoundingClientRect();
      svg.setAttribute("width", tree.scrollWidth);
      svg.setAttribute("height", tree.scrollHeight);
      let paths = "";
      // Decision -> each option column: a smooth fork from under the decision.
      const rootBox = $(".troot > .tnode", tree);
      const cols = $(".tcols", tree);
      if (rootBox && cols && !cols.hidden) {
        const rr = rootBox.getBoundingClientRect();
        const x1 = rr.left + rr.width / 2 - tr.left;
        const y1 = rr.bottom - tr.top;
        $$(".tcol > .trow > .tnode, .tcol > .ghost", tree).forEach((k) => {
          const kr = k.getBoundingClientRect();
          const x2 = kr.left + kr.width / 2 - tr.left;
          const y2 = kr.top - tr.top;
          const my = y1 + (y2 - y1) / 2;
          paths += `<path class="${k.classList.contains("ghost") ? "ghost-line" : ""}" d="M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}"/>`;
        });
      }
      $$(".trow", tree).forEach((row) => {
        const parent = row.querySelector(":scope > .tnode");
        const kids = $$(":scope > .tchildren > .trow > .tnode, :scope > .tchildren > .ghost", row);
        if (!parent || !kids.length || !parent.offsetParent) return;
        // Vertical outline: drop from under the parent, then elbow right into each child.
        const pr = parent.getBoundingClientRect();
        const indent = kids[0].getBoundingClientRect().left - pr.left;
        const x1 = pr.left + Math.min(18, indent / 2) - tr.left;
        const y1 = pr.bottom - tr.top;
        kids.forEach((k) => {
          const kr = k.getBoundingClientRect();
          const x2 = kr.left - tr.left;
          const y2 = kr.top + kr.height / 2 - tr.top;
          const r = Math.min(14, (x2 - x1) / 2, (y2 - y1) / 2);
          paths += `<path class="${k.classList.contains("ghost") ? "ghost-line" : ""}" d="M${x1} ${y1} V${y2 - r} Q${x1} ${y2} ${x1 + r} ${y2} H${x2}"/>`;
        });
      });
      svg.innerHTML = paths;
    });
  }

  // Step-by-step reveal: problem -> decision -> options.
  const dtOpen = { decision: false, options: false };
  let dtShown = {};
  const dtStage = () => {
    if (S.tool !== "tree") return;
    const hasOptions = S.dt.root.children.length > 0;
    const decision = dtOpen.decision || hasOptions || !!(S.dt.root.text || "").trim();
    const options = dtOpen.options || hasOptions;
    applyStage({
      ".tree-prompt": decision,
      ".tree-scroll": decision,
      ".tree-prompt .hint": options,
      ".tcols": options,
    }, dtShown);
    updateTreePrompt();
    drawLines();
  };
  const dtOpenStep = (step, now) => openStep(dtOpen, step, dtStage, now);

  IMPL.tree = {
    render() {
      // Older saves kept the decision in the problem field.
      if (!S.dt.root.text && S.dt.root.children.length && S.problem) S.dt.root.text = S.problem;
      body.innerHTML = `
        <div class="tree-prompt">
          <span class="q" id="treePrompt">${treePrompt()}</span>
          <p class="hint">Tap a box to edit it, then use ＋ to add what could happen next. Options sit side by side; outcomes grow down underneath each one.</p>
        </div>
        <div class="tree-scroll"><div class="tree" id="tree"><svg class="tree-lines" id="treeLines" aria-hidden="true"></svg>${nodeHTML(S.dt.root, 0)}</div></div>`;
      if (treeObserver) treeObserver.disconnect();
      if ("ResizeObserver" in window) {
        treeObserver = new ResizeObserver(drawLines);
        treeObserver.observe($("#tree", body));
      }
      $(".tree-scroll", body).addEventListener("scroll", drawLines, { passive: true });
      $(".troot", body).addEventListener("focusout", () => {
        if ((S.dt.root.text || "").trim()) dtOpenStep("options", true);
      });
      if (S.problem.trim()) dtOpen.decision = true;
      if ((S.dt.root.text || "").trim()) dtOpen.options = true;
      dtShown = {};
      dtStage();
    },
    input(e) {
      const t = e.target;
      if (!t.matches("textarea[data-nid]")) return;
      autosize(t);
      const r = findNode(S.dt.root, t.dataset.nid);
      if (r) { r.node.text = t.value; save(); }
      if (t.dataset.nid === S.dt.root.id) {
        updateTreePrompt();
        if (t.value.trim()) dtOpenStep("options");
      }
      drawLines();
    },
    click(e) {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const r = findNode(S.dt.root, btn.dataset.nid);
      if (!r) return;
      if (btn.dataset.act === "add") {
        const child = { id: uid(), text: "", children: [] };
        r.node.children.push(child);
        save();
        focusAfter = `textarea[data-nid="${child.id}"]`;
        renderTool();
        const el = $(`textarea[data-nid="${child.id}"]`, body);
        if (el) el.closest(".tnode").scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      } else if (btn.dataset.act === "del" && r.parent) {
        if (r.node.children.length && !confirm("Delete this and everything that follows it?")) return;
        r.parent.children.splice(r.parent.children.indexOf(r.node), 1);
        save();
        renderTool();
      }
    },
  };

  /* ---------- Pre-Mortem ---------- */
  const PM_STEPS = ["What went wrong", "How likely", "Prevent", "Your plan"];
  const PM_IDEAS = [
    "We underestimated the timeline.",
    "People did not understand the idea.",
    "We ran out of budget.",
    "The team lost momentum.",
  ];
  const rank = { high: 0, medium: 1, low: 2 };
  const LVL = { low: "Low", medium: "Medium", high: "High" };
  const lvlPill = (l) => `<span class="lvl lvl-${l}">${LVL[l]}</span>`;
  const sortedRisks = () => S.pm.risks.slice().sort((a, b) => rank[a.level || "medium"] - rank[b.level || "medium"]);

  function pmSteps() {
    const has = S.pm.risks.length > 0;
    return `<div class="pm-steps" role="list">${PM_STEPS.map((n, i) => `
      <button class="pm-step${i === S.pm.step ? " is-active" : ""}${i < S.pm.step ? " is-done" : ""}" type="button" role="listitem" data-act="go" data-step="${i}"${i > 0 && !has ? " disabled" : ""}><b>${i < S.pm.step ? "✓" : i + 1}</b>${n}</button>`).join("")}</div>`;
  }

  // Step-by-step reveal: problem first, then the failure scene and risks.
  const pmOpen = { start: false };
  let pmShown = {};
  const pmStage = () => {
    if (S.tool !== "premortem") return;
    applyStage({ ".pm-start": pmOpen.start }, pmShown);
  };
  const pmOpenStep = (step, now) => openStep(pmOpen, step, pmStage, now);

  IMPL.premortem = {
    render() {
      const step = S.pm.step;
      const risks = S.pm.risks;
      let html = pmSteps();

      if (step === 0) {
        const used = new Set(risks.map((r) => r.text.trim()));
        html += `
          <div class="pm-start">
          <div class="pm-scene"><p>Imagine it is six months from now and your plan failed.</p></div>
          <label class="q" for="pmInput">What went wrong?</label>
          <p class="hint">Be honest. Naming what could go wrong is how you get ahead of it.</p>
          <div class="pm-list">${risks.map((r) => `
            <div class="card" data-id="${r.id}">
              <textarea class="card-text autosize" rows="1" aria-label="What went wrong" data-rid="${r.id}" data-field="text">${esc(r.text)}</textarea>
              <div class="card-actions"><button class="ic del" type="button" data-act="del" data-rid="${r.id}" title="Delete" aria-label="Delete">×</button></div>
            </div>`).join("")}</div>
          <form class="add-row" data-pm="add" style="max-width:760px">
            <input id="pmInput" type="text" placeholder="Add something that could have gone wrong..." aria-label="Add something that could have gone wrong" maxlength="240" autocomplete="off">
            <button class="btn-add" type="submit" aria-label="Add">+</button>
          </form>
          <div class="pm-suggest" aria-label="Ideas to get started">${PM_IDEAS.filter((t) => !used.has(t)).map((t) => `<button class="chip" type="button" data-act="suggest" data-text="${esc(t)}">+ ${esc(t)}</button>`).join("")}</div>
          <div class="pm-nav"><button class="btn btn-accent" type="button" data-act="next"${risks.length ? "" : " disabled"}>Next: which are most likely? →</button></div>
          </div>`;
      } else if (step === 1) {
        html += `
          <span class="q">Which risks are most likely?</span>
          <p class="hint">A quick gut check is enough. You can always change it.</p>
          <div class="pm-list">${risks.map((r) => `
            <div class="risk-row">
              <span class="rtext">${esc(r.text)}</span>
              <div class="seg" role="group" aria-label="How likely: ${esc(r.text)}">
                ${["low", "medium", "high"].map((l) => `<button type="button" data-act="level" data-rid="${r.id}" data-level="${l}" aria-pressed="${(r.level || "medium") === l}">${LVL[l]}</button>`).join("")}
              </div>
            </div>`).join("")}</div>
          <div class="pm-nav"><button class="btn btn-ghost" type="button" data-act="back">← Back</button><button class="btn btn-accent" type="button" data-act="next">Next: what can I do about them? →</button></div>`;
      } else if (step === 2) {
        html += `
          <span class="q">What can you do now to prevent this?</span>
          <p class="hint">Small, specific actions work best. Start with the biggest risks.</p>
          <div class="pm-list">${sortedRisks().map((r) => `
            <div class="risk-card">
              <div class="rtop">${lvlPill(r.level || "medium")}<span>${esc(r.text)}</span></div>
              <textarea data-rid="${r.id}" data-field="prevent" placeholder="What could you do now to prevent this?" aria-label="What could you do now to prevent: ${esc(r.text)}">${esc(r.prevent || "")}</textarea>
            </div>`).join("")}</div>
          <div class="pm-nav"><button class="btn btn-ghost" type="button" data-act="back">← Back</button><button class="btn btn-accent" type="button" data-act="next">See my plan →</button></div>`;
      } else {
        const ranked = sortedRisks();
        const withAction = ranked.filter((r) => r.prevent && r.prevent.trim());
        const missing = ranked.length - withAction.length;
        const done = withAction.filter((r) => r.done).length;
        const BAR = { high: 100, medium: 64, low: 30 };
        html += `
          <div class="pm-chart">
            <div class="pmc-head"><h3>Your risks, ranked</h3><span>Most likely first</span></div>
            <ol class="pmc-list">${ranked.map((r, i) => {
              const l = r.level || "medium";
              const plan = r.prevent && r.prevent.trim();
              return `
              <li class="pmc-row pmc-${l}">
                <span class="pmc-rank">${i + 1}</span>
                <div class="pmc-risk">
                  <p>${esc(r.text)}</p>
                  <div class="pmc-meter">${lvlPill(l)}<span class="pmc-bar" role="img" aria-label="Likelihood: ${LVL[l]}"><span style="width:${BAR[l]}%"></span></span></div>
                </div>
                <div class="pmc-plan${plan ? "" : " is-empty"}">${plan ? esc(plan) : `No plan yet. <button class="link-btn" type="button" data-act="go" data-step="2">Add one</button>`}</div>
              </li>`;
            }).join("")}</ol>
          </div>
          <div class="pm-actions">
            <div class="pma-head"><h3>My action plan</h3>${withAction.length ? `<span class="pma-count" id="pmaCount">${done} of ${withAction.length} done</span>` : ""}</div>
            <div class="pma-body">
            ${withAction.length ? `<ul class="pma-list">${withAction.map((r) => `
              <li class="pma-item${r.done ? " is-done" : ""}">
                <label>
                  <input type="checkbox" data-done="${r.id}"${r.done ? " checked" : ""}>
                  <span class="pma-box" aria-hidden="true"></span>
                  <span class="pma-text">${esc(r.prevent)}<small>For: ${esc(r.text)}</small></span>
                </label>
              </li>`).join("")}</ul>` : `<p class="pma-empty">You haven’t written any actions yet.</p>`}
            ${missing ? `<p class="pma-missing">${missing} ${missing === 1 ? "risk doesn’t" : "risks don’t"} have an action yet. <button class="link-btn" type="button" data-act="go" data-step="2">Add ${missing === 1 ? "it" : "them"}</button></p>` : ""}
            ${withAction.length ? `<div class="pma-foot"><button class="pma-copy" type="button" data-act="copy"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg><span>Copy action plan</span></button></div>` : ""}
            </div>
          </div>
          <p class="prepared">You’ve named what could go wrong and what you’ll do about it. That’s what being prepared looks like.</p>
          <div class="pm-nav"><button class="btn btn-ghost" type="button" data-act="back">← Back</button><button class="link-btn" type="button" data-act="go" data-step="0">Add or edit risks</button></div>`;
      }
      body.innerHTML = html;
      if (S.problem.trim() || risks.length) pmOpen.start = true;
      pmShown = {};
      pmStage();
    },
    submit(e) {
      const form = e.target.closest(".add-row");
      if (!form) return;
      const input = $("input", form);
      const text = input.value.trim();
      if (!text) return;
      S.pm.risks.push({ id: uid(), text, level: null, prevent: "" });
      save();
      focusAfter = "#pmInput";
      renderTool();
    },
    change(e) {
      const box = e.target.closest("input[data-done]");
      if (!box) return;
      const r = S.pm.risks.find((x) => x.id === box.dataset.done);
      if (!r) return;
      r.done = box.checked;
      save();
      box.closest(".pma-item").classList.toggle("is-done", box.checked);
      const all = $$("input[data-done]", body);
      const count = $("#pmaCount", body);
      if (count) count.textContent = `${all.filter((b) => b.checked).length} of ${all.length} done`;
    },
    input(e) {
      const t = e.target;
      if (!t.dataset.rid) return;
      const r = S.pm.risks.find((x) => x.id === t.dataset.rid);
      if (!r) return;
      r[t.dataset.field] = t.value;
      save();
      if (t.classList.contains("autosize")) autosize(t);
    },
    click(e) {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      const go = (n) => { S.pm.step = n; save(); renderTool(); body.scrollIntoView({ behavior: "smooth", block: "start" }); };
      if (act === "del") {
        S.pm.risks = S.pm.risks.filter((x) => x.id !== btn.dataset.rid);
        if (!S.pm.risks.length) S.pm.step = 0;
        save();
        renderTool();
      } else if (act === "copy") {
        const lines = sortedRisks()
          .filter((r) => r.prevent && r.prevent.trim())
          .map((r) => `${r.done ? "[x]" : "[ ]"} ${r.prevent.trim()}\n    For: ${r.text.trim()}`);
        const title = "My action plan" + (S.problem.trim() ? ` – ${S.problem.trim()}` : "");
        const text = `${title}\n\n${lines.join("\n")}\n`;
        const label = $("span", btn);
        const done = (ok) => {
          label.textContent = ok ? "Copied!" : "Couldn’t copy";
          btn.classList.toggle("is-copied", ok);
          setTimeout(() => { label.textContent = "Copy action plan"; btn.classList.remove("is-copied"); }, 1800);
        };
        const fallback = () => {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
          document.body.appendChild(ta);
          ta.select();
          let ok = false;
          try { ok = document.execCommand("copy"); } catch (err) { /* unsupported */ }
          ta.remove();
          done(ok);
        };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => done(true), fallback);
        else fallback();
      } else if (act === "suggest") {
        S.pm.risks.push({ id: uid(), text: btn.dataset.text, level: null, prevent: "" });
        save();
        renderTool();
      } else if (act === "level") {
        const r = S.pm.risks.find((x) => x.id === btn.dataset.rid);
        if (r) { r.level = btn.dataset.level; save(); renderTool(); }
      } else if (act === "next") {
        if (S.pm.step === 0) S.pm.risks.forEach((r) => { if (!r.level) r.level = "medium"; });
        go(Math.min(S.pm.step + 1, 3));
      } else if (act === "back") go(Math.max(S.pm.step - 1, 0));
      else if (act === "go") {
        if (Number(btn.dataset.step) > 0) S.pm.risks.forEach((r) => { if (!r.level) r.level = "medium"; });
        go(Number(btn.dataset.step));
      }
    },
  };

  /* ---------- Scroll reveal ---------- */
  const revealEls = $$("[data-reveal]");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.15 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  /* ---------- Init ---------- */
  window.addEventListener("resize", () => S.tool === "tree" && drawLines());
})();
