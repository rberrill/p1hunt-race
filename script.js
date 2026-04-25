const participantInput = document.getElementById("participantInput");
const loadParticipantsBtn = document.getElementById("loadParticipantsBtn");
const resetParticipantsBtn = document.getElementById("resetParticipantsBtn");
const durationInput = document.getElementById("durationInput");
const durationValue = document.getElementById("durationValue");
const participantCountBadge = document.getElementById("participantCountBadge");
const raceStateBadge = document.getElementById("raceStateBadge");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resumeBtn = document.getElementById("resumeBtn");
const resetRaceBtn = document.getElementById("resetRaceBtn");
const timeRemaining = document.getElementById("timeRemaining");
const leaderName = document.getElementById("leaderName");
const winnerName = document.getElementById("winnerName");
const winnerDisplay = document.getElementById("winnerDisplay");
const messageBanner = document.getElementById("messageBanner");
const raceTrack = document.getElementById("raceTrack");
const emptyTrackState = document.getElementById("emptyTrackState");
const finishLine = document.querySelector(".finish-line");
const trackFrame = document.querySelector(".track-frame");

const MAX_PARTICIPANTS = 100;
const MIN_PARTICIPANTS = 2;
const IDEAL_CAR_HEIGHT = 40;
const MIN_CAR_HEIGHT = 24;
const TRACK_PADDING = 24;
const PACK_OFFSET_LIMIT = 110;
const FINISH_TRIGGER_RATIO = 0.92;
const FINISH_TRANSITION_MS = 700;
const MIN_FINISH_SWEEP_MS = 2200;
const MAX_FINISH_SWEEP_MS = 5200;
const FINISH_LINE_WIDTH = 18;

const raceState = {
  participants: [],
  racers: [],
  status: "idle",
  phase: "idle",
  animationFrame: null,
  startTimestamp: 0,
  previousFrameTimestamp: 0,
  pauseStartedAt: 0,
  pausedAccumulated: 0,
  elapsedBeforePause: 0,
  raceDurationMs: 30000,
  leaderIndex: -1,
  winnerIndex: -1,
  trackWidth: 0,
  centerX: 0,
  backgroundOffset: 0,
  finishStartTimestamp: 0,
  finishLineX: 0,
  finishSweepMs: MIN_FINISH_SWEEP_MS,
  finishLineActive: false
};

function getUiFont() {
  return "\"Arial Narrow\", \"Bahnschrift SemiCondensed\", \"Franklin Gothic Medium\", sans-serif";
}

function sanitizeNames(rawText) {
  return rawText
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .slice(0, MAX_PARTICIPANTS);
}

