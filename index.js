// Author: Tom Hollis

// Main server-side script for my server (running BDS with ElementZero)
// Imports more specific scripts
// Runs anything that needs to be checked every X ticks
//   Including incrementing in-game currency based on play time
//   Banning anyone who is in creative mode without authorization
//   And checking to make sure the spawn area is clear of monsters that may have wandered in
// Also cancels the generation of any monsters in spawn

// TODO: * AFK detection for use by auto-money below and .sunny command in chatMgr.js
//       * Move related functions into their own scripts that get imported

import {
	updateBalance
} from "ez:economy";

import {
	onPlayerLeft,
	onPlayerInitialized,
	getPlayerByNAME
} from "ez:player";

// HONGYIMC SCRIPTS
// import "./antiXray.js"
 import "./attackParticle.js"
// import "./bossbar.js"
// import "./bowDing.js"
// import "./chatCMD.js"
//import "./fun.js"
//import "./ipBan.js"
import "./mobHealthBossbar.js"
import "./mobReward.js"
import "./playerJoin.js"


// MY SCRIPTS
import "./rtpButtons.js"
import "./hax.js"
import "./chatMgr.js"


const system = server.registerSystem(0, 0);

// standard log init from npm module
system.initialize = function () {
	const scriptLoggerConfig = system.createEventData("minecraft:script_logger_config");
	scriptLoggerConfig.data.log_errors = true;
	scriptLoggerConfig.data.log_information = true;
	scriptLoggerConfig.data.log_warnings = true;
	system.broadcastEvent("minecraft:script_logger_config", scriptLoggerConfig);
}

// enable the EZ spawn protection plugin
system.executeCommand('spawn-protection enforce', () => {});	

// set up player tracking so they can be given money
let players = [];

onPlayerLeft((player) => {
	players.splice(players.indexOf(player.name),1);
});

onPlayerInitialized((player) => {
	players.push(player.name);
});

// per-tick updates
var totalTicks = 0;
system.update = function() {
	totalTicks++;
 
	// every 3 minutes
    if (totalTicks % 3600 == 0) {
		// increment in-game currency
		for (let p of players){
			updateBalance(getPlayerByNAME(p), 1, "add");
			system.executeCommand(`title "${p}" actionbar §fYou earned §e$1 §ffor time played`, () => {});
		}
	}

	// every 5 seconds
	// remove monsters that wandered into spawn
	if (totalTicks % 100 == 0) { 
		removeWanderingMonsters(); 
	
	}
	// every second
	// ban creative mode players who shouldn't be in creative mode
	if (totalTicks % 20 == 0) { 
		system.executeCommand('ban @a[m=c,tag=!admin,tag=!helper] "Instaban - Reason: Creative Mode outside Creative Server"', () => {});
	}
}


/*
   ** REMOVE HOSTILE MOBS FROM SPAWN **
*/

// define spawn area for mob removal
const spawnArea = {xnw: -318, znw: -286, xse: -124, zse: -67, ylo: 63, yhi: 255}; 

// create a query to get the mobs
var monsterQuery = system.registerQuery("minecraft:position", "x", "y", "z");

// list of mobs that should be removed from spawn
// thanks to the position component not including a dimension element, we have to handle nether mobs with command blocks
// including endermen and skeletons, unless you want those to be gone from the same coordinates in the nether
const hitList = ["minecraft:creeper", "minecraft:drowned", "minecraft:evocation_illager", "minecraft:husk",
			   "minecraft:phantom", "minecraft:pillager", "minecraft:ravager", "minecraft:silverfish",
			   "minecraft:slime", "minecraft:stray", "minecraft:vex", "minecraft:vindictor", "minecraft:witch", 
			   "minecraft:zombie", "minecraft:zombie_villager", "minecraft:cave_spider", "minecraft:spider", "minecraft:zombie_villager_v2"];

// set up event listener
system.listenForEvent("minecraft:entity_created", (eventData) => removeSpawnedMonster(eventData.data.entity));

function removeSpawnedMonster(entity) {
	//if the new mob is a monster on the list and is inside the spawn area, remove it from existence
	let loc = (system.getComponent(entity, "minecraft:position")).data;
	if(hitList.includes(entity.__identifier__) && loc.x > spawnArea.xnw && loc.y > spawnArea.ylo && loc.z > spawnArea.znw &&
			loc.x < spawnArea.xse && loc.y < spawnArea.yhi && loc.z < spawnArea.zse) {

		system.destroyEntity(entity);
	}
}

// remove monsters that wander into spawn from outside
function removeWanderingMonsters() {

	// only look at entities in spawn
	let spawnEntities = system.getEntitiesFromQuery(monsterQuery, spawnArea.xnw, spawnArea.ylo, spawnArea.znw, spawnArea.xse, spawnArea.yhi, spawnArea.zse);

	// abort if there's nothing to do
	if (spawnEntities == null || spawnEntities.length < 1) { 
		return;
	} 

	// narrow it down to entities in the monster list
	let monsters = [];
	for (let e of spawnEntities){
		if(hitList.includes(e.__identifier__)){
			monsters.push(e);
		}		
	}
	
	// remove each monster from existence
	while(monsters.length>0){
		system.destroyEntity(monsters.pop());
	}
}