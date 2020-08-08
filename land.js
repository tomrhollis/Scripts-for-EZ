// LAND.JS  --  Very basic land claim system for ElementZero
// Author:  Tom Hollis (github.com/tomrhollis) Aug 2020
//
// Note: this should really be a DLL mod.  But I'm not there yet
// and need a land claim system like right now.
//
// Also contains tags and other things that are specific to my
// server's needs. This will need alteration to fit any other
// server.  But again, you probably shouldn't use this if you
// can avoid it.

import {open} from "ez:sqlite3";
import {onChat} from "ez:chat";
import {
	getPlayerByNAME,
	getOfflinePlayerByXUID
} from "ez:player";

const system = server.registerSystem(0, 0);

const dimensions = ["overworld", "nether", "end"];
var claims = [];

// set up the database and initialize the claims list from it
try{
	var landDB = open("land.db");
	landDB.exec("CREATE TABLE IF NOT EXISTS land (" +
				"claim_id INTEGER PRIMARY KEY, " +
				"xuid TEXT NOT NULL, " +
				"dim INTEGER NOT NULL, " +
				"center_x INTEGER NOT NULL, " +
				"center_z INTEGER NOT NULL, " +
				"radius INTEGER NOT NULL);");
	var claimQuery = landDB.prepare("SELECT * FROM land");
	loadClaims();
} catch (err) {
	console.error(err);
}

// apply adventure mode to people in other people's claims
function guardClaims() {	
	try{
		// start fresh
		system.executeCommand("tag @a remove inClaim", () => {
			// pulse tags and gamemode changes on each claim			
			for (let claim of claims) {
				let r = claim.radius+7;
				let owner = getOfflinePlayerByXUID(claim.xuid).name;
				let dim = dimensions[claim.dim];
				// add inClaim tag to anyone inside who isn't the owner or an admin
				system.executeCommand(`tag @a[tag=!admin,tag=!inClaim,tag=${dim},name=!${owner},x=${claim.center_x - r},y=0,z=${claim.center_z - r},dx=${(r * 2) + 1},dy=255,dz=${(r * 2) + 1}] add inClaim`, () => {});
			}
			// apply adventure mode to anyone with inClaim tag
			system.executeCommand("gamemode a @a[m=!a,tag=inClaim]", () => {				
				// remove adventure mode from anyone without inClaim tag
				system.executeCommand("gamemode s @a[m=a,tag=!inClaim]", ()=>{});
			});
		});
	} catch (err) {
		console.error(err);
	}
}

// get claims from DB query
function loadClaims(){
	claims=[];
	claimQuery.forEach((cid,xid,d,cx,cz,r)=>{
		let claim = {claim_id: cid, xuid: xid, dim: d, center_x: cx, center_z: cz, radius: r};
		claims.push(claim);
	});
}

// validate claim and add it to the DB
async function addClaim(player, x, z, r){
	// check dimension & admin status
	let overworld = await hasTag(player, "overworld");
	let nether = await hasTag(player, "nether");
	let end = await hasTag(player, "end");
	let admin = await hasTag(player, "admin");
	let dim = 0;
	r = (admin) ? r : 32;
	
	// set dimension
	if (overworld){	// nothing
	} else if (nether) {
		dim = 1;
	} else if (end) {
		dim = 2;
	} else return;

	let playerObj = getPlayerByNAME(player);
	
	// check if that xuid already has a claim or the claim overlaps any other
	for(let claim of claims){
		if(!admin && claim.xuid == playerObj.xuid){
			system.executeCommand(`tellraw ${player} {"rawtext": [{"text": "§cYou already have a claim. Abandon your claim if you want this area. (Multiple claims will come later)"}]}`, () => {});
			return;
		}
		if (!((x - r) >= (claim.center_x + claim.radius) || (claim.center_x - claim.radius) >= (x + r) ||
		   (z - r) <= (claim.center_z + claim.radius) || (claim.center_z - claim.radius) <= (z + r))){
			system.executeCommand(`tellraw ${player} {"rawtext": [{"text": "§cThis area overlaps another claim. Please try another area."}]}`, () => {});
			return;
		}
	}
	// if all good, create claim: add it to db and refresh the claims list
	try{
		landDB.exec(`INSERT INTO land(xuid, dim, center_x, center_z, radius) VALUES(${playerObj.xuid}, ${dim}, ${x}, ${z}, ${r});`);
		system.executeCommand(`tellraw ${player} {"rawtext": [{"text": "§aLand Claimed"}]}`, () => {
			loadClaims();
		});
	} catch(err) {
		console.error(err);
	}
}

