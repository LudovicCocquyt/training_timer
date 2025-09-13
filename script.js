// DOM helpers
const $                = s => document.querySelector(s);
const modeSel          = $("#mode");
const dirSel           = $("#direction");
const display          = $("#display");
const phaseEl          = $("#phase");
const meta             = $("#meta");
const startBtn         = $("#start");
// const pauseBtn         = $("#pause");
const resetBtn         = $("#reset");
const roundBtn         = $("#roundBtn");
const fullscreenBtn    = $("#fullscreen");
const overlay          = $("#overlay");
const countdownEl      = $("#countdown");
const config           = $("#config");
const forTimeMinutes   = $("#forTimeMinutes");
const pauseEveryMin    = $("#pauseEveryMin");
const pauseDurationSec = $("#pauseDurationSec");

// Inputs
const emomMinutes  = $("#emomMinutes");
const tabataWork   = $("#tabataWork");
const tabataRest   = $("#tabataRest");
const tabataCycles = $("#tabataCycles");
const amrapCap     = $("#amrapCap");

// State
let timerId        = null;
let running        = false;
let elapsed        = 0;      // seconds elapsed in current logic
let remain         = 0;      // seconds remaining in current logic
let total          = 0;      // total workout seconds for capped modes
let currentRound   = 0;
let totalRounds    = 0;
let isWork         = true;
let cyclesDone     = 0;
let splits         = [];
let isInPause      = false;
let pauseRemaining = 0;

// Utils
function fmt(sec) {
  sec = Math.max(0, sec|0);
  const m = (sec / 60) | 0;
  const s = sec % 60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
function setPhase(text, cls = "") {
  phaseEl.textContent = text;
  phaseEl.className = "phase " + cls;
}
function stop() {
  running = false;
  clearInterval(timerId);
  timerId = null;
}
function resetCommon() {
  stop();
  elapsed = 0;
  remain = 0;
  total = 0;
  currentRound = 0;
  totalRounds = 0;
  isWork = true;
  cyclesDone = 0;
  splits = [];
}

// Audio
let audioCtx, gain;
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    gain = audioCtx.createGain();
    gain.gain.value = 0.06;
    gain.connect(audioCtx.destination);
  }
}
function beep(freq=880, ms=120, type="square") {
  initAudio();
  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  osc.start();
  setTimeout(() => { try { osc.stop(); osc.disconnect(); } catch {} }, ms);
}
const shortBeep = () => beep(1200, 100, "square");
const midBeep   = () => beep(900, 150, "square");
const longBeep  = () => beep(600, 260, "square");
const hiBeep    = () => beep(1400, 140, "sine");
const lowBeep   = () => beep(500, 140, "sine");

// Countdown 10s
async function startWithCountdown(callback) {
  overlay.classList.add("show");
  for (let i = 10; i >= 1; i--) {
    countdownEl.textContent = i;
    shortBeep();
    await new Promise(r => setTimeout(r, 1000));
  }
  countdownEl.textContent = "GO";
  countdownEl.classList.add("count-go");
  longBeep();
  await new Promise(r => setTimeout(r, 500));
  countdownEl.classList.remove("count-go");
  overlay.classList.remove("show");
  callback();
}

// Show config per mode
function showConfigFor(mode) {
  document.querySelectorAll(".cfg").forEach(el => {
    const modes = (el.dataset.mode || "").split(" ");
    el.style.display = modes.includes(mode) ? "" : "none";
  });
  const amrap = mode === "AMRAP";
  roundBtn.style.display = amrap ? "" : "none";
}

// Clamp + validate
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

function initForTime() {
  resetCommon();
  const mins = parseInt(forTimeMinutes.value) || 20;
  total = mins * 60;
  isInPause = false;
  pauseRemaining = 0;

  const up = dirSel.value === "UP";

  if (up) {
    elapsed = 0;
    display.textContent = "00:00";
  } else {
    remain = total;
    display.textContent = fmt(remain);
  }

  setPhase("For Time", "emom");
  meta.textContent = `Cap: ${mins} min`;
  hideRoundBadge();
}

