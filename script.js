// ------------------ GLOBAL DATA & ROLES ------------------ //
const creatures = [
  "Aswang",
  "Mananangal",
  "Mangkukulam",
  "Kapre",
  "Tikbalang",
  "Tiktik",
  "Duwende",
  "Tiyanak"
];

const villagersWithAbilities = [
  "Manunugis",
  "Albularyo",
  "Bagani",
  "Mang-aanting",
  "Babaylan",
  "Kapitan",
  "Kampanero", // Bell Keeper equivalent
];

const roleDistribution = {
  6: { creatures: 1, abilities: 3, villagers: 2 },
  7: { creatures: 1, abilities: 2, villagers: 4 },
  8: { creatures: 2, abilities: 3, villagers: 3 },
  9: { creatures: 2, abilities: 3, villagers: 4 },
  10: { creatures: 3, abilities: 4, villagers: 3 },
  11: { creatures: 3, abilities: 4, villagers: 4 },
  12: { creatures: 4, abilities: 4, villagers: 4 }
};

// Game state stored in localStorage between pages
let players = []; // [{id, role, alive, actions:[], status:{cursed, silenced, protected, exposedToSpy, lockedOut}, cooldowns:{lastUsedDay, protectedHistory:[]}}]
let currentDay = 1;
let turnIndex = 0; // index into alivePlayers for night turn
let nightActions = []; // accumulate actions for this night
let globalFlags = {}; // e.g., lockdown, blockHumanAbilities, babaylanBlocked, bellForcedVote

// ------------------ UTILITIES ------------------ //
function saveState() {
  localStorage.setItem("players", JSON.stringify(players));
  localStorage.setItem("currentDay", currentDay.toString());
  localStorage.setItem("turnIndex", turnIndex.toString());
  localStorage.setItem("nightActions", JSON.stringify(nightActions));
  localStorage.setItem("globalFlags", JSON.stringify(globalFlags));
}

function loadState() {
  players = JSON.parse(localStorage.getItem("players") || "[]");
  currentDay = parseInt(localStorage.getItem("currentDay") || "1");
  turnIndex = parseInt(localStorage.getItem("turnIndex") || "0");
  nightActions = JSON.parse(localStorage.getItem("nightActions") || "[]");
  globalFlags = JSON.parse(localStorage.getItem("globalFlags") || "{}");
}

// shuffle helper (Fisher–Yates)
function shuffleArray(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isCreature(role) {
  return creatures.includes(role);
}

// check per-role timing
function canUseThisNight(role) {
  // returns true if role may act this night based on currentDay rules
  // Many roles act on even nights (every other night: nights 2,4,6...)
  if (["Aswang","Mananangal","Mangkukulam","Kapre","Tikbalang","Tiktik","Duwende","Manunugis","Bagani","Mang-aanting","Babaylan","Albularyo","Kampanero"].includes(role)) {
    // these are "every other night" or every-two type. We'll use even nights for "every other night" behavior.
    // Albularyo is every two nights per original description => require even nights
    return currentDay % 2 === 0;
  }
  if (role === "Kapitan") {
    // once every three nights: acts on days divisible by 3
    return currentDay % 3 === 0;
  }
  return true;
}

function getAlivePlayers() {
  return players.filter(p => p.alive);
}

function getPlayerById(id) {
  return players.find(p => p.id === id);
}

// ------------------ LOBBY & ASSIGN ------------------ //
function createLobby() {
  const maxPlayers = parseInt(document.getElementById("maxPlayers").value);
  if (!roleDistribution[maxPlayers]) {
    alert("Player count must be between 6 and 12.");
    return;
  }

  const { creatures: cCount, abilities: aCount, villagers: vCount } = roleDistribution[maxPlayers];

  // distribution display
  const summary = `[${maxPlayers} Players]<br>` +
    `Creature - ${cCount} ${cCount > 1 ? "Creatures" : "Creature"}<br>` +
    `Villager with abilities - ${aCount} players<br>` +
    `Normal Villager - ${vCount} players`;

  document.getElementById("lobby").style.display = "block";
  document.getElementById("distribution").innerHTML = summary;

  // build roles pool
  let roles = [];
  roles = roles.concat(shuffleArray([...creatures]).slice(0, cCount));
  roles = roles.concat(shuffleArray([...villagersWithAbilities]).slice(0, aCount));
  roles = roles.concat(Array(vCount).fill("Normal Villager"));
  roles = shuffleArray(roles);

  players = roles.map((role, idx) => ({
    id: idx + 1,
    role,
    alive: true,
    actions: [], // history of actions
    status: {
      cursed: false,
      silenced: false,
      protected: false,
      spyExposed: false,
      lockdowned: false // not used heavily
    },
    cooldowns: {
      lastUsedDay: null,
      protectedHistory: [] // for Bagani to prevent protecting same player multiple times
    }
  }));

  // display assigned roles
  const playerList = document.getElementById("playerList");
  playerList.innerHTML = "";
  players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `Player ${p.id}: ${p.role}`;
    playerList.appendChild(li);
  });

  // reset game state
  currentDay = 1;
  turnIndex = 0;
  nightActions = [];
  globalFlags = {};
  saveState();
}