// remove all of a person's claims from DB
function removeClaim(player){
	let playerObj = getPlayerByNAME(player);
	landDB.exec(`DELETE FROM land WHERE xuid='${playerObj.xuid}'`);
	system.executeCommand(`tellraw ${player} {"rawtext": [{"text": "§6If you had a claim, it has been unclaimed"}]}`, () => {
		loadClaims();
	});
}

// check if a player has a particular tag
function hasTag(player, tag){
	return new Promise(resolve => {
		system.executeCommand(`tag "${player}" list`, (result) => {
			let message = result.data.statusMessage;
			let tags=message.substring(message.indexOf(":")+1,message.length).trim().split(", ");
			resolve(tags.includes(`§a${tag}§r`));
		});
	});
}

// make sure people aren't screwing with people's stuff in their claims
system.listenForEvent("minecraft:block_interacted_with", async (eventData) => {
	let name = system.getComponent(eventData.data.player, "minecraft:nameable").data.name;
	let notAllowed = await hasTag(name, "inClaim");
	if (notAllowed){
		try{	// shake them out of the chest/anvil/whatever UI by teleporting them way up and back down really fast
			let pos = system.getComponent(eventData.data.player, "minecraft:position").data;
			system.executeCommand(`execute ${name} ${pos.x} ${pos.y} ${pos.z} tp ~ 256 ~`, ()=>{
				system.executeCommand(`tp ${name} ${pos.x} ${pos.y} ${pos.z}`, ()=>{});
				system.executeCommand(`tellraw ${name} {"rawtext": [{"text": "§cObjects in this area are protected by a claim"}]}`, ()=>{}); 
			});
		} catch (err) {
			console.error(err);
		}
	}
});

// implement the dot commands
onChat(async (chatLine) => {
	let command = chatLine.content.trim().split(' ');
	let wild = await hasTag(chatLine.sender, "wild");
	if (!wild && command[0] == ".land"){
		switch(command[1].toLowerCase()) {
		case "claim":
			let r = (!isNaN(parseInt(command[4]))) ? command[4] : 32;
			if(!isNaN(parseInt(command[2])) && !isNaN(parseInt(command[3]))) {				
				await addClaim(chatLine.sender, command[2], command[3], r);
			} else {
				system.executeCommand(`tellraw ${chatLine.sender} {"rawtext": [{"text": "§cUse the format §e.land claim <x> <z>"}]}`, () => {});
			}
			break;
		case "unclaim":
			removeClaim(chatLine.sender);
			break;
  	    /*  case "list":
			break;
		case "outline":
			break;	*/		
		case "help":
			// instructions
			system.executeCommand(`tellraw ${chatLine.sender} {"rawtext": [{"text": "§e.land claim <x> <z>§r - claims a 65x65 square centered on the x & z you choose"}]}`, () => {
				system.executeCommand(`tellraw ${chatLine.sender} {"rawtext": [{"text": "§e.land unclaim§r - removes your claim"}]}`, () => {
					system.executeCommand(`tellraw ${chatLine.sender} {"rawtext": [{"text": "§fMore options & flexibility will be added later! §fgithub.com/tomrhollis"}]}`, () => {});
				});
			});
			break;
		}
	}
}); 

// run the claim guardian every 7 ticks
var totalTicks = 0;
system.update = function() {
	totalTicks++;
	
	if (totalTicks % 7 == 0) {
		guardClaims();
	}
}