function tickForTime() {
  const pauseEvery = (parseInt(pauseEveryMin.value) || 5) * 60;
  const pauseDur = parseInt(pauseDurationSec.value) || 30;
  const up = dirSel.value === "UP";

  if (isInPause) {
    pauseRemaining--;
    display.textContent = fmt(pauseRemaining);
    setPhase("Pause", "rest");

    if ([3, 2, 1].includes(pauseRemaining)) shortBeep();

    if (pauseRemaining <= 0) {
      isInPause = false;
      setPhase("For Time", "emom");
      midBeep();
    }
    return;
  }

  if (up) {
    if (elapsed >= total) {
      longBeep();
      stop();
      setPhase("Terminé", "");
      return;
    }

    elapsed++;
    display.textContent = fmt(elapsed);

    if (elapsed % 60 === 0) midBeep();

    if (elapsed % pauseEvery === 0 && elapsed !== 0) {
      isInPause = true;
      pauseRemaining = pauseDur;
      setPhase("Pause", "rest");
      longBeep();
      return;
    }

    const remainTotal = total - elapsed;
    if ([5, 4, 3, 2, 1].includes(remainTotal)) shortBeep();
    meta.textContent = `Reste: ${fmt(remainTotal)}`;
  } else {
    if (remain <= 0) {
      longBeep();
      stop();
      setPhase("Terminé", "");
      return;
    }

    remain--;
    display.textContent = fmt(remain);

    const passed = total - remain;

    if (passed % 60 === 0) midBeep();

    if (passed % pauseEvery === 0 && passed !== 0) {
      isInPause = true;
      pauseRemaining = pauseDur;
      setPhase("Pause", "rest");
      longBeep();
      return;
    }

    if ([5, 4, 3, 2, 1].includes(remain)) shortBeep();
    meta.textContent = `Reste: ${fmt(remain)}`;
  }
}


// Initializers
function initEMOM() {
  resetCommon();
  const mins = parseInt($("#emomMinutes").value) || 12;
  total = mins * 60;
  totalRounds = mins;

  if (dirSel.value === "UP") {
    elapsed = 0;
    display.textContent = fmt(elapsed);
  } else {
    remain = total;
    display.textContent = fmt(remain);
  }

  setPhase("EMOM", "emom");
  meta.textContent = "—";
  // Round starts at 1
  showRoundBadge(`${computeCurrentRound(60)}:`);
}

function initE2MOM() {
  resetCommon();
  const mins = parseInt($("#emomMinutes").value) || 12;
  total = mins * 60;
  totalRounds = Math.floor(mins / 2);

  if (dirSel.value === "UP") {
    elapsed = 0;
    display.textContent = fmt(elapsed);
  } else {
    remain = total;
    display.textContent = fmt(remain);
  }

  setPhase("E2MOM", "emom");
  meta.textContent = "—";
  // Round starts at 1 within 120s intervals
  showRoundBadge(`${computeCurrentRound(120)}:`);
}


function initTabata() {
  resetCommon();
  const w = clamp(parseInt(tabataWork.value || "20"), 5, 300);
  const r = clamp(parseInt(tabataRest.value || "10"), 5, 300);
  const c = clamp(parseInt(tabataCycles.value || "8"), 1, 50);
  totalRounds = c;
  total = c * (w + r);
  isWork = true; cyclesDone = 0;
  if (dirSel.value === "UP") {
    elapsed = 0; // phase elapsed
    display.textContent = fmt(elapsed);
  } else {
    remain = w; // phase remain
    display.textContent = fmt(remain);
  }
  setPhase("WORK", "work");
  hideRoundBadge();
  meta.textContent = `Cycle: 0 / ${totalRounds}`;
}

function initAMRAP() {
  resetCommon();
  const capMin = clamp(parseInt(amrapCap.value || "20"), 0, 240);
  total = capMin ? capMin * 60 : 0;
  if (dirSel.value === "DOWN" && total === 0) {
    dirSel.value = "UP"; // force UP if no cap and DOWN chosen
  }
  if (dirSel.value === "UP") {
    elapsed = 0;
    display.textContent = "00:00";
  } else {
    remain = total;
    display.textContent = fmt(remain);
  }
  setPhase("AMRAP", "");
  hideRoundBadge();
  meta.textContent = total ? `Cap: ${capMin} min` : "Cap: illimité";
}