function startGame() {
  // ensure players saved
  saveState();
  window.location.href = "night.html";
}

// ------------------ NIGHT PAGE LOGIC ------------------ //
function initNightPage() {
  loadState();
  document.getElementById("dayNumber").innerText = currentDay;
  // reset night-specific flags
  globalFlags.lockdown = false;
  globalFlags.blockHumanAbilities = false;
  globalFlags.babaylanBlocked = false;
  globalFlags.bellForcedVote = false;
  globalFlags.douwendeUsedBy = null;
  nightActions = [];
  saveState();
  // start nightly turns
  turnIndex = 0;
  saveState();
  renderNightTurn();
}

function renderNightTurn() {
  loadState();
  const alive = getAlivePlayers();
  // if nobody alive or no players, go to day immediately
  if (alive.length === 0) {
    window.location.href = "day.html";
    return;
  }

  // If all alive players had their turn this night, resolve night
  if (turnIndex >= alive.length) {
    // persist collected actions and resolve
    localStorage.setItem("nightActions", JSON.stringify(nightActions));
    resolveNightActions();
    return;
  }

  const player = alive[turnIndex];
  document.getElementById("playerTurn").innerText = `Player ${player.id} (${player.role}) — choose action`;

  const actionUI = document.getElementById("actionUI");
  actionUI.innerHTML = "";

  // If role cannot act this night due to schedule, show skip only
  if (!canUseThisNight(player.role)) {
    actionUI.innerHTML = "<p>You cannot use your ability this night. (Timing)</p>";
    const skipBtn = document.createElement("button");
    skipBtn.innerText = "Skip";
    skipBtn.onclick = () => {
      turnIndex++;
      saveState();
      renderNightTurn();
    };
    actionUI.appendChild(skipBtn);
    return;
  }

  // If silenced status (from previous night), they can only vote (handled in day), but at night they can still act unless specific
  // Build available actions based on role and current flags
  const availableTargets = getAlivePlayers().filter(t => t.id !== player.id);

  // Helper to add target-button actions
  function addTargetButtons(actionName, labelPrefix) {
    availableTargets.forEach(t => {
      const btn = document.createElement("button");
      btn.innerText = `${labelPrefix} Player ${t.id}`;
      btn.onclick = () => {
        nightActions.push({
          actor: player.id,
          role: player.role,
          action: actionName,
          target: t.id,
          day: currentDay
        });
        player.actions.push({ day: currentDay, action: actionName, target: t.id });
        player.cooldowns.lastUsedDay = currentDay;
        saveState();
        // some abilities force immediate voting (Bell Keeper)
        if (actionName === "forceVote") {
          globalFlags.bellForcedVote = true;
          saveState();
          // proceed to resolve night immediately
          resolveNightActions();
        } else {
          turnIndex++;
          saveState();
          renderNightTurn();
        }
      };
      actionUI.appendChild(btn);
    });
  }

  // Add action options per role
  switch (player.role) {
    // ---------- CREATURES ---------- //
    case "Aswang":
      // kills every other night (we enforced canUseThisNight above)
      addTargetButtons("kill", "Kill");
      break;

    case "Mananangal":
      // can kill OR reveal (choose only 1)
      addTargetButtons("kill", "Kill");
      addTargetButtons("reveal_hint", "Reveal hint on");
      break;

    case "Mangkukulam":
      addTargetButtons("curse", "Curse");
      break;

    case "Kapre":
      // cancels Babaylan's ability for 1 night (global)
      addTargetButtons("cancel_babaylan", "Cancel Babaylan (global)");
      break;

    case "Tikbalang":
      addTargetButtons("scare", "Scare (silence next day)");
      break;

    case "Tiktik":
      addTargetButtons("spy_check", "Spy (check if has ability)");
      break;

    case "Duwende":
      addTargetButtons("block_humans", "Block human abilities");
      break;

    case "Tiyanak":
      // no night action listed, but could be passive
      actionUI.innerHTML = "<p>Tiyanak has no night action. Its effect triggers if killed or voted.</p>";
      break;

    // ---------- VILLAGERS ---------- //
    case "Manunugis":
      addTargetButtons("attack", "Attack");
      break;

    case "Albularyo":
      addTargetButtons("heal", "Heal/Protect");
      // allow self-protect as option too
      const btnSelfHeal = document.createElement("button");
      btnSelfHeal.innerText = "Heal/Protect Self";
      btnSelfHeal.onclick = () => {
        nightActions.push({
          actor: player.id, role: player.role, action: "heal", target: player.id, day: currentDay
        });
        player.actions.push({ day: currentDay, action: "heal", target: player.id });
        player.cooldowns.lastUsedDay = currentDay;
        saveState();
        turnIndex++;
        renderNightTurn();
      };
      actionUI.appendChild(btnSelfHeal);
      break;

    case "Bagani":
      // cannot protect self, may protect each player only once
      availableTargets.forEach(t => {
        const alreadyProtected = player.cooldowns.protectedHistory.includes(t.id);
        const btn = document.createElement("button");
        btn.innerText = `Protect Player ${t.id}${alreadyProtected ? " (used before)" : ""}`;
        btn.disabled = alreadyProtected;
        btn.onclick = () => {
          nightActions.push({ actor: player.id, role: player.role, action: "bagani_protect", target: t.id, day: currentDay });
          player.actions.push({ day: currentDay, action: "bagani_protect", target: t.id });
          player.cooldowns.lastUsedDay = currentDay;
          player.cooldowns.protectedHistory.push(t.id);
          saveState();
          turnIndex++;
          renderNightTurn();
        };
        actionUI.appendChild(btn);
      });
      break;

    case "Mang-aanting":
      addTargetButtons("anti_spy_protect", "Protect from spy");
      break;

    case "Babaylan":
      addTargetButtons("reveal_exact", "Reveal exact role");
      break;

    case "Kapitan":
      const btnLock = document.createElement("button");
      btnLock.innerText = "Lockdown (prevent kills this night)";
      btnLock.onclick = () => {
        nightActions.push({ actor: player.id, role: player.role, action: "lockdown", target: null, day: currentDay });
        player.actions.push({ day: currentDay, action: "lockdown", target: null });
        player.cooldowns.lastUsedDay = currentDay;
        saveState();
        turnIndex++;
        renderNightTurn();
      };
      actionUI.appendChild(btnLock);
      break;

    case "Kampanero":
      // Bell Keeper equivalent: skip discussion and force immediate voting
      addTargetButtons("forceVote", "Force Vote (choose target to highlight)");
      break;

    case "Normal Villager":
      actionUI.innerHTML = "<p>Normal Villager — you can only skip.</p>";
      break;

    default:
      actionUI.innerHTML = "<p>No actions available.</p>";
  }

  // Always add a Skip button if not forced
  const skip = document.createElement("button");
  skip.innerText = "Skip";
  skip.onclick = () => {
    // register skip (optional)
    nightActions.push({ actor: player.id, role: player.role, action: "skip", target: null, day: currentDay });
    player.actions.push({ day: currentDay, action: "skip", target: null });
    player.cooldowns.lastUsedDay = currentDay;
    saveState();
    turnIndex++;
    renderNightTurn();
  };
  actionUI.appendChild(skip);
}

