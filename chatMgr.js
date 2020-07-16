// Author: Tom Hollis
// (Inspired by a HongyiMC script -- check him out -- but coded from scratch)

// Chat manager script for BDS with ElementZero
// Chat commands and auto-moderation
// Chat commands are not usable if players have "wild" tag (server contains a wilderness survival area)

// TODO: Separate this into one auto-moderation script and one chat command script 
//       possibly also one script per chat command

import {
    getPlayerByNAME,
	getPlayerList,
	onPlayerLeft,
	onPlayerInitialized
} from "ez:player";

import { onChat } from "ez:chat";

const system = server.registerSystem(0,0);

let sunnyVotes = [];
let trollWords = [];  // words that receive instant permanent bans, removed for GitHub
let players = [];

onPlayerLeft((player) => {
	// remove a player's vote if they log off
	sunnyVotes.splice(sunnyVotes.indexOf(player.name),1);
	players.splice(players.indexOf(player.name),1);
	checkSunVote(false);
});

onPlayerInitialized((player) => {
	players.push(player.name);
});

onChat(async (chatLine) => {		
	let command = chatLine.content.toLowerCase().trim();
	
	if (checkTrollWords(command.replace(/\s+/g,''), chatLine.sender)) {
		return; // if they were banned for a word, don't do anything else
	}

	let wild = await isWild(chatLine.sender);
	if(!wild) {
		switch (command){
		case ".home":
			system.executeCommand(`kill "${chatLine.sender}"`, () => {});
			break;
		case ".sunny":
			let pause = await logSunVote(chatLine.sender);
			break;
		default: 
			break;
		}
    } else {
		chatBroadcast("§cWilderness mode: dot commands are not available");
    } 
});

function chatBroadcast(msg){
	let chatData = system.createEventData("minecraft:display_chat_event");
	chatData.data.message = msg;
	system.broadcastEvent("minecraft:display_chat_event", chatData);
}

function checkTrollWords(chatMsg, player){

	for(let w of trollWords){
		if(chatMsg.includes(w)){
			system.executeCommand('ban ' + player + ' "Instaban - Reason: Used a word that almost always means trolling is happening."', () => {});
			return true;
		}
	}
	
	// this is in here because people who ask this often end up being trolls too
	if(chatMsg.includes("what do i do")){
		chatBroadcast("Automatic response:");
		chatBroadcast("We're still building the server, so only survival and creative game modes are available right now.");
		chatBroadcast("If you're looking for a server that gives you specific goals, check back in a year or so");
	}
	return false;
}

async function logSunVote(player){
	// check whether it's actually night or rainy
	let sun = await isSunny();
	if (sun) {
		chatBroadcast("§eIt's already sunny!");
		return;
	}
	
	let resultMsg = "";
	// check what action to take
	if (sunnyVotes.length == 0) {
		// fresh vote starts
		sunnyVotes = [player];
		resultMsg = "§eVote for sun started.";
	} else if (sunnyVotes.includes(player)) {
		resultMsg = "§eYou've already voted in this round.";
	} else {
		resultMsg = "§eYour vote has been recorded.";
		sunnyVotes.push(player);
	}
	chatBroadcast(resultMsg);
	checkSunVote(true);
}

// see if changing circumstances have made the currently active vote pass or end
// if newVote = true, display the standings (because someone cast a new vote)
async function checkSunVote(newVote){
	// double check that the vote is still relevant
	let sun = await isSunny()
	if (sun && sunnyVotes.length > 0){
		// end vote and delete if not
		sunnyVotes = [];
		chatBroadcast("§eVote for sun ended due to... sun");
		return;
	}
	
	let civPlayers = 0;
	for (let p of players) {
		// count each civ player
		let wild = await isWild(p.name);
		if (!wild) { 
			civPlayers++;
		// if they weren't a civ player, but they're on the list, remove them
		} else if(sunnyVotes.includes(p.name)){
			sunnyVotes.splice(sunnyVotes.indexOf(p.name),1);
		}	
	}
	
	let result = sunnyVotes.length/civPlayers;
	if (result > 0.5) {
		// vote succeeded, change weather and time as needed
		chatBroadcast("§eVote for sun has §a§lpassed!");
		if (rainLevel()) { system.executeCommand("weather clear", () => {}); }
		let night = await isNight();
		if (night) { system.executeCommand("time set sunrise", () => {}); }
		sunnyVotes = []; // clear votes for next time
	} else if(newVote){
		chatBroadcast("§eVote for sun standings: §a" + (result * 100) + " percent §eof civ players agree §c(need more than 50 percent)");
	} 
}	
	
async function isSunny(){
	let night = await isNight();
	let rain = rainLevel();
	return await (!night && !rain);
}

function isNight(){
	return new Promise(resolve => {
		system.executeCommand("time query daytime", (result) => {
			// parse the query result string (last "word" is the number)
			let resultArray = result.data.statusMessage.split(" ");
			let time = parseInt(resultArray[resultArray.length - 1]);
			
			//return true if it's night hours (13000 is 7PM and 23000 is 5AM)
			resolve(time > 13000 && time < 23000);
		});
	});		
}

function rainLevel(){
	// 0.0 = not raining, > 0.0 = raining to some extent
	return parseFloat(system.getComponent(server.level, "minecraft:weather").data.rain_level);
}

function isWild(player){
	// is this player in the wilderness area?
	return new Promise(resolve => {
		system.executeCommand(`tag "${player}" list`, (result) => {
			let message = result.data.statusMessage;
			let tags=message.substring(message.indexOf(":")+1,message.length).trim().split(", ");
			resolve(tags.includes("§awild§r"));
		});
	});
}

console.log("chatMgr.js loaded");