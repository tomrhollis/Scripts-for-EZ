// Author: Tom Hollis

// Detect easy to detect hacks and ban players who use them -- for BDS with ElementZero
// Currently only detects people who place command blocks without the proper tag

// TODO: * Move the allowed tag definition out of the command string into a const up top
//       * Think of more things to add here

const serverSystem = server.registerSystem(0, 0);

serverSystem.listenForEvent("minecraft:player_placed_block", (eventData) => checkForBlockHax(eventData));

function checkForBlockHax(eventData){

	let name = serverSystem.getComponent(eventData.data.player, "minecraft:nameable");
	let tickArea = serverSystem.getComponent(eventData.data.player, "minecraft:tick_world");
	let block = serverSystem.getBlock(tickArea.data.ticking_area, eventData.data.block_position);

	if(block.__identifier__.includes("command_block")){
		serverSystem.executeCommand("execute @p[name=" + name.data.name + ",tag=!admin,tag=!helper] ~ ~ ~ setblock " + block.block_position.x + " " + block.block_position.y + " " + block.block_position.z + " air 0", () => {});
		serverSystem.executeCommand('ban @p[name=' + name.data.name + ',tag=!admin,tag=!helper] "Instaban - Reason: Unauthorized Activity"', () => {});			
	}

}

console.log("hax.js loaded");