// For debugging/testing
function forceSkip() {
  loadState();
  turnIndex++;
  saveState();
  renderNightTurn();
}

// ------------------ RESOLVE NIGHT ACTIONS ------------------ //
function resolveNightActions() {
  // Gather actions from local nightActions
  loadState();
  nightActions = JSON.parse(localStorage.getItem("nightActions") || JSON.stringify(nightActions));
  // First: process global flags produced by actions (Kapitan lockdown, Duwende, Kapre, Bell Keeper)
  globalFlags.lockdown = false;
  globalFlags.blockHumanAbilities = false;
  globalFlags.babaylanBlocked = false;
  globalFlags.bellForcedVote = false;
  globalFlags.douwendeUsedBy = null;

  // scan actions to set flags early
  nightActions.forEach(act => {
    if (!act) return;
    if (act.action === "lockdown") globalFlags.lockdown = true;
    if (act.action === "block_humans") { globalFlags.blockHumanAbilities = true; globalFlags.douwendeUsedBy = act.actor; }
    if (act.action === "cancel_babaylan") globalFlags.babaylanBlocked = true;
    if (act.action === "forceVote") globalFlags.bellForcedVote = true;
  });

  // Track temporary per-night protections and outcomes
  let deaths = []; // ids to die
  let notes = [];

  // Resolve reveals and spies first (no kills)
  nightActions.forEach(act => {
    const actor = getPlayerById(act.actor);
    if (!actor || !actor.alive) return;

    // If Duwende blocked human abilities and actor is human (not creature), block unless target immunity
    const actorIsCreature = isCreature(actor.role);
    if (globalFlags.blockHumanAbilities && !actorIsCreature) {
      // except Mang-aanting actions are allowed (per rules)
      if (actor.role !== "Mang-aanting") {
        notes.push(`Player ${actor.id} (${actor.role})'s action was blocked by Duwende.`);
        return; // action fails
      }
    }

    // Kapitan lockdown prevents kill actions
    if (globalFlags.lockdown && ["kill","attack","mananangal_kill"].includes(act.action)) {
      notes.push(`Player ${actor.id} (${actor.role}) attempted a kill but Kapitan's lockdown prevented it.`);
      return;
    }

    switch (act.action) {
      case "reveal_hint":
        // Mananangal reveals a hint: either skill vs normal villager
        const target = getPlayerById(act.target);
        if (!target) break;
        // Leave a hint text: "target has a special ability" or "likely normal"
        const hint = isCreature(target.role) ? "suspected CREATURE" : (villagersWithAbilities.includes(target.role) ? "has an ability" : "likely normal villager");
        notes.push(`Mananangal hint: Player ${target.id} is ${hint}.`);
        break;

      case "spy_check":
        {
          const t = getPlayerById(act.target);
          if (!t) break;
          // Tiktik learns whether target has special ability or normal (not exact role)
          if (t.role === "Normal Villager") {
            notes.push(`Tiktik found Player ${t.id} is a Normal Villager (no special ability).`);
          } else if (villagersWithAbilities.includes(t.role) || creatures.includes(t.role)) {
            notes.push(`Tiktik found Player ${t.id} has a special ability or is a creature.`);
          }
          // mark spy info (but not exact role)
        }
        break;

      case "reveal_exact":
        {
          // Babaylan reveal, but check if babaylanBlocked
          if (globalFlags.babaylanBlocked) {
            notes.push(`Babaylan's reveal was cancelled by Kapre.`);
            break;
          }
          const targ = getPlayerById(act.target);
          if (!targ) break;
          // if target is Mang-aanting and actor is not allowed to spy, Mang-aanting is immune to spying
          if (targ.role === "Mang-aanting") {
            notes.push(`Babaylan tried to reveal Player ${targ.id}, but Mang-aanting is immune to revealing.`);
          } else {
            notes.push(`Babaylan revealed Player ${targ.id} is ${targ.role}.`);
          }
        }
        break;

      case "anti_spy_protect":
        {
          const t = getPlayerById(act.target);
          if (!t) break;
          t.status.spyProtected = true; // prevents reveals/spies this night
          notes.push(`Player ${t.id} is protected from spying tonight by Mang-aanting.`);
        }
        break;

      case "cancel_babaylan":
        notes.push(`Kapre's presence cancelled Babaylan abilities for this night.`);
        break;

      case "block_humans":
        notes.push(`Duwende blocks many human abilities for this night.`);
        break;

      case "scare":
        {
          const t = getPlayerById(act.target);
          if (!t) break;
          t.status.silenced = true; // silenced for next day (can't speak)
          notes.push(`Player ${t.id} was scared by Tikbalang and will be silenced tomorrow.`);
        }
        break;

      case "curse":
        {
          const t = getPlayerById(act.target);
          if (!t) break;
          t.status.cursed = true;
          // record who cursed for potential Mangkukulam death logic
          t._cursedByThisNight = act.actor;
          notes.push(`Player ${t.id} was cursed by Mangkukulam.`);
        }
        break;

      case "heal":
        {
          const t = getPlayerById(act.target);
          if (!t) break;
          // Albularyo protects (also nullifies curse and silence)
          t.status.protected = true;
          t.status.cursed = false;
          t.status.silenced = false;
          notes.push(`Player ${t.id} was healed/protected by Albularyo.`);
        }
        break;

      case "bagani_protect":
        {
          const t = getPlayerById(act.target);
          if (!t) break;
          t.status.protected = true;
          notes.push(`Player ${t.id} was protected by Bagani.`);
        }
        break;

      case "anti_spy_protect":
        // handled above
        break;

      case "lockdown":
        // applied as global flag earlier
        notes.push(`Kapitan activated a lockdown preventing kills this night.`);
        break;

      case "forceVote":
        // Bell Keeper triggered; we'll note and later force immediate voting
        notes.push(`Bell Keeper forced immediate voting tonight (action by Player ${act.actor}).`);
        break;

      // kills & attacks collected — handle after protections applied
    }
  });

  // Second pass: resolve kills/attacks (after protections and blocks determined)
  // Note: kills are "kill" (Aswang, Mananangal kill), "attack" (Manunugis)
  // We'll iterate kill-like actions and apply protections & special counters like Tiyanak
  const killActions = nightActions.filter(a => ["kill", "attack"].includes(a.action) || (a.action === "mananangal_kill" || a.action === "mananangal_kill_alt" ));
  // Also if Mananangal used "kill" it was recorded as "kill" already earlier.

  nightActions.forEach(act => {
    const actor = getPlayerById(act.actor);
    if (!actor || !actor.alive) return;

    // blocked by Duwende? handled earlier for non-creatures; kills by creatures still go
    if (globalFlags.lockdown) {
      // prevented, already added note earlier.
      return;
    }

    if (["kill","attack"].includes(act.action)) {
      const victim = getPlayerById(act.target);
      if (!victim || !victim.alive) return;

      // If victim protected, kill nullified
      if (victim.status.protected) {
        notes.push(`Player ${victim.id} was targeted by Player ${actor.id} (${actor.role}) but was protected.`);
        return;
      }

      // If victim has Bagani/Albularyo effect, handled above via protected
      // Otherwise they die
      victim.alive = false;
      deaths.push(victim.id);
      notes.push(`Player ${actor.id} (${actor.role}) killed Player ${victim.id} (${victim.role}).`);

      // If victim is Tiyanak, Tiyanak drags killer down with it
      if (victim.role === "Tiyanak") {
        if (actor && actor.alive) {
          actor.alive = false;
          deaths.push(actor.id);
          notes.push(`Tiyanak dragged Player ${actor.id} down with it!`);
        }
      }
    }
  });

  // Mangkukulam curse resolution: If cursed and not healed, they die now, except if Mangkukulam eliminated the same day (voting) — that'll be handled after voting; for now apply cursed deaths
  players.forEach(p => {
    if (p.status.cursed && p.alive) {
      // if protected (healed by Albularyo) we already cleared cursed; otherwise mark to die
      if (!p.status.protected) {
        p.alive = false;
        deaths.push(p.id);
        notes.push(`Player ${p.id} died from Mangkukulam's curse.`);
        // Tiyanak revenge?
        if (p.role === "Tiyanak") {
          // No direct killer here to drag; skip
        }
      } else {
        // protected by Albularyo: survived
        notes.push(`Player ${p.id} was cursed but healed/protected and survived.`);
      }
    }
  });

  // Save final state
  saveState();

  // Write results to a "resolvedNight" object in storage for day page to show
  const resolvedNight = {
    day: currentDay,
    notes,
    deaths: Array.from(new Set(deaths)), // unique
    nightActions
  };

  localStorage.setItem("resolvedNight", JSON.stringify(resolvedNight));

  // If Bell Keeper forced immediate voting, go to vote now
  if (globalFlags.bellForcedVote) {
    saveState();
    window.location.href = "vote.html";
    return;
  }

  // otherwise proceed to day page
  saveState();
  window.location.href = "day.html";
}

