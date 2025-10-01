// --- ROLE POOLS --- //
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
  "Kampanero"
];

// --- DISTRIBUTION RULES --- //
const roleDistribution = {
  6: { creatures: 1, abilities: 2, villagers: 3 },
  7: { creatures: 1, abilities: 2, villagers: 4 },
  8: { creatures: 2, abilities: 3, villagers: 3 },
  9: { creatures: 2, abilities: 3, villagers: 4 },
  10: { creatures: 3, abilities: 4, villagers: 3 },
  11: { creatures: 3, abilities: 4, villagers: 4 },
  12: { creatures: 4, abilities: 4, villagers: 4 }
};

// --- GLOBALS --- //
let players = [];
let currentDay = 1;
let turnIndex = 0; // track whose turn at night

// --- CREATE LOBBY AND ASSIGN ROLES --- //
function createLobby() {
  const maxPlayers = parseInt(document.getElementById("maxPlayers").value);
  if (!roleDistribution[maxPlayers]) {
    alert("Player count must be between 6 and 12.");
    return;
  }

  const { creatures: cCount, abilities: aCount, villagers: vCount } = roleDistribution[maxPlayers];

  // Summary
  let summary = `[${maxPlayers} Players]<br>` +
                `Creature - ${cCount} ${cCount > 1 ? "Creatures" : "Creature"}<br>` +
                `Villager with abilities - ${aCount} players<br>` +
                `Normal Villager - ${vCount} players`;

  document.getElementById("lobby").style.display = "block";
  document.getElementById("distribution").innerHTML = summary;

  // Assign roles
  function shuffle(arr) {
    return arr.sort(() => Math.random() - 0.5);
  }

  let roles = [];
  roles = roles.concat(shuffle([...creatures]).slice(0, cCount));
  roles = roles.concat(shuffle([...villagersWithAbilities]).slice(0, aCount));
  roles = roles.concat(Array(vCount).fill("Normal Villager"));
  roles = shuffle(roles);

  players = roles.map((role, index) => ({
    id: index + 1,
    role: role,
    alive: true,
    actions: []
  }));

  // Show in lobby
  let playerList = document.getElementById("playerList");
  playerList.innerHTML = "";
  players.forEach(p => {
    let li = document.createElement("li");
    li.textContent = `Player ${p.id}: ${p.role}`;
    playerList.appendChild(li);
  });

  // Save state
  localStorage.setItem("players", JSON.stringify(players));
  localStorage.setItem("currentDay", currentDay);
  localStorage.setItem("turnIndex", 0);
}

// --- START GAME --- //
function startGame() {
  window.location.href = "night.html";
}

// --- NIGHT PHASE --- //
function loadNightPhase() {
  players = JSON.parse(localStorage.getItem("players")) || [];
  currentDay = parseInt(localStorage.getItem("currentDay")) || 1;
  turnIndex = parseInt(localStorage.getItem("turnIndex")) || 0;

  let alivePlayers = players.filter(p => p.alive);

  // If all players finished turn → go to Day Phase
  if (turnIndex >= alivePlayers.length) {
    localStorage.setItem("players", JSON.stringify(players));
    localStorage.setItem("turnIndex", 0);
    window.location.href = "day.html";
    return;
  }

  let player = alivePlayers[turnIndex];
  document.getElementById("playerTurn").innerText =
    `Player ${player.id} (${player.role}) it's your turn`;

  let ui = document.getElementById("actionUI");
  ui.innerHTML = "";

  if (player.role === "Normal Villager") {
    ui.innerHTML = "<p>You can only skip.</p>";
  } else {
    players.filter(p => p.alive && p.id !== player.id).forEach(target => {
      let btn = document.createElement("button");
      btn.innerText = `Use skill on Player ${target.id}`;
      btn.onclick = () => useSkill(player, target);
      ui.appendChild(btn);
    });
  }

  // Skip button
  let skipBtn = document.createElement("button");
  skipBtn.innerText = "Skip Turn";
  skipBtn.onclick = () => skipTurn();
  ui.appendChild(skipBtn);
}

function useSkill(player, target) {
  player.actions.push({ day: currentDay, target: target.id });
  skipTurn();
}

function skipTurn() {
  turnIndex++;
  localStorage.setItem("turnIndex", turnIndex);
  localStorage.setItem("players", JSON.stringify(players));
  window.location.reload();
}

// --- DAY PHASE --- //
function loadDayPhase() {
  players = JSON.parse(localStorage.getItem("players")) || [];
  currentDay = parseInt(localStorage.getItem("currentDay")) || 1;

  let summary = `<h2>Night ${currentDay} Results:</h2>`;
  players.forEach(p => {
    p.actions.filter(a => a.day === currentDay).forEach(a => {
      summary += `Player ${p.id} (${p.role}) targeted Player ${a.target}<br>`;
    });
  });

  if (summary === `<h2>Night ${currentDay} Results:</h2>`) {
    summary += "No actions occurred.<br>";
  }

  // Dead players
  let deadPlayers = players.filter(p => !p.alive);
  if (deadPlayers.length > 0) {
    summary += `<h3>Players Dead:</h3>`;
    deadPlayers.forEach(p => {
      summary += `Player ${p.id} (${p.role})<br>`;
    });
  } else {
    summary += `<h3>Players Dead:</h3> None<br>`;
  }

  // Alive players
  summary += `<h3>Players Still Alive:</h3>`;
  players.filter(p => p.alive).forEach(p => {
    summary += `Player ${p.id} (${p.role})<br>`;
  });

  document.getElementById("nightSummary").innerHTML = summary;
}



function goToVoting() {
  window.location.href = "vote.html";
}

// --- VOTING PHASE --- //
function loadVotingPhase() {
  players = JSON.parse(localStorage.getItem("players")) || [];
  let container = document.getElementById("voteOptions");
  container.innerHTML = "";

  players.filter(p => p.alive).forEach(target => {
    let btn = document.createElement("button");
    btn.innerText = `Vote Player ${target.id}`;
    btn.onclick = () => votePlayer(target);
    container.appendChild(btn);
  });
}

function votePlayer(target) {
  target.alive = false; // simple elimination
  alert(`Player ${target.id} was eliminated`);
  localStorage.setItem("players", JSON.stringify(players));
  endVoting();
}

function endVoting() {
  currentDay++;
  localStorage.setItem("currentDay", currentDay);
  checkWinCondition();
  window.location.href = "night.html";
}

// --- CHECK WIN CONDITIONS --- //
function checkWinCondition() {
  players = JSON.parse(localStorage.getItem("players")) || [];
  let aliveCreatures = players.filter(p => p.alive && creatures.includes(p.role)).length;
  let aliveVillagers = players.filter(p => p.alive && !creatures.includes(p.role)).length;

  if (aliveCreatures === 0) {
    alert("Villagers win!");
    resetGame();
  } else if (aliveCreatures >= aliveVillagers) {
    alert("Creatures win!");
    resetGame();
  } else if (currentDay > 10) {
    alert("Villagers survived until Day 10. Villagers win!");
    resetGame();
  }
}

// --- RESET GAME --- //
function resetGame() {
  localStorage.clear();
  window.location.href = "index.html"; // back to lobby
}