function createSeededRandom(seedText) {
  let seed = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    seed ^= seedText.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }

  return function seededRandom() {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hslToHex(h, s, l) {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs((2 * lightness) - 1)) * saturation;
  const huePrime = h / 60;
  const secondComponent = chroma * (1 - Math.abs((huePrime % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime >= 0 && huePrime < 1) {
    red = chroma;
    green = secondComponent;
  } else if (huePrime < 2) {
    red = secondComponent;
    green = chroma;
  } else if (huePrime < 3) {
    green = chroma;
    blue = secondComponent;
  } else if (huePrime < 4) {
    green = secondComponent;
    blue = chroma;
  } else if (huePrime < 5) {
    red = secondComponent;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondComponent;
  }

  const match = lightness - (chroma / 2);
  const toHex = (value) => Math.round((value + match) * 255).toString(16).padStart(2, "0");
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function createRacerPalette(name, index) {
  const random = createSeededRandom(`${name}-${index}`);
  const primaryHue = Math.floor(random() * 360);
  const accentHue = (primaryHue + 140 + Math.floor(random() * 100)) % 360;
  const primary = hslToHex(primaryHue, 72 + Math.floor(random() * 18), 42 + Math.floor(random() * 14));
  const accent = hslToHex(accentHue, 68 + Math.floor(random() * 22), 62 + Math.floor(random() * 18));
  const trim = hslToHex((primaryHue + 18) % 360, 20 + Math.floor(random() * 18), 12 + Math.floor(random() * 10));

  return { primary, accent, trim };
}

function setMessage(text) {
  messageBanner.textContent = text;
}

function formatDurationLabel(seconds) {
  return `${seconds}s`;
}

function formatTime(seconds) {
  return `${seconds.toFixed(1)}s`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function easeInOutCubic(value) {
  if (value < 0.5) {
    return 4 * value * value * value;
  }
  return 1 - Math.pow((-2 * value) + 2, 3) / 2;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function setRaceStatus(status) {
  raceState.status = status;
  const labels = {
    idle: "Standby",
    ready: "Grid Ready",
    running: "Green Flag",
    paused: "Red Flag",
    finished: "Checkered",
    stopped: "Aborted"
  };
  raceStateBadge.textContent = labels[status] || status;
}

function updateButtons() {
  const hasGrid = raceState.participants.length >= MIN_PARTICIPANTS;
  const isRunning = raceState.status === "running";
  const isPaused = raceState.status === "paused";

  startBtn.disabled = !hasGrid || isRunning || isPaused;
  pauseBtn.disabled = !isRunning;
  resumeBtn.disabled = !isPaused;
  resetRaceBtn.disabled = raceState.participants.length === 0;
}

function updateDurationUi() {
  const seconds = Number(durationInput.value);
  durationValue.textContent = formatDurationLabel(seconds);

  if (raceState.status === "idle" || raceState.status === "ready" || raceState.status === "stopped") {
    timeRemaining.textContent = formatTime(seconds);
  }
}

function buildGrid() {
  raceTrack.innerHTML = "";
  raceTrack.style.gridTemplateRows = "";
  raceState.racers = [];

  if (raceState.participants.length === 0) {
    emptyTrackState.classList.remove("hidden");
    participantCountBadge.textContent = "0 racers";
    leaderName.textContent = "Waiting";
    return;
  }

  emptyTrackState.classList.add("hidden");
  participantCountBadge.textContent = `${raceState.participants.length} racers`;
  raceTrack.style.gridTemplateRows = `repeat(${raceState.participants.length}, minmax(0, 1fr))`;

  const laneHeight = Math.max(14, Math.floor(raceTrack.clientHeight / raceState.participants.length));
  const carHeight = clamp(Math.round(laneHeight * 0.72), MIN_CAR_HEIGHT, IDEAL_CAR_HEIGHT);
  const carSize = Math.round(carHeight * 3.2);

  const fragment = document.createDocumentFragment();

  raceState.participants.forEach((name, index) => {
    const lane = document.createElement("div");
    lane.className = "lane";

    const racer = document.createElement("div");
    racer.className = "racer";
    racer.style.setProperty("--lane-height", `${carHeight}px`);
    racer.style.setProperty("--car-size", `${carSize}px`);

    const palette = createRacerPalette(name, index);
    racer.style.setProperty("--car-primary", palette.primary);
    racer.style.setProperty("--car-accent", palette.accent);
    racer.style.setProperty("--car-trim", palette.trim);

    racer.innerHTML = `
      <div class="racer-glow"></div>
      <div class="racer-car">
        <div class="rear-wing"></div>
        <div class="rear-wing-flap"></div>
        <div class="rear-tire rear-tire-top"></div>
        <div class="rear-tire rear-tire-bottom"></div>
        <div class="sidepod sidepod-top"></div>
        <div class="sidepod sidepod-bottom"></div>
        <div class="chassis"></div>
        <div class="spine"></div>
        <div class="engine-cover"></div>
        <div class="cockpit"></div>
        <div class="halo"></div>
        <div class="nose"></div>
        <div class="front-wing"></div>
        <div class="front-wing-flap"></div>
        <div class="front-tire front-tire-top"></div>
        <div class="front-tire front-tire-bottom"></div>
      </div>
      <div class="racer-label">${escapeHtml(name)}</div>
    `;

    lane.appendChild(racer);
    fragment.appendChild(lane);

    raceState.racers.push({
      name,
      lane,
      element: racer,
      carSize,
      screenOffset: 0,
      targetScreenOffset: 0,
      velocity: 0,
      packSeed: Math.random() * Math.PI * 2,
      paceSeed: Math.random() * Math.PI * 2,
      surgeSeed: Math.random() * Math.PI * 2,
      orderRank: index,
      finishRank: index,
      finalOffset: 0,
      finishOffset: 0,
      finishEntryOffset: 0
    });
  });

  raceTrack.appendChild(fragment);
  leaderName.textContent = raceState.participants[0];
  resetRaceVisuals();
}

function prepareRaceProfile() {
  const order = raceState.racers.map((_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }

  raceState.winnerIndex = order[0];

  const total = order.length;
  const contenderCount = Math.min(total, Math.max(3, Math.round(total * 0.22)));
  const trailingCount = Math.max(0, total - contenderCount);

  order.forEach((racerIndex, placement) => {
    const racer = raceState.racers[racerIndex];
    const isWinner = placement === 0;
    const isContender = placement < contenderCount;
    const contenderSpread = contenderCount > 1 ? placement / (contenderCount - 1) : 0;
    const trailingSpread = trailingCount > 1 ? (placement - contenderCount) / (trailingCount - 1) : 0;

    racer.orderRank = placement;
    racer.shuffleWide = 30 + (Math.random() * 18);
    racer.shuffleTight = 10 + (Math.random() * 10);
    racer.packDrift = 8 + (Math.random() * 12);
    racer.response = 7 + (Math.random() * 2.2);
    racer.breakawayStart = 0.68 + (Math.random() * 0.14);
    racer.finishWiggle = 2 + (Math.random() * 4);

    if (isWinner) {
      racer.finalOffset = 94 + (Math.random() * 12);
      racer.finishOffset = racer.finalOffset + 12;
    } else if (isContender) {
      racer.finalOffset = 70 - (contenderSpread * 46) - (Math.random() * 5);
      racer.finishOffset = racer.finalOffset + 3 - (contenderSpread * 6);
    } else {
      racer.finalOffset = 18 - (trailingSpread * 104) - (Math.random() * 8);
      racer.finishOffset = racer.finalOffset - (8 + (trailingSpread * 12));
    }

    racer.finishScore = racer.finishOffset;
  });
}

function computePackOffset(racer, elapsed, duration) {
  const t = clamp(elapsed / duration, 0, 1);
  const launch = easeOutCubic(clamp(t / 0.16, 0, 1));
  const finalBlend = easeInOutCubic(clamp((t - racer.breakawayStart) / (1 - racer.breakawayStart), 0, 1));
  const shuffleBlend = 1 - easeInOutCubic(clamp((t - 0.74) / 0.26, 0, 1));
  const shuffleA = Math.sin((t * 8.4) + racer.packSeed) * racer.shuffleWide;
  const shuffleB = Math.sin((t * 15.5) + racer.paceSeed) * racer.shuffleTight;
  const shuffleC = Math.sin((t * 24.5) + racer.surgeSeed) * (racer.shuffleTight * 0.58);
  const livingPackOffset = (shuffleA + shuffleB + shuffleC + (Math.sin((t * 3.8) + racer.packSeed) * racer.packDrift)) * shuffleBlend;
  const settledOffset = racer.finalOffset + ((shuffleA * 0.08) + (shuffleB * 0.05));
  return clamp((livingPackOffset * launch * (1 - finalBlend)) + (settledOffset * finalBlend), -PACK_OFFSET_LIMIT, PACK_OFFSET_LIMIT);
}

function computeTrackSpeed(elapsed, duration, phaseElapsed = 0) {
  const t = clamp(elapsed / duration, 0, 1);

  if (raceState.phase === "finish") {
    const blend = easeOutCubic(clamp(phaseElapsed / raceState.finishSweepMs, 0, 1));
    return 300 - (90 * blend);
  }

  return 280 + (90 * easeOutCubic(Math.min(1, t * 1.5))) + (18 * Math.sin((t * 6) + 0.4));
}

function renderTrackMotion() {
  trackFrame.style.setProperty("--scroll-offset", `${raceState.backgroundOffset}px`);
}

function renderFinishLine() {
  finishLine.style.transform = `translate3d(${raceState.finishLineX}px, 0, 0)`;
}

function hideFinishLine() {
  raceState.finishLineActive = false;
  raceState.finishLineX = raceState.trackWidth + 80;
  trackFrame.style.setProperty("--finish-opacity", "0");
  renderFinishLine();
}

function resizeTrack() {
  if (raceState.participants.length === 0) {
    return;
  }

  const trackRect = raceTrack.getBoundingClientRect();
  const sampleRacer = raceState.racers[0];

  if (!trackRect.width || !sampleRacer) {
    return;
  }

  raceState.trackWidth = trackRect.width;
  raceState.centerX = Math.max(TRACK_PADDING, Math.round((trackRect.width - sampleRacer.carSize) / 2));

  raceState.racers.forEach((racer) => {
    renderRacer(racer);
  });

  if (raceState.phase !== "finish" && raceState.status !== "finished") {
    hideFinishLine();
  } else {
    renderFinishLine();
  }

  renderTrackMotion();
}

function resetRaceVisuals() {
  raceState.phase = "idle";
  raceState.backgroundOffset = 0;
  raceState.finishStartTimestamp = 0;
  raceState.finishSweepMs = MIN_FINISH_SWEEP_MS;
  raceState.finishLineActive = false;

  raceState.racers.forEach((racer) => {
    racer.screenOffset = 0;
    racer.targetScreenOffset = 0;
    racer.velocity = 0;
    racer.element.classList.remove("is-leading", "is-winner");
    renderRacer(racer);
  });

  leaderName.textContent = raceState.participants[0] || "Waiting";
  timeRemaining.textContent = formatTime(Number(durationInput.value));
  renderTrackMotion();
  resizeTrack();
  hideFinishLine();
}

function parseParticipants() {
  const names = sanitizeNames(participantInput.value);
  raceState.participants = names;
  raceState.winnerIndex = -1;
  winnerName.textContent = "TBD";
  winnerDisplay.querySelector(".winner-value").textContent = "Awaiting finish line";

  if (names.length < MIN_PARTICIPANTS) {
    setRaceStatus("idle");
    setMessage("Load at least 2 entrants to start the race.");
  } else {
    setRaceStatus("ready");
    setMessage(`${names.length} racers locked in. Press start when the stream is ready.`);
  }

  buildGrid();
  updateButtons();
}

function startRace() {
  if (raceState.participants.length < MIN_PARTICIPANTS) {
    setMessage("At least 2 racers are required.");
    return;
  }

  cancelAnimationFrame(raceState.animationFrame);
  raceState.raceDurationMs = Number(durationInput.value) * 1000;
  raceState.startTimestamp = 0;
  raceState.previousFrameTimestamp = 0;
  raceState.pauseStartedAt = 0;
  raceState.pausedAccumulated = 0;
  raceState.elapsedBeforePause = 0;
  raceState.leaderIndex = -1;
  raceState.phase = "running";

  prepareRaceProfile();
  resetRaceVisuals();
  raceState.phase = "running";
  setRaceStatus("running");
  setMessage("Camera locked on the pack. Race is live.");
  winnerName.textContent = "TBD";
  winnerDisplay.querySelector(".winner-value").textContent = "Race in progress";
  updateButtons();
  raceState.animationFrame = requestAnimationFrame(tick);
}

function pauseRace() {
  if (raceState.status !== "running") {
    return;
  }

  raceState.pauseStartedAt = performance.now();
  setRaceStatus("paused");
  cancelAnimationFrame(raceState.animationFrame);
  setMessage("Race paused. Resume when you are ready.");
  updateButtons();
}

function resumeRace() {
  if (raceState.status !== "paused") {
    return;
  }

  const pauseDuration = performance.now() - raceState.pauseStartedAt;
  raceState.pausedAccumulated += pauseDuration;

  if (raceState.phase === "finish") {
    raceState.finishStartTimestamp += pauseDuration;
  }

  setRaceStatus("running");
  setMessage("Race resumed. Camera back on the pack.");
  updateButtons();
  raceState.animationFrame = requestAnimationFrame(tick);
}

function resetRace() {
  cancelAnimationFrame(raceState.animationFrame);
  raceState.startTimestamp = 0;
  raceState.previousFrameTimestamp = 0;
  raceState.pauseStartedAt = 0;
  raceState.pausedAccumulated = 0;
  raceState.elapsedBeforePause = 0;
  raceState.leaderIndex = -1;
  raceState.winnerIndex = -1;
  winnerName.textContent = "TBD";
  winnerDisplay.querySelector(".winner-value").textContent = "Awaiting finish line";

  setRaceStatus(raceState.participants.length >= MIN_PARTICIPANTS ? "ready" : "idle");
  resetRaceVisuals();
  setMessage(raceState.participants.length >= MIN_PARTICIPANTS
    ? "Grid reset. Press start for another camera-follow run."
    : "Load participants to build the starting grid.");
  updateButtons();
}

function resetParticipants() {
  cancelAnimationFrame(raceState.animationFrame);
  participantInput.value = "";
  raceState.participants = [];
  raceState.racers = [];
  raceState.previousFrameTimestamp = 0;
  raceTrack.innerHTML = "";
  raceTrack.style.gridTemplateRows = "";
  emptyTrackState.classList.remove("hidden");
  trackFrame.style.removeProperty("--scroll-offset");
  hideFinishLine();
  setRaceStatus("idle");
  participantCountBadge.textContent = "0 racers";
  leaderName.textContent = "Waiting";
  winnerName.textContent = "TBD";
  winnerDisplay.querySelector(".winner-value").textContent = "Awaiting finish line";
  timeRemaining.textContent = formatTime(Number(durationInput.value));
  setMessage("Entrant list cleared.");
  updateButtons();
}

function startFinishLineApproach() {
  raceState.finishLineActive = true;
  raceState.finishLineX = raceState.trackWidth + 60;
  trackFrame.style.setProperty("--finish-opacity", "1");
}

function startFinishSequence(timestamp) {
  raceState.phase = "finish";
  raceState.finishStartTimestamp = timestamp;
  raceState.finishSweepMs = clamp(
    raceState.raceDurationMs * (1 - FINISH_TRIGGER_RATIO),
    MIN_FINISH_SWEEP_MS,
    MAX_FINISH_SWEEP_MS
  );

  const ordered = [...raceState.racers]
    .map((racer, index) => ({ index, score: racer.screenOffset }))
    .sort((left, right) => right.score - left.score);

  raceState.winnerIndex = ordered[0]?.index ?? -1;
  let previousTarget = clamp((ordered[0]?.score ?? 0) + 8, -PACK_OFFSET_LIMIT, PACK_OFFSET_LIMIT + 18);

  ordered.forEach((entry, placement) => {
    const racer = raceState.racers[entry.index];
    racer.finishRank = placement;
    racer.finishEntryOffset = racer.screenOffset;

    let targetOffset;
    if (placement === 0) {
      targetOffset = previousTarget;
    } else {
      const desiredGap = 8 + Math.min(placement, 4) * 2;
      const naturalFollowOffset = racer.screenOffset + Math.max(0, 6 - placement);
      targetOffset = Math.min(naturalFollowOffset, previousTarget - desiredGap);
    }

    racer.finishOffset = clamp(targetOffset, -PACK_OFFSET_LIMIT, PACK_OFFSET_LIMIT + 18);
    racer.finishScore = racer.finishOffset;
    previousTarget = racer.finishOffset;
  });

  setMessage("Final lap. Finish line coming into frame.");
}

function updateLeader(leaderIndexValue) {
  if (raceState.leaderIndex === leaderIndexValue) {
    return;
  }

  raceState.leaderIndex = leaderIndexValue;
  leaderName.textContent = raceState.racers[leaderIndexValue]?.name || "Waiting";
  raceState.racers.forEach((racer, index) => {
    racer.element.classList.toggle("is-leading", index === leaderIndexValue && index !== raceState.winnerIndex);
  });
}

function finishRace(winningIndex = raceState.winnerIndex) {
  cancelAnimationFrame(raceState.animationFrame);
  setRaceStatus("finished");
  raceState.phase = "finished";
  const winner = raceState.racers[winningIndex];

  raceState.racers.forEach((racer, index) => {
    racer.velocity = 0;
    racer.targetScreenOffset = racer.screenOffset;
    racer.finishOffset = racer.screenOffset;
    racer.element.classList.toggle("is-leading", false);
    racer.element.classList.toggle("is-winner", index === winningIndex);
    renderRacer(racer);
  });

  raceState.winnerIndex = winningIndex;
  winnerName.textContent = winner.name;
  winnerDisplay.querySelector(".winner-value").textContent = winner.name;
  leaderName.textContent = winner.name;
  setMessage(`${winner.name} takes the flag. Winner confirmed.`);
  updateButtons();
}

function renderRacer(racer) {
  const x = raceState.centerX + racer.screenOffset;
  racer.element.style.transform = `translate3d(${x}px, -50%, 0)`;
}

function tick(timestamp) {
  if (raceState.status !== "running") {
    return;
  }

  if (!raceState.startTimestamp) {
    raceState.startTimestamp = timestamp;
    raceState.previousFrameTimestamp = timestamp;
  }

  const elapsed = timestamp - raceState.startTimestamp - raceState.pausedAccumulated;
  const deltaMs = Math.max(0, timestamp - raceState.previousFrameTimestamp);
  raceState.previousFrameTimestamp = timestamp;
  raceState.elapsedBeforePause = elapsed;
  const clampedElapsed = Math.min(elapsed, raceState.raceDurationMs);
  const deltaSeconds = Math.min(0.05, deltaMs / 1000);
  const remainingSeconds = Math.max(0, (raceState.raceDurationMs - clampedElapsed) / 1000);
  const phaseElapsed = raceState.phase === "finish" ? timestamp - raceState.finishStartTimestamp : 0;
  const trackSpeed = computeTrackSpeed(clampedElapsed, raceState.raceDurationMs, phaseElapsed);

  timeRemaining.textContent = formatTime(remainingSeconds);

  if (!raceState.finishLineActive) {
    const projectedWinner = raceState.racers[raceState.winnerIndex];
    const winnerFinishOffset = projectedWinner
      ? computePackOffset(projectedWinner, raceState.raceDurationMs, raceState.raceDurationMs)
      : 0;
    const winnerNoseX = projectedWinner
      ? raceState.centerX + Math.max(projectedWinner.screenOffset, winnerFinishOffset) + (projectedWinner.carSize * 0.8)
      : raceState.centerX;
    const remainingMs = Math.max(0, raceState.raceDurationMs - clampedElapsed);
    const projectedTravel = (remainingMs / 1000) * trackSpeed;
    const offscreenStartX = raceState.trackWidth + 60;
    const distanceToWinner = offscreenStartX - winnerNoseX;

    if (projectedTravel <= distanceToWinner) {
      startFinishLineApproach();
    }
  }

  raceState.backgroundOffset -= trackSpeed * deltaSeconds;
  renderTrackMotion();

  let leader = 0;
  let leaderScore = -Infinity;

  for (let index = 0; index < raceState.racers.length; index += 1) {
    const racer = raceState.racers[index];
    let targetOffset;
    let rankingScore;

    if (raceState.phase === "finish") {
      const settle = easeOutCubic(clamp(phaseElapsed / raceState.finishSweepMs, 0, 1));
      const handoffBlend = easeOutCubic(clamp(phaseElapsed / FINISH_TRANSITION_MS, 0, 1));
      const flutter = Math.sin((timestamp * 0.008) + racer.paceSeed) * racer.finishWiggle * (1 - settle);
      const finishTarget = racer.finishOffset + flutter;
      targetOffset = racer.finishEntryOffset + ((finishTarget - racer.finishEntryOffset) * handoffBlend);
      rankingScore = racer.finishScore;
    } else {
      targetOffset = computePackOffset(racer, clampedElapsed, raceState.raceDurationMs);
      rankingScore = targetOffset;
    }

    racer.targetScreenOffset = targetOffset;
    const gap = racer.targetScreenOffset - racer.screenOffset;
    const desiredVelocity = gap * racer.response;
    racer.velocity += (desiredVelocity - racer.velocity) * Math.min(1, racer.response * deltaSeconds);
    racer.screenOffset = clamp(
      racer.screenOffset + (racer.velocity * deltaSeconds),
      -PACK_OFFSET_LIMIT - 16,
      PACK_OFFSET_LIMIT + 24
    );

    if (rankingScore > leaderScore) {
      leaderScore = rankingScore;
      leader = index;
    }

    renderRacer(racer);
  }

  updateLeader(leader);

  if (raceState.finishLineActive) {
    raceState.finishLineX -= trackSpeed * deltaSeconds;
    renderFinishLine();
  }

  if (raceState.finishLineActive && raceState.phase === "running") {
    const projectedWinner = raceState.racers[raceState.winnerIndex];
    const winnerTriggerX = raceState.centerX + projectedWinner.screenOffset + (projectedWinner.carSize * 1.5);

    if (raceState.finishLineX <= winnerTriggerX) {
      startFinishSequence(timestamp);
    }
  }

  if (raceState.phase === "finish") {
    const winner = raceState.racers[raceState.winnerIndex];
    const winnerNoseX = raceState.centerX + winner.screenOffset + (winner.carSize * 0.8);

    if (raceState.finishLineX <= winnerNoseX) {
      finishRace(raceState.winnerIndex);
      return;
    }
  }

  raceState.animationFrame = requestAnimationFrame(tick);
}

function bindEvents() {
  loadParticipantsBtn.addEventListener("click", parseParticipants);
  resetParticipantsBtn.addEventListener("click", resetParticipants);
  durationInput.addEventListener("input", updateDurationUi);
  startBtn.addEventListener("click", startRace);
  pauseBtn.addEventListener("click", pauseRace);
  resumeBtn.addEventListener("click", resumeRace);
  resetRaceBtn.addEventListener("click", resetRace);
  window.addEventListener("resize", resizeTrack);
}

bindEvents();
updateDurationUi();
updateButtons();