// ------------------ DAY PAGE LOGIC ------------------ //
function initDayPage() {
  loadState();
  document.getElementById("dayNumDisplay").innerText = currentDay;
  const resolved = JSON.parse(localStorage.getItem("resolvedNight") || "{}");
  let summaryHtml = `<h3>Night ${currentDay} Notes</h3>`;

  if (resolved && resolved.notes && resolved.notes.length) {
    resolved.notes.forEach(n => {
      summaryHtml += `<div>${n}</div>`;
    });
  } else {
    summaryHtml += `<div>No actions recorded last night.</div>`;
  }

  // Dead players (including those died earlier evenings)
  const deadPlayers = players.filter(p => !p.alive);
  if (deadPlayers.length) {
    summaryHtml += `<h4>Players Dead:</h4>`;
    deadPlayers.forEach(d => {
      summaryHtml += `<div>Player ${d.id} (${d.role})</div>`;
    });
  } else {
    summaryHtml += `<h4>Players Dead:</h4><div>None</div>`;
  }

  // Alive players
  summaryHtml += `<h4>Players Still Alive:</h4>`;
  getAlivePlayers().forEach(a => {
    summaryHtml += `<div>Player ${a.id} (${a.role}) ${a.status.silenced ? '(Silenced tomorrow)' : ''}</div>`;
  });

  document.getElementById("nightSummary").innerHTML = summaryHtml;

  // After summarizing, clear per-night temporary flags like protected, spyProtected for next night
  players.forEach(p => {
    // Keep persistent statuses (like protected history for bagani)
    p.status.protected = false;      // protection applies only that night
    p.status.spyProtected = false;  // resets
    // silenced remains for next day; we show it then remove after day (or keep as flag that affects talk)
    // cursed was applied in resolution/died or cleared by heal; keep as-is
  });
  saveState();
}

