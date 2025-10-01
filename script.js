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

// --- CREATE LOBBY AND ASSIGN ROLES --- //
function createLobby() {
  const maxPlayers = parseInt(document.getElementById("maxPlayers").value);
  if (!roleDistribution[maxPlayers]) {
    alert("Player count must be between 6 and 12.");
    return;
  }

  const { creatures: cCount, abilities: aCount, villagers: vCount } = roleDistribution[maxPlayers];

  // Show distribution summary
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
  roles = roles.concat(Array(vCount).fill("Villager"));
  roles = shuffle(roles);

  // Display player roles
  let playerList = document.getElementById("playerList");
  playerList.innerHTML = "";
  roles.forEach((role, index) => {
    let li = document.createElement("li");
    li.textContent = `Player ${index + 1}: ${role}`;
    playerList.appendChild(li);
  });
}

// --- START GAME --- //
function startGame() {
  alert("Game starting!");
  document.getElementById("lobby").style.display = "none";
}