function tickEMOM() {
  const up = dirSel.value === "UP";
  const interval = 60;

  if (up) {
    if (elapsed >= total) { longBeep(); stop(); setPhase("Terminé"); return; }
    elapsed++;

    if (elapsed % interval === 0) { currentRound++; midBeep(); }

    const secInRound = elapsed % interval;
    if ([interval-5, interval-4, interval-3, interval-2, interval-1].includes(secInRound)) shortBeep();

    display.textContent = fmt(elapsed);
  } else {
    if (remain <= 0) { longBeep(); stop(); setPhase("Terminé"); return; }
    remain--;

    const passed = total - remain;

    if (passed % interval === 0) { currentRound++; midBeep(); }

    const secInRound = passed % interval;
    if ([interval-5, interval-4, interval-3, interval-2, interval-1].includes(secInRound)) shortBeep();

    display.textContent = fmt(remain);
  }

  setPhase("EMOM", "emom");
  showRoundBadge(`${computeCurrentRound(interval)}:`);
  meta.textContent = "—";
}

function tickE2MOM() {
  const up = dirSel.value === "UP";
  const interval = 120;

  if (up) {
    if (elapsed >= total) { longBeep(); stop(); setPhase("Terminé"); return; }
    elapsed++;

    if (elapsed % interval === 0) { currentRound++; midBeep(); }

    const secInRound = elapsed % interval;
    if ([interval-5, interval-4, interval-3, interval-2, interval-1].includes(secInRound)) shortBeep();

    display.textContent = fmt(elapsed);
  } else {
    if (remain <= 0) { longBeep(); stop(); setPhase("Terminé"); return; }
    remain--;

    const passed = total - remain;

    if (passed % interval === 0) { currentRound++; midBeep(); }

    const secInRound = passed % interval;
    if ([interval-5, interval-4, interval-3, interval-2, interval-1].includes(secInRound)) shortBeep();

    display.textContent = fmt(remain);
  }

  setPhase("E2MOM", "emom");
  showRoundBadge(`${computeCurrentRound(interval)}:`);
  meta.textContent = "—";
}



function tickTabata() {
  const w = parseInt($("#tabataWork").value) || 20;
  const r = parseInt($("#tabataRest").value) || 10;
  const up = dirSel.value === "UP";

  if (up) {
    elapsed++;
    const phaseDur = isWork ? w : r;
    const remainPhase = phaseDur - elapsed;
    if ([4,3,2,1].includes(remainPhase)) shortBeep();
    display.textContent = fmt(elapsed);
    if (elapsed >= phaseDur) {
      if (isWork) {
        isWork = false;
        elapsed = 0;
        setPhase("REST", "rest");
        midBeep();
      } else {
        cyclesDone++;
        if (cyclesDone >= totalRounds) return stop();
        isWork = true;
        elapsed = 0;
        setPhase("WORK", "work");
        midBeep();
      }
    }
  } else {
    if ([4,3,2,1].includes(remain)) shortBeep();
    remain--;
    display.textContent = fmt(remain);
    if (remain <= 0) {
      if (isWork) {
        isWork = false;
        remain = r;
        setPhase("REST", "rest");
        midBeep();
      } else {
        cyclesDone++;
        if (cyclesDone >= totalRounds) return stop();
        isWork = true;
        remain = w;
        setPhase("WORK", "work");
        midBeep();
      }
    }
  }
  meta.textContent = `Cycle: ${currentCycle} / ${totalRounds}`;
}

function tickAMRAP() {
  const up = dirSel.value === "UP";
  if (up) {
    elapsed++;
    display.textContent = fmt(elapsed);
    if (total) {
      const remainLocal = total - elapsed;
      if ([6,5,4,3,2,1].includes(remainLocal)) shortBeep();
      if (remainLocal <= 0) { longBeep(); stop(); setPhase("Terminé"); return; }
      meta.textContent = `Rounds: ${splits.length} • Reste: ${fmt(remainLocal)}`;
    } else {
      if (elapsed > 0 && elapsed % 60 === 0) midBeep();
      meta.textContent = `Rounds: ${splits.length} • Sans cap`;
    }
  } else {
    if (remain <= 0) { longBeep(); stop(); setPhase("Terminé"); return; }
    remain--;
    display.textContent = fmt(remain);
    if ([3,2,1].includes(remain)) shortBeep();
    meta.textContent = `Rounds: ${splits.length} • Reste: ${fmt(remain)}`;
  }
  setPhase("AMRAP", "");
}