function goToVoting() {
  // Save state then go
  saveState();
  window.location.href = "vote.html";
}

// ------------------ VOTING PAGE LOGIC ------------------ //
function initVotePage() {
  loadState();
  document.getElementById("voteDayNum").innerText = currentDay;
  renderVoteOptions();
}

function renderVoteOptions() {
  loadState();
  const container = document.getElementById("voteOptions");
  container.innerHTML = "";

  const alive = getAlivePlayers();
  alive.forEach(p => {
    const btn = document.createElement("button");
    btn.innerText = `Vote Player ${p.id} (${p.role})`;
    btn.onclick = () => {
      // For demo: immediate elimination on first click
      // In a real game you'd tally votes; for now we eliminate clicked target and record who voted if needed.
      // We'll also handle Tiyanak effect: if the eliminated is Tiyanak, one random voter dies too.
      p.alive = false;
      // record who voted? For demo, random voter chosen
      const voters = alive.filter(v => v.alive && v.id !== p.id);
      let randomVoter = null;
      if (voters.length > 0) randomVoter = voters[Math.floor(Math.random() * voters.length)];
      // If the voted-out was Tiyanak, the random voter dies
      if (p.role === "Tiyanak" && randomVoter) {
        randomVoter.alive = false;
        alert(`Player ${p.id} (Tiyanak) was voted out and dragged Player ${randomVoter.id} down with it!`);
      } else {
        alert(`Player ${p.id} was voted out.`);
      }

      // If Mangkukulam was eliminated by vote same day, reverse curses applied last night (they survive)
      if (p.role === "Mangkukulam") {
        // clear any cursed players applied last night
        players.forEach(q => {
          if (q._cursedByThisNight) {
            // they were cursed last night; cancel curse and keep them alive
            q.status.cursed = false;
            q._cursedByThisNight = null;
          }
        });
      }

      // save and end voting turn
      saveState();
      endVoting();
    };
    container.appendChild(btn);
  });
}

