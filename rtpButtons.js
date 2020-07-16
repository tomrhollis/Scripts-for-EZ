// Author: Tom Hollis

// RTP (Random teleport) script for BDS with ElementZero

// TODO: * Change to define RTP button locations in a way that isn't hard coded in the functions,
//           but defined in a const array up top, with mins and maxes attached to them
//           Right now this is very very specific to where things are on my server
//       * Detect if they ended up above water and try again

const system = server.registerSystem(0, 0);

system.listenForEvent("minecraft:block_interacted_with", (eventData) => checkWhichBlock(eventData.data.player, eventData.data.block_position));

function checkWhichBlock(player, pos){
	
	// define a rectangular area where RTP not allowed
	let noRTP = {xmin: -353, xmax: 600, zmin: -400, zmax: 215};
	
	 // RTP buttons
	if ((pos.x == -5177 && pos.y == 117 && pos.z == -349) || // wilderness RTP
	    ((pos.x == -235 || pos.x == -234) && pos.y == 71 && pos.z == -230)) { // or local RTPs
	
		//get player name
		let playerNameComp = system.getComponent(player, "minecraft:nameable");
		let playerName = playerNameComp.data.name;
		if (playerName == null){
			playerName = "@a[x="+pos.x+",y="+pos.y+",z="+pos.z+",r=3,c=1]"; //default to this selector if problem getting name
		}

		let min=0;
		let max=0;
		let newX=0;
		let newZ=0;
		
		// define the RTP ranges based on which button it is
		// if you have multiple buttons on the same x, change this code
		switch(pos.x){
		case -235:
			min = 0;
			max = 2000;
			break;
		case -234:
			min = 2000;
			max = 5000;
			break;
		case -5177:
			min = 7000;
			max = 13000;
			break;
		default:
			break;
		}

		while(newX==0 && newZ == 0){
			//generate random coords
			newX=Math.floor(Math.random()*(max-min))+min;
			newZ=Math.floor(Math.random()*(max-min))+min;
			newX = (Math.random() > 0.5) ? newX : newX * -1;
			newZ = (Math.random() > 0.5) ? newZ : newZ * -1;

			// if the random point is in the protected area, reset to try again
			if ((newX > noRTP.xmin && newX < noRTP.xmax) || (newZ > noRTP.zmin && newZ < noRTP.zmax)){
				newX = 0;
				newZ = 0;
			} 
		}
	
		// do it
		RTP(playerName, newX, newZ);
	}
}

function RTP(player, x, z){
	system.executeCommand("effect " + player + " slow_falling 30 0 true", (result) => {
		if(result.data.statusCode == 0){
			system.executeCommand("tp " + player + " " + x + " 255 " + z, () => {});
		} else {
			system.executeCommand("tell " + player + " Something went wrong with the teleport. Please alert an admin", () => {});
		}
	});
}

console.log("rtpButtons.js loaded");