// Controls
function start() {
  if (running) return;
  running = true;
  const mode = modeSel.value;

  startWithCountdown(() => {
    if (mode === "EMOM") {
      if (!total) initEMOM();
      timerId = setInterval(tickEMOM, 1000);
      midBeep();
    } else if (mode === "E2MOM") {
      if (!total) initE2MOM();
      timerId = setInterval(tickE2MOM, 1000);
      midBeep();
    } else if (mode === "TABATA") {
      if (!totalRounds) initTabata();
      timerId = setInterval(tickTabata, 1000);
      hiBeep();
    } else if (mode === "FORTIME") {
        initForTime();
        timerId = setInterval(tickForTime, 1000);
        midBeep();
    } else if (mode === "AMRAP") {
      const capMin = parseInt(amrapCap.value || "0");
      if (dirSel.value === "DOWN" && capMin === 0) {
        alert("AMRAP en mode descendant nécessite un cap.");
        reset();
        return;
      }
      if (!total && dirSel.value === "UP") initAMRAP();
      timerId = setInterval(tickAMRAP, 1000);
      midBeep();
    }
  });
}

// function pause() {
//   running = false;
//   clearInterval(timerId);
//   timerId = null;
//   setPhase("Pause", "");
// }

function reset() {
  stop();
  const mode = modeSel.value;
  if (mode === "EMOM") initEMOM();
  if (mode === "E2MOM") initE2MOM();
  if (mode === "TABATA") initTabata();
  if (mode === "AMRAP") initAMRAP();
  if (mode === "FORTIME") initForTime();
}

function roundPlus() {
  if (modeSel.value !== "AMRAP") return;
  if (!running) return;
  const t = (dirSel.value === "UP") ? elapsed : (total - remain);
  splits.push(t);
  midBeep();
}

// Events
modeSel.addEventListener("change", () => { showConfigFor(modeSel.value); reset(); });
dirSel.addEventListener("change", () => { reset(); });
[emomMinutes, tabataWork, tabataRest, tabataCycles, amrapCap].forEach(inp => {
  inp.addEventListener("input", () => { reset(); });
});

startBtn.addEventListener("click", start);
// pauseBtn.addEventListener("click", pause);
resetBtn.addEventListener("click", reset);
roundBtn.addEventListener("click", roundPlus);

fullscreenBtn.addEventListener("click", () => {
  const el = document.documentElement;
  const timerCard = document.querySelector(".card:nth-of-type(2)"); // le bloc du timer
  const fullscreenBtn = document.querySelector("#fullscreen"); // btn fullscreen
  if (!document.fullscreenElement) {
    el.requestFullscreen?.()
    config.style.display = "none";
    dirSel.style.display = "none";
    modeSel.style.display = "none";
    timerCard.classList.add("fullscreen");
    fullscreenBtn.classList.add("fullscreen");
  } else {
    document.exitFullscreen?.();
    config.style.display = "";
    dirSel.style.display = "";
    modeSel.style.display = "";
    timerCard.classList.remove("fullscreen");
    fullscreenBtn.classList.remove("fullscreen");
  }
//   !document.fullscreenElement ? el.requestFullscreen?.() : document.exitFullscreen?.();
});

document.addEventListener("keydown", (e) => {
  // if (e.code === "Space") { e.preventDefault(); running ? pause() : start(); }
  // if (e.key.toLowerCase() === "r") reset();
  // if (e.key.toLowerCase() === "f") {
    // const el = document.documentElement;
    // !document.fullscreenElement ? el.requestFullscreen?.() : document.exitFullscreen?.();
  // }
  // if (e.key.toLowerCase() === "l") roundPlus();
});

function showRoundBadge(text) {
  roundBadge.style.display = "";
  roundBadge.textContent = text;
}
function hideRoundBadge() {
  roundBadge.style.display = "none";
  roundBadge.textContent = "";
}
/* Compute current round index (1-based) inside a repeating interval (sec) */
function computeCurrentRound(intervalSec) {
  const up = dirSel.value === "UP";
  if (up) {
    // elapsed increases from 0 upward
    return Math.min(0 + Math.floor(elapsed / intervalSec), Math.max(1, totalRounds || Infinity));
  } else {
    // passed time increases from 0 upward even in DOWN mode
    const passed = total - remain;
    return Math.min(0 + Math.floor(passed / intervalSec), Math.max(1, totalRounds || Infinity));
  }
}

// Boot
showConfigFor(modeSel.value);
initEMOM();