function endVoting() {
  // increment day, check win conditions, then back to night or finish
  currentDay++;
  // clear resolvedNight and nightActions for next night
  nightActions = [];
  localStorage.removeItem("resolvedNight");
  localStorage.removeItem("nightActions");
  saveState();
  checkWinCondition();
  // Next go to night page
  window.location.href = "night.html";
}

// ------------------ WIN CHECK & RESET ------------------ //
function checkWinCondition() {
  loadState();
  const aliveCreatures = players.filter(p => p.alive && isCreature(p.role)).length;
  const aliveVillagers = players.filter(p => p.alive && !isCreature(p.role)).length;

  if (aliveCreatures === 0) {
    alert("All creatures eliminated — Villagers win!");
    resetGame();
  } else if (false) {
    alert("Creatures now equal or outnumber villagers — Creatures win!");
    resetGame();
  } else if (currentDay > 10) {
    alert("Reached Day 10 — CREATURES survived. ALL Villagers LOSE!");
    resetGame();
  }
}

function resetGame() {
  localStorage.clear();
  window.location.href = "index.html";
}

// ------------------ Page helper for index (to show players if stored) ------------------ //
(function initIndexIfNeeded() {
  // If this script loads in index.html, try to show pre-existing players
  if (typeof document !== "undefined" && document.getElementById && document.getElementById("distribution")) {
    // If players exist in storage, show them
    const storedPlayers = JSON.parse(localStorage.getItem("players") || "null");
    if (storedPlayers) {
      players = storedPlayers;
      currentDay = parseInt(localStorage.getItem("currentDay") || "1");
      // display summary if distribution can be derived (not exact), else show assigned roles
      const playerList = document.getElementById("playerList");
      if (playerList) {
        playerList.innerHTML = "";
        players.forEach(p => {
          const li = document.createElement("li");
          li.textContent = `Player ${p.id}: ${p.role} ${p.alive ? '' : '(dead)'}`;
          playerList.appendChild(li);
        });
        document.getElementById("lobby").style.display = "block";
      }
    }
  }
})();
