import express from "express";
import { clear, time } from "node:console";
import exp from "node:constants";
import { create } from "node:domain";
import fs, { write } from "node:fs";
import { Server as WSServer } from "ws";
import { WebSocket } from "ws";
import path from "path";
import { start } from "node:repl";
import { send } from "node:process";

/*
[X] Change server routing to redirect on end of exp
[X] change WS management to remove an redirct
[X] Write data when they land on the final page
[X] add forced timeout

PATH TO EXP:
lukespirit.duckdns.org/lukespirit/
PATH TO DATA:
lukespirit.duckdns.org/data/
*/
const app = express();
const port = 3000;

app.use(express.static("www"));

const server = app.listen(port, () => {
	console.log("Server started on http://localhost:" + port);
});

const wss = new WSServer({ server, path: "/coms" });

const connections: {
	player1: WebSocket | null;
	player2: WebSocket | null;
} = {
	player1: null,
	player2: null,
};

type Player = {
	id: number;
	age: number;
	gender: string;
	consent: boolean;
	platform: string;
};
type mousePos = {
	trialNo: number;
	x: number;
	y: number;
	stage: string;
	block: string;
	timestamp: number;
};
type screen = {
	width: number;
	height: number;
};

type mouseTracking = {
	p1Screen: screen;
	p2Screen: screen;
	player1: mousePos;
	player2: mousePos;
};
type State = {
	startTime: string;
	gameNo: number;
	stage: "waitingRoom" | "intro" | "practice" | "game" | "end";
	block: string;
	player1: Player;
	player2: Player;
	RDK: rdk;
	P1RDK: rdk;
	P2RDK: rdk;
	trialNo: number;
};
type rdk = {
	mostRecentChoice: string;
	choice: Array<number>;
	choiceTime: Array<number>;
	completed: Array<boolean>;
	totalReactionTIme: Array<Array<number>>;
	correct: Array<boolean>;
	attempts: Array<number>;
	player: Array<number>;
	playerAttempts: Array<number>;
	coherence: Array<number>;
	direction: Array<any>;
	incorrectDirection: Array<Array<string>>;
	completionTime: number;
	reactionTime: Array<Array<number>>;
	timeStamp: Array<number>;
};
let mousePos: mouseTracking = {
	p1Screen: { width: 0, height: 0 },
	p2Screen: { width: 0, height: 0 },
	player1: { trialNo: 0, x: 0, y: 0, stage: "", block: "", timestamp: 0 },
	player2: { trialNo: 0, x: 0, y: 0, stage: "", block: "", timestamp: 0 },
};

const expValues = {
	trials: 60,
	trialLength: 6,
	coherence: [0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9],
	directions: ["left", "right"],
	block: ["sep", "collab"],
	breakLength: 6,
	dataPath: "/data/",
	blockLength: 30,
	practiceTrials: 10,
	practiceLength1: 3,
	practiceLength2: 6,
	practiceBreak1: 3,
	practiceBreak2: 6,
};
/*
REMEBER TO REMOVE OR CHANGE THIS
*/
const testConsts = {
	skipIntro: false,
};
/*
Base RDK is used to reset the state between trials and blocks. 
*/
const baseRDK: rdk = {
	mostRecentChoice: "",
	choice: [],
	choiceTime: [0, 0, 0, 0, 0, 0, 0, 0],
	completed: [false, false, false, false, false, false, false, false],
	correct: [false, false, false, false, false, false, false, false],
	attempts: [0, 0, 0, 0, 0, 0, 0, 0],
	playerAttempts: [0, 0, 0, 0, 0, 0, 0, 0],
	player: [0, 0, 0, 0, 0, 0, 0, 0],
	coherence: expValues.coherence,
	direction: [],
	incorrectDirection: [[], [], [], [], [], [], [], []],
	completionTime: 0,
	reactionTime: [[], [], [], [], [], [], [], []],
	totalReactionTIme: [[], [], [], [], [], [], [], []],
	timeStamp: [0, 0, 0, 0, 0, 0, 0, 0],
};
let state: State = {
	startTime: "",
	gameNo: 0,
	stage: "waitingRoom",
	block: "sep",
	player1: {
		id: 0,
		age: 0,
		gender: "",
		consent: false,
		platform: "",
	},
	player2: {
		id: 0,
		age: 0,
		gender: "",
		consent: false,
		platform: "",
	},
	trialNo: 0,
	RDK: deepCopy(baseRDK),
	P1RDK: deepCopy(baseRDK),
	P2RDK: deepCopy(baseRDK),
};
/*
Initialising variable we need ot track timestamps, arrays for data, and to control messaging for both players. 
*/
let usedIDS: Array<number> = [];
let dataArray: Array<any> = [];
let mouseArray: Array<any> = [];
let practiceTrialsDirections: Array<Array<string>> = [];
let trialsDirections: Array<Array<string>> = [];
let timeStamp = 0;
let baseState = deepCopy(state);
let trialTimeout: NodeJS.Timeout | null = null;
let breakTimeout: NodeJS.Timeout | null = null;
let blocks: Array<string> = [];
let trackingObject = {
	p1Ready: false,
	p2Ready: false,
	p1TrialReady: false,
	p2TrialReady: false,
	P1InstructionsFinished: false,
	P2InstructionsFinished: false,
	p1PracticeReady: false,
	p2PracticeReady: false,
	p1SkipReady: false,
	p2SkipReady: false,
	p1sepInstruction: false,
	p2sepInstruction: false,
};
let trackingObjectCopy = deepCopy(trackingObject);

/*
functions start below here
*/
function saveTrialData(state: State, block: string) {
	state.block = block;
	dataArray.push(state);
}
function assignID() {
	let id = Math.floor(Math.random() * 1000);
	return id;
}
function deepCopy(obj: any) {
	return JSON.parse(JSON.stringify(obj));
}
function checkID(id: number) {
	if (usedIDS.includes(id)) {
		let newID = assignID();
		return newID;
	} else {
		return id;
	}
}
function count(array: Array<any>, value: any) {
	return array.filter((a) => a === value).length;
}
function createTimestamp(timestamp: number) {
	let newTimestamp = Date.now();
	let time = newTimestamp - timestamp;
	return time;
}
function handleNewPlayers(playerID: "player1" | "player2") {
	if (playerID === "player1") {
		let id = assignID();
		let newid = checkID(id);
		usedIDS.push(newid);
		state.player1.id = newid;
	}
	if (playerID === "player2") {
		let id = assignID();
		let newid = checkID(id);
		usedIDS.push(newid);
		state.player2.id = newid;
	}
}
function randomChoice(arr: Array<any>) {
	let choicesArray = [];
	let choice = arr[Math.floor(Math.random() * arr.length)];
	choicesArray.push(choice);
	return choice;
}
function splitIntoSubarrays(arr: Array<string>, subarrayLength: number) {
	let result = [];
	for (let i = 0; i < arr.length; i += subarrayLength) {
		result.push(arr.slice(i, i + subarrayLength));
	}
	return result;
}
function chooseBlock(exp: string) {
	/*
	Chooses the blocks for both practice and exp trials. This is called once and then the block is used for the rest of the trials.
	*/
	if (exp === "exp") {
		let blockArray = ["sep", "collab"];
		let block = randomChoice(blockArray);
		let blocks: Array<string> = [];
		if (block === "sep") {
			blocks = ["sep", "collab"];
		}
		if (block === "collab") {
			blocks = ["collab", "sep"];
		}
		return blocks;
	}
	if (exp === "collab") {
		let blocks: Array<string> = ["collab", "sep"];
		return blocks;
	}
	if (exp === "sep") {
		let blocks: Array<string> = ["sep", "collab"];
		return blocks;
	} else {
		return ["error"];
	}
}
function shuffle(arr: Array<any>) {
	let currentIndex = arr.length,
		randomIndex;
	while (currentIndex != 0) {
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;
		[arr[currentIndex], arr[randomIndex]] = [
			arr[randomIndex],
			arr[currentIndex],
		];
	}
	return arr;
}
function removeConnection(player: "player1" | "player2") {
	if (player === "player1") {
		connections.player1 = null;
	}
	if (player === "player2") {
		connections.player2 = null;
	}
}
async function sendMessage(connection: WebSocket, message: string) {
	return new Promise((resolve, reject) => {
		connection.send(message, (error) => {
			if (error) {
				reject(error);
			} else {
				resolve(true);
			}
		});
	});
}
async function chooseNewDirection(
	state: State,
	playerID: "player1" | "player2",
	index: any,
	stage: string,
	block: string
) {
	/*
	Chooses a new direction for the RDK when the player makes an incorrect choice. 
	It updates the state and sends the new direction to the player. In the collab condiiton 
	it will send the new direction and updated state to both players. 
	It randomly chooses the direction between "left" and "right"
	*/
	switch (block) {
		case "collab":
			if (playerID === "player1") {
				let direction = randomChoice(expValues.directions);
				state.P1RDK.direction[index] = direction;
				let message = JSON.stringify({
					stage: stage,
					block: block,
					type: "newDirection",
					data: direction,
					index: index,
				});
				await sendMessage(connections.player1!, message);

				await sendState(state, "player1", stage, block);
				await sendState(state, "player2", stage, block);
			} else if (playerID === "player2") {
				let direction = randomChoice(expValues.directions);
				state.P2RDK.direction[index] = direction;
				const message = JSON.stringify({
					stage: stage,
					block: block,
					type: "newDirection",
					data: direction,
					index: index,
				});
				await sendMessage(connections.player2!, message);
				await sendState(state, "player1", stage, block);
				await sendState(state, "player2", stage, block);
			}
			break;
		case "sep":
			if (playerID === "player1") {
				let direction = randomChoice(expValues.directions);
				state.P1RDK.direction[index] = direction;
				const message = JSON.stringify({
					stage: stage,
					block: block,
					type: "newDirection",
					data: direction,
					index: index,
				});
				await sendMessage(connections.player1!, message);
				await sendState(state, "player1", stage, block);
			} else if (playerID === "player2") {
				let direction = randomChoice(expValues.directions);
				state.P2RDK.direction[index] = direction;
				const message = JSON.stringify({
					stage: stage,
					block: block,
					type: "newDirection",
					data: direction,
					index: index,
				});
				await sendMessage(connections.player2!, message);
				await sendState(state, "player2", stage, block);
			}
			break;
	}
}
// added change
async function sendState(
	state: State,
	playerID: "player1" | "player2",
	stage: string,
	block: string
) {
	/*
	Sends the state to both players. On the client side both players are P1, so if the ws matches P1 it will send the state to the player.
	If it matches P2 it will switch the state to so P2 appears as P1 and then sends that transformed state. 
	*/
	if (playerID === "player1") {
		const message = JSON.stringify({
			stage: stage,
			block: block,
			type: "state",
			data: state,
		});
		await sendMessage(connections.player1!, message);
	} else if (playerID === "player2") {
		let newState = deepCopy(state);
		newState.P1RDK = state.P2RDK;
		newState.P2RDK = state.P1RDK;
		const message = JSON.stringify({
			stage: stage,
			block: block,
			type: "state",
			data: newState,
		});
		await sendMessage(connections.player2!, message);
	}
}
async function beginGame(
	directions: Array<string>,
	state: State,
	stage: string,
	block: string
) {
	/*
	Initialises the game. It sets the directions for the RDK and sends the state to the players. 
	The directions are all preloaded, and selected based on the current trial number. 
	*/
	switch (block) {
		case "collab":
			state.RDK.direction = directions;
			const collabMessage = JSON.stringify({
				stage: stage,
				block: block,
				type: "initialState",
				data: state,
			});
			await Promise.all([
				sendMessage(connections.player1!, collabMessage),
				sendMessage(connections.player2!, collabMessage),
			]);
			break;
		case "sep":
			state.RDK.direction = directions;
			state.P1RDK.direction = directions;
			state.P2RDK.direction = directions;
			const sepMessage = JSON.stringify({
				stage: stage,
				block: block,
				type: "initialState",
				data: state,
			});
			await Promise.all([
				sendMessage(connections.player1!, sepMessage),
				sendMessage(connections.player2!, sepMessage),
			]);
	}
}
function updatePlayerMouseState(
	stage: string,
	block: string,
	playerID: "player1" | "player2",
	dimensions: { width: number; height: number },
	data: { x: number; y: number }
) {
	/*
	Updates the mouse position for the player. It records the trial number, the x and y position of the mouse, the stage and block, and the timestamp. 
	This deep copies the base mousePos state, and then writes it to the mouseData array whenever called. 
	*/
	const newMousePos = {
		player1: { ...mousePos.player1 },
		p1Screen: { ...mousePos.p1Screen },
		p2Screen: { ...mousePos.p2Screen },
		player2: { ...mousePos.player2 },
	};

	if (playerID === "player1") {
		newMousePos.player1.trialNo = state.trialNo;
		newMousePos.p1Screen.height = dimensions.height;
		newMousePos.p1Screen.width = dimensions.width;
		newMousePos.player1.x = data.x;
		newMousePos.player1.y = data.y;
		newMousePos.player1.stage = stage;
		newMousePos.player1.block = block;
		newMousePos.player1.timestamp = createTimestamp(timeStamp);
		mouseArray.push(newMousePos);
		let length = mouseArray.length;
	}
	if (playerID === "player2") {
		newMousePos.player1.trialNo = state.trialNo;
		newMousePos.p2Screen.height = dimensions.height;
		newMousePos.p2Screen.width = dimensions.width;
		newMousePos.player2.x = data.x;
		newMousePos.player2.y = data.y;
		newMousePos.player2.stage = stage;
		newMousePos.player2.block = block;
		newMousePos.player2.timestamp = createTimestamp(timeStamp);
		mouseArray.push(newMousePos);
	}
}

function writeMouse(data: any, suffix: "A" | "B") {
	/*
	Function for writing the mouse data to a file. File name will include the game number.
	*/
	try {
		// Convert the data object to a JSON string
		const dataString = JSON.stringify(data, null, 2); // Indent JSON for readability

		// Define the filename and path
		const filename = `game${state.gameNo}${suffix}mouse.json`;
		const path = `${expValues.dataPath}${filename}`;

		// Write the JSON string to a file
		fs.writeFileSync(path, dataString, "utf8");
	} catch (error) {
		// Handle errors (e.g., file system errors)
		console.error(`Failed to write data to ${expValues.dataPath}:`, error);
	}
}
function writeData(data: any, suffix: "A" | "B") {
	/*
		Function for writing the trial data to a file. File name will include the game number.
	*/
	try {
		// Convert the data object to a JSON string
		const dataString = JSON.stringify(data, null, 2); // Indent JSON for readability

		// Define the filename and path
		const filename = `game${state.gameNo}${suffix}.json`;
		const path = `${expValues.dataPath}${filename}`;

		// Write the JSON string to a file
		fs.writeFileSync(path, dataString, "utf8");
	} catch (error) {
		// Handle errors (e.g., file system errors)
		console.error(`Failed to write data to ${expValues.dataPath}:`, error);
	}
}

function createTrials(state: State, blockType: string) {
	/*
	This creates the trials for the experiments, assigning directions for each 
	coherence value for each trial. This is pushes to trialsDirectionArray
	which is then split into subarrays for each coherence value
	*/
	if (blockType === "exp") {
		let trials = expValues.trials;
		let choices = expValues.directions;
		let coherences = expValues.coherence;
		let trialsDirectionArray = [];
		// Initialize an object to store trials

		for (let i = 0; i < trials; i++) {
			for (let j = 0; j < coherences.length; j++) {
				let direction = randomChoice(choices);
				trialsDirectionArray.push(direction);
			}
		}
		let trialsDirections = splitIntoSubarrays(
			trialsDirectionArray,
			coherences.length
		);
		return trialsDirections;
	} else if (blockType === "practice") {
		let trials = 10;
		let choices = expValues.directions;
		let coherences = expValues.coherence;
		let trialsDirectionArray = [];
		// Initialize an object to store trials

		for (let i = 0; i < trials; i++) {
			for (let j = 0; j < coherences.length; j++) {
				let direction = randomChoice(choices);
				trialsDirectionArray.push(direction);
			}
		}
		let trialsDirections = splitIntoSubarrays(
			trialsDirectionArray,
			coherences.length
		);
		return trialsDirections;
	} else {
		return [["error"]];
	}
}
function hasBeenSelected(state: State, data: any) {
	if (state.RDK.choice.includes(data)) {
		return true;
	} else {
		return false;
	}
}
async function handleRDKSelection(
	player: "player1" | "player2",
	data: any,
	rt: any,
	state: State,
	stage: string,
	block: string
) {
	/*
	more or less handles selection of the RDK. It updates the state with the choice, the time of the choice, and the timestamp.
	Really only need to worry about checking selection in the collab condition, as the sep condition is handled in the checkResponse function.
	*/
	switch (block) {
		case "collab":
			if (!hasBeenSelected(state, data)) {
				state.RDK.choice.push(data);
				if (player === "player1") {
					state.RDK.player[data] = 1;
					state.P1RDK.choice.push(data);
					state.P1RDK.mostRecentChoice = data;
					state.P1RDK.choiceTime[data] = rt;
					state.RDK.timeStamp[data] = createTimestamp(timeStamp);
					state.P1RDK.timeStamp[data] = createTimestamp(timeStamp);
					const loadMessage = JSON.stringify({
						stage: stage,
						type: "load",
						data: data,
					});
					const choiceMessage = JSON.stringify({
						stage: stage,
						type: "playerChoice",
						data: data,
					});
					await sendMessage(connections.player2!, choiceMessage);
					await sendMessage(connections.player1!, loadMessage);
					await Promise.all([
						sendState(state, "player1", stage, block),
						sendState(state, "player2", stage, block),
					]);
				} else if (player === "player2") {
					state.RDK.player[data] = 2;
					state.P2RDK.choiceTime[data] = rt;
					state.P2RDK.mostRecentChoice = data;
					state.RDK.timeStamp[data] = createTimestamp(timeStamp);
					state.P2RDK.timeStamp[data] = createTimestamp(timeStamp);
					const loadMessage = JSON.stringify({
						stage: stage,
						type: "load",
						data: data,
					});
					const choiceMessage = JSON.stringify({
						stage: stage,
						type: "playerChoice",
						data: data,
					});
					await sendMessage(connections.player1!, choiceMessage);
					await sendMessage(connections.player2!, loadMessage);
					await Promise.all([
						sendState(state, "player1", stage, block),
						sendState(state, "player2", stage, block),
					]);
				}
			} else {
				if (player === "player1") {
					const message = JSON.stringify({
						stage: stage,
						block: block,
						type: "alreadySelected",
						data: data,
					});
					await sendMessage(connections.player1!, message);
				} else if (player === "player2") {
					const message = JSON.stringify({
						stage: stage,
						block: block,
						type: "alreadySelected",
						data: data,
					});
					await sendMessage(connections.player2!, message);
				}
			}
			break;
		case "sep":
			if (player === "player1") {
				state.P1RDK.choice.push(data);
				state.P1RDK.choiceTime[data] = rt;
				state.P1RDK.timeStamp[data] = createTimestamp(timeStamp);
				state.P1RDK.mostRecentChoice = data;
				const message = JSON.stringify({
					stage: stage,
					type: "load",
					data: data,
				});
				await sendMessage(connections.player1!, message);
				await sendState(state, "player1", stage, block);
			} else if (player === "player2") {
				state.P2RDK.choiceTime[data] = rt;
				state.P2RDK.choice.push(data);
				state.P2RDK.timeStamp[data] = createTimestamp(timeStamp);
				state.P2RDK.mostRecentChoice = data;
				const message = JSON.stringify({
					stage: stage,
					type: "load",
					data: data,
				});
				await sendMessage(connections.player2!, message);
				await sendState(state, "player2", stage, block);
			}
			break;
	}
}
function updateCollabStateOnResponse(
	state: State,
	player: "player1" | "player2",
	correct: boolean,
	id: any,
	rt: number,
	totalRt: number
) {
	/*
	This is used to update the state of the RDK type when the player makes a response. if it is correct a bunch of things are updated, 
	if incorrect it is mostly attempts, reaction time and the incorrect direction. This is used in the CHECKRESPONSE function.
	*/

	if (correct == true) {
		if (player === "player1") {
			state.RDK.totalReactionTIme[id].push(totalRt);
			state.P1RDK.totalReactionTIme[id].push(totalRt);
			state.RDK.correct[id] = true;
			state.RDK.reactionTime[id].push(rt);
			state.P1RDK.reactionTime[id].push(rt);
			state.RDK.completed[id] = true;
			state.P1RDK.completed[id] = true;
			state.P1RDK.correct[id] = true;
			state.P1RDK.attempts[id] += 1;
			state.RDK.player[id] = 1;
		} else if (player === "player2") {
			state.RDK.totalReactionTIme[id].push(totalRt);
			state.P2RDK.totalReactionTIme[id].push(totalRt);
			state.P2RDK.reactionTime[id].push(rt);
			state.RDK.correct[id] = true;
			state.RDK.reactionTime[id].push(rt);
			state.RDK.completed[id] = true;
			state.P2RDK.completed[id] = true;
			state.P2RDK.correct[id] = true;
			state.P2RDK.attempts[id] += 1;
			state.RDK.player[id] = 2;
		}
	} else if (correct == false) {
		if (player === "player1") {
			state.P1RDK.attempts[id] += 1;
			state.P1RDK.reactionTime[id].push(rt);
			state.P1RDK.totalReactionTIme[id].push(totalRt);
			state.P1RDK.incorrectDirection[id].push(state.P1RDK.direction[id]);
		} else if (player === "player2") {
			state.P2RDK.attempts[id] += 1;
			state.P2RDK.reactionTime[id].push(rt);
			state.P2RDK.totalReactionTIme[id].push(totalRt);
			state.P2RDK.incorrectDirection[id].push(state.P2RDK.direction[id]);
		}
	}
}

async function checkResponse(
	player: "player1" | "player2",
	data: string,
	id: any,
	state: State,
	rt: number,
	totalRt: number,
	stage: string,
	block: string
) {
	/*
	This function checks the response of the player. If the player has already made a response, it will not do anything. If the response does not match the most recently selected one,
	it also does nothing (this solves a bug i was having). If the response is correct, it updates the state and sends the new state to the players.
	The sep condition has everything update here as opposed to it's own function. 
	*/
	switch (block) {
		case "collab":
			if (player === "player1") {
				if (state.P1RDK.mostRecentChoice !== id) {
				} else {
					if (state.RDK.direction[id] === data) {
						const message = JSON.stringify({
							stage: stage,
							block: block,
							type: "completed",
							data: id,
						});
						await sendMessage(connections.player1!, message);
						updateCollabStateOnResponse(
							state,
							"player1",
							true,
							id,
							rt,
							totalRt
						);
						await sendState(state, "player1", stage, block);
						await sendState(state, "player2", stage, block);
					} else if (state.RDK.direction[id] !== data) {
						await chooseNewDirection(state, "player1", id, stage, block);
						updateCollabStateOnResponse(
							state,
							"player1",
							false,
							id,
							rt,
							totalRt
						);
					}
				}
			} else if (player === "player2") {
				if (state.P2RDK.mostRecentChoice !== id) {
				} else {
					if (state.RDK.direction[id] === data) {
						const message = JSON.stringify({
							stage: stage,
							block: block,
							type: "completed",
							data: id,
						});
						await sendMessage(connections.player2!, message);
						updateCollabStateOnResponse(
							state,
							"player2",
							true,
							id,
							rt,
							totalRt
						);
						await sendState(state, "player1", stage, block);
						await sendState(state, "player2", stage, block);
					} else if (state.RDK.direction[id] !== data) {
						await chooseNewDirection(state, "player2", id, stage, block);
						updateCollabStateOnResponse(
							state,
							"player2",
							false,
							id,
							rt,
							totalRt
						);
					}
				}
			}
			break;
		case "sep":
			if (player === "player1") {
				if (state.P1RDK.mostRecentChoice !== id) {
				} else {
					if (state.P1RDK.direction[id] === data) {
						const message = JSON.stringify({
							stage: stage,
							block: block,
							type: "completed",
							data: id,
						});
						await sendMessage(connections.player1!, message);
						state.P1RDK.totalReactionTIme[id].push(totalRt);
						state.P1RDK.reactionTime[id].push(rt);
						state.P1RDK.completed[id] = true;
						state.P1RDK.attempts[id] += 1;
						await sendState(state, "player1", stage, block);
					} else if (state.RDK.direction[id] !== data) {
						await chooseNewDirection(state, "player1", id, stage, block);
						state.P1RDK.attempts[id] += 1;
						state.P1RDK.reactionTime[id].push(rt);
						state.P1RDK.totalReactionTIme[id].push(totalRt);
						state.P1RDK.incorrectDirection[id].push(state.P1RDK.direction[id]);
						await sendState(state, "player1", stage, block);
					}
				}
			}
			if (player === "player2") {
				if (state.P2RDK.mostRecentChoice !== id) {
				} else {
					if (state.P2RDK.direction[id] === data) {
						const message = JSON.stringify({
							stage: stage,
							block: block,
							type: "completed",
							data: id,
						});
						await sendMessage(connections.player2!, message);
						state.P2RDK.totalReactionTIme[id].push(totalRt);
						state.P2RDK.reactionTime[id].push(rt);
						state.P2RDK.completed[id] = true;
						state.P2RDK.attempts[id] += 1;
						await sendState(state, "player2", stage, block);
					} else if (state.RDK.direction[id] !== data) {
						await chooseNewDirection(state, "player2", id, stage, block);
						state.P2RDK.attempts[id] += 1;
						state.P2RDK.reactionTime[id].push(rt);
						state.P2RDK.totalReactionTIme[id].push(totalRt);
						state.P2RDK.incorrectDirection[id].push(state.P2RDK.direction[id]);
						await sendState(state, "player2", stage, block);
					}
				}
			}
			break;
	}
}
function resetStateonConnection(data: State) {
	let gameNo = data.gameNo + 1;
	let newState = Object.assign({}, baseState);
	newState.gameNo = gameNo;
	return newState;
}
function resetDataArray(data: Array<any>) {
	let newData: Array<any> = [];
	return newData;
}
function resetMouseState(data: mouseTracking) {
	let newMouse = Object.assign({}, data);
	newMouse.player1 = {
		trialNo: 0,
		x: 0,
		y: 0,
		stage: "",
		block: "",
		timestamp: 0,
	};
	newMouse.player2 = {
		trialNo: 0,
		x: 0,
		y: 0,
		stage: "",
		block: "",
		timestamp: 0,
	};
	return newMouse;
}

function resetState(state: State, baseRDK: rdk, newBlock: boolean) {
	/*
	Used to reset the state between trials and blocks.
	*/
	if (newBlock === true) {
		let newState = Object.assign({}, state);
		newState.RDK = deepCopy(baseRDK);
		newState.P1RDK = deepCopy(baseRDK);
		newState.P2RDK = deepCopy(baseRDK);
		newState.trialNo = 0;
		return newState;
	} else {
		let newState = Object.assign({}, state);
		newState.RDK = deepCopy(baseRDK);
		newState.P1RDK = deepCopy(baseRDK);
		newState.P2RDK = deepCopy(baseRDK);
		return newState;
	}
}

function checkCompleted(
	state: State,
	block: string,
	player: "player1" | "player2" | null
) {
	if (block === "sep") {
		if (player === "player1") {
			if (state.P1RDK.completed.includes(false)) {
				return true;
			} else {
				return false;
			}
		}
	} else if (player === "player2") {
		if (state.P2RDK.completed.includes(false)) {
			return true;
		} else {
			return false;
		}
	}
	if (block === "collab") {
		if (state.RDK.completed.includes(false)) {
			return false;
		} else {
			return true;
		}
	}
}
function endTrialEarly(
	state: State,
	block: string,
	player: "player1" | "player2" | null
) {
	if (checkCompleted(state, block, player) === true) {
		if (block === "collab") {
			if (trialTimeout !== null) {
				clearTimeout(trialTimeout);
				startBreak(block);
			}
		}
	}
}
async function checkBlockCompleted(
	state: State,
	block: string,
	blocks: Array<string>
) {
	/*
	Checks if the block is completed. If it is, it will send the endBlock message to the players. This is called during the trial handling functions, 
	where if false they continue, but if true they exit and send the appropriate message. 
	*/
	if (block === blocks[0]) {
		if (state.trialNo === expValues.blockLength) {
			const message = JSON.stringify({
				stage: "game",
				block: block,
				type: "endBlock",
				data: "endBlock",
			});
			await Promise.all([
				sendMessage(connections.player1!, message),
				sendMessage(connections.player2!, message),
			]);
			writeData(dataArray, "A");
			return true;
		} else {
			return false;
		}
	}
	if (block === blocks[1]) {
		if (state.trialNo === expValues.blockLength) {
			const p1Message = JSON.stringify({
				stage: "game",
				block: block,
				type: "endBlock",
				data: "endExp",
				platform: state.player1.platform,
			});
			const p2Message = JSON.stringify({
				stage: "game",
				block: block,
				type: "endBlock",
				data: "endExp",
				platform: state.player2.platform,
			});
			await Promise.all([
				sendMessage(connections.player1!, p1Message),
				sendMessage(connections.player2!, p2Message),
			]);
			writeData(dataArray, "B");
			return true;
		} else {
			return false;
		}
	}
}
function calculateBreakInfo(state: State, player: "player1" | "player2") {
	/*
	Calculates info to display on the break screen, switching it to show the correct info for each player. 
	*/
	let P1counts = 0;
	let P2counts = 0;

	if (player === "player1") {
		P1counts = count(state.P1RDK.completed, true);
		P2counts = count(state.P2RDK.completed, true);
	} else if (player === "player2") {
		P1counts = count(state.P2RDK.completed, true);
		P2counts = count(state.P1RDK.completed, true);
	}

	let teamCompleted = P1counts + P2counts;

	let breakInfo = {
		P1completed: P1counts,
		P2completed: P2counts,
		teamCompleted: teamCompleted,
	};

	return breakInfo;
}

async function startTrials(block: string) {
	/*
	Timestamp is used to calculate the time different messages arrive compared to the beginning of the trial. 
	creates a timeout to track time for each trial, and calls the startBreak function whestaten the trial is over.
	*/
	timeStamp = Date.now();
	state = resetState(state, baseRDK, false);
	state.RDK.direction = trialsDirections[state.trialNo];
	state.P1RDK.direction = trialsDirections[state.trialNo];
	state.P2RDK.direction = trialsDirections[state.trialNo];
	try {
		const message = JSON.stringify({
			stage: "game",
			block: block,
			type: "startTrial",
			data: state,
		});
		await Promise.all([
			sendMessage(connections.player1!, message),
			sendMessage(connections.player2!, message),
		]);

		setTimeout(() => {
			console.log("setting timeout for break");
			startBreak(block);
		}, expValues.trialLength * 1000);
	} catch (error) {
		console.error("Error in startTrials", error);
	}
}

async function startBreak(block: string) {
	/*
	Saves trial data and increments the trial number. If the block is not completed, it will calculate the break info and send it to the players.
	Calls start trial assumming checkBlock doesn't return true.
	*/
	state.RDK.completionTime = createTimestamp(Date.now());
	state.P1RDK.completionTime = createTimestamp(Date.now());
	state.P2RDK.completionTime = createTimestamp(Date.now());
	saveTrialData(state, block);
	state.trialNo += 1;
	try {
		let completed = await checkBlockCompleted(state, block, blocks);
		if (!completed) {
			let p1BreakInfo = calculateBreakInfo(state, "player1");
			let p2BreakInfo = calculateBreakInfo(state, "player2");
			const message1 = JSON.stringify({
				stage: "game",
				block: block,
				type: "break",
				data: p1BreakInfo,
			});
			const message2 = JSON.stringify({
				stage: "game",
				block: block,
				type: "break",
				data: p2BreakInfo,
			});
			await Promise.all([
				sendMessage(connections.player1!, message1),
				sendMessage(connections.player2!, message2),
			]);
			setTimeout(() => {
				startTrials(block);
			}, expValues.breakLength * 1000);
		} else {
			return;
		}
	} catch (error) {
		console.error("Error in startBreak", error);
	}
}

async function handlePracticeTrials(
	directions: Array<Array<string>>,
	block: string
) {
	/*
	Same as startTrials but for the practice trials.
	*/
	state = resetState(state, baseRDK, false);
	timeStamp = Date.now();
	state.P1RDK.direction = directions[state.trialNo];
	state.P2RDK.direction = directions[state.trialNo];
	state.RDK.direction = directions[state.trialNo];
	const message = JSON.stringify({
		stage: "practice",
		block: block,
		type: "startTrial",
		data: state,
	});
	await Promise.all([
		sendMessage(connections.player1!, message),
		sendMessage(connections.player2!, message),
	]);
	if (state.trialNo < 7) {
		trialTimeout = setTimeout(() => {
			startPracticeBreak(block);
		}, expValues.practiceLength1 * 1000);
	} else {
		trialTimeout = setTimeout(() => {
			startPracticeBreak(block);
		}, expValues.practiceLength2 * 1000);
	}
}

function startPracticeBreak(block: string) {
	/*
	Same as startBreak but for the practice trials.
	*/
	saveTrialData(state, block);

	state.trialNo += 1; // Increment trial number here
	if (
		(block === "sep" && state.trialNo < 5) ||
		(block === "collab" && state.trialNo < 10)
	) {
		// Calculate break info for each player
		let p1BreakInfo = calculateBreakInfo(state, "player1");
		let p2BreakInfo = calculateBreakInfo(state, "player2");

		// Send break message after incrementing trialNo and scheduling next trial
		connections.player1?.send(
			JSON.stringify({
				stage: "practice",
				block: block,
				type: "break",
				data: p1BreakInfo,
			})
		);
		connections.player2?.send(
			JSON.stringify({
				stage: "practice",
				block: block,
				type: "break",
				data: p2BreakInfo,
			})
		);
		if (state.trialNo <= 7) {
			setTimeout(() => {
				handlePracticeTrials(practiceTrialsDirections, block);
			}, expValues.practiceBreak1 * 1000);
		} else {
			setTimeout(() => {
				handlePracticeTrials(practiceTrialsDirections, block);
			}, expValues.practiceBreak2 * 1000);
		}
	}
	if (block === "sep" && state.trialNo === 5) {
		connections.player1?.send(
			JSON.stringify({ stage: "practice", type: "blockBreak", data: state })
		);
		connections.player2?.send(
			JSON.stringify({ stage: "practice", type: "blockBreak", data: state })
		);
	} else if (block === "collab" && state.trialNo === 10) {
		connections.player1?.send(
			JSON.stringify({
				stage: "practice",
				type: "practiceEnd",
				data: blocks[0],
			})
		);
		connections.player2?.send(
			JSON.stringify({
				stage: "practice",
				type: "practiceEnd",
				data: blocks[0],
			})
		);
	}
}

function skipToBlock(stage: string, block: string) {
	/*
	Helper function to skip to a block. This is used in the introduction messaging to skip to the practice trials, or to the game section. 
	IF wanting to start practice use "practice" as the stage, and either "sep" as the block. If wanting either sep or collab, use "game" as the stage.
	*/
	if (stage === "game") {
		if (block === "sep") {
			state.stage = "game";
			state.block = "sep";
			state.trialNo = 0;
			blocks = ["sep", "collab"];
			practiceTrialsDirections = createTrials(state, "practice");
			trialsDirections = createTrials(state, "exp");
			connections.player1?.send(
				JSON.stringify({ stage: "game", block: "sep", message: "instructions" })
			);
			connections.player2?.send(
				JSON.stringify({ stage: "game", block: "sep", message: "instructions" })
			);
		}
		if (block === "collab") {
			state.stage = "game";
			state.block = "collab";
			blocks = ["collab", "sep"];
			state.trialNo = 0;
			practiceTrialsDirections = createTrials(state, "practice");
			trialsDirections = createTrials(state, "exp");
			connections.player1?.send(
				JSON.stringify({
					stage: "game",
					block: "collab",
					message: "instructions",
				})
			);
			connections.player2?.send(
				JSON.stringify({
					stage: "game",
					block: "collab",
					message: "instructions",
				})
			);
		}
	} else if (stage === "practice") {
		blocks = chooseBlock("exp");
		if (block === "sep") {
			state.stage = "practice";
			state.block = "sep";
			state.trialNo = 0;

			practiceTrialsDirections = createTrials(state, "practice");
			trialsDirections = createTrials(state, "exp");
			connections.player1?.send(
				JSON.stringify({
					stage: "practice",
					block: "sep",
					message: "instructions",
				})
			);
			connections.player2?.send(
				JSON.stringify({
					stage: "practice",
					block: "sep",
					message: "instructions",
				})
			);
		}
		if (block === "collab") {
			state.stage = "practice";
			state.block = "collab";
			state.trialNo = 0;
			practiceTrialsDirections = createTrials(state, "practice");
			trialsDirections = createTrials(state, "exp");
			connections.player1?.send(
				JSON.stringify({
					stage: "practice",
					block: "collab",
					message: "instructions",
				})
			);
			connections.player2?.send(
				JSON.stringify({
					stage: "practice",
					block: "collab",
					message: "instructions",
				})
			);
		}
	}
}

function handleIntroductionMessaging(
	type: string,
	ws: WebSocket,
	connections: any,
	data: any
) {
	switch (type) {
		case "consent":
			if (ws === connections.player1) {
				state.player1.consent = true;
				state.player1.age = Number(data.age);
				state.player1.gender = data.gender;
				state.player1.platform = data.platform;
				connections.player1.send(
					JSON.stringify({ stage: "intro", type: "instructions" })
				);
			} else if (ws === connections.player2) {
				state.player2.consent = true;
				state.player2.age = Number(data.age);
				state.player2.gender = data.gender;
				state.player2.platform = data.platform;
				connections.player2.send(
					JSON.stringify({ stage: "intro", type: "instructions" })
				);
			}
			break;
		case "completedInstructions":
			if (connections.player1 === ws) {
				trackingObject.P1InstructionsFinished = true;
			}
			if (connections.player2 === ws) {
				trackingObject.P2InstructionsFinished = true;
			}
			if (
				trackingObject.P1InstructionsFinished &&
				trackingObject.P2InstructionsFinished
			) {
				connections.player1?.send(
					JSON.stringify({ stage: "practice", message: "beginGame" })
				);
				connections.player2?.send(
					JSON.stringify({ stage: "practice", message: "beginGame" })
				);
			}
			break;
	}
}
async function practiceSepMessaging(
	data: any,
	ws: WebSocket,
	connections: any
) {
	switch (data.type) {
		case "instructionsComplete":
			if (connections.player1 === ws) {
				trackingObject.p1PracticeReady = true;
			} else if (connections.player2 === ws) {
				trackingObject.p2PracticeReady = true;
			}
			if (trackingObject.p1PracticeReady && trackingObject.p2PracticeReady) {
				state.stage = "practice";
				practiceTrialsDirections = createTrials(state, "practice");
				trialsDirections = createTrials(state, "exp");
				blocks = chooseBlock("exp");
				beginGame(
					practiceTrialsDirections[state.trialNo],
					state,
					data.stage,
					data.block
				);
				trackingObject.p1PracticeReady = false;
				trackingObject.p2PracticeReady = false;
				handlePracticeTrials(practiceTrialsDirections, "sep");
			}
			break;
		case "difficulty":
			if (ws === connections.player1) {
				handleRDKSelection(
					"player1",
					data.difficulty,
					data.rt,
					state,
					data.stage,
					data.block
				);
			} else if (ws === connections.player2) {
				handleRDKSelection(
					"player2",
					data.difficulty,
					data.rt,
					state,
					data.stage,
					data.block
				);
			}
			break;
		case "response":
			if (ws === connections.player1) {
				checkResponse(
					"player1",
					data.data,
					data.index,
					state,
					data.rt,
					data.totalRt,
					data.stage,
					data.block
				);
				checkCompleted(state, data.block, "player1");
			}
			if (ws === connections.player2) {
				checkResponse(
					"player2",
					data.data,
					data.index,
					state,
					data.rt,
					data.totalRt,
					data.stage,
					data.block
				);
				checkCompleted(state, data.block, "player2");
			}
			break;
	}
}
async function practiceCollabMessaging(
	data: any,
	ws: WebSocket,
	connections: any
) {
	switch (data.type) {
		case "gameReady":
			if (connections.player1 === ws) {
				trackingObject.p1PracticeReady = true;
			} else if (connections.player2 === ws) {
				trackingObject.p2PracticeReady = true;
			}
			if (trackingObject.p1PracticeReady && trackingObject.p2PracticeReady) {
				beginGame(
					practiceTrialsDirections[state.trialNo],
					state,
					data.stage,
					data.block
				);
				handlePracticeTrials(practiceTrialsDirections, "collab");
			}
			break;
		case "difficulty":
			if (ws === connections.player1) {
				handleRDKSelection(
					"player1",
					data.difficulty,
					data.rt,
					state,
					data.stage,
					data.block
				);
			} else if (ws === connections.player2) {
				handleRDKSelection(
					"player2",
					data.difficulty,
					data.rt,
					state,
					data.stage,
					data.block
				);
			}
			break;
		case "mousePos":
			if (ws === connections.player1) {
				updatePlayerMouseState(
					data.stage,
					data.block,
					"player1",
					data.dimmensions,
					data.data
				);
			} else if (ws === connections.player2) {
				updatePlayerMouseState(
					data.stage,
					data.block,
					"player2",
					data.dimmensions,
					data.data
				);
			}
			break;
		case "response":
			if (ws === connections.player1) {
				checkResponse(
					"player1",
					data.data,
					data.index,
					state,
					data.rt,
					data.totalRt,
					data.stage,
					data.block
				);
			}
			if (ws === connections.player2) {
				checkResponse(
					"player2",
					data.data,
					data.index,
					state,
					data.rt,
					data.totalRt,
					data.stage,
					data.block
				);
			}
			break;
		case "destroy":
			connections.player1?.send(
				JSON.stringify({
					stage: "game",
					block: blocks[0],
					message: "instructions",
				})
			);
			connections.player2?.send(
				JSON.stringify({
					stage: "game",
					block: blocks[0],
					message: "instructions",
				})
			);
			state = resetState(state, baseRDK, true);
			state.stage = "game";
			state.block = blocks[0];
			break;
	}
}
async function practiceMessaging(data: any, ws: WebSocket, connections: any) {
	await practiceSepMessaging(data, ws, connections);
	await practiceCollabMessaging(data, ws, connections);
}
function gameCollabMessaging(data: any, ws: WebSocket, connections: any) {
	switch (data.type) {
		case "instructionsComplete":
			if (connections.player1 === ws) {
				trackingObject.p1TrialReady = true;
			} else if (connections.player2 === ws) {
				trackingObject.p2TrialReady = true;
			}
			if (trackingObject.p1TrialReady && trackingObject.p2TrialReady) {
				state = resetState(state, baseRDK, true);
				beginGame(
					trialsDirections[state.trialNo],
					state,
					data.stage,
					data.block
				);
				startTrials(data.block);
			}
			break;
		case "difficulty":
			if (ws === connections.player1) {
				handleRDKSelection(
					"player1",
					data.difficulty,
					data.rt,
					state,
					data.stage,
					data.block
				);
			} else if (ws === connections.player2) {
				handleRDKSelection(
					"player2",
					data.difficulty,
					data.rt,
					state,
					data.stage,
					data.block
				);
			}
			break;
		case "mousePos":
			if (ws === connections.player1) {
				updatePlayerMouseState(
					data.stage,
					data.block,
					"player1",
					data.dimmensions,
					data.data
				);
			} else if (ws === connections.player2) {
				updatePlayerMouseState(
					data.stage,
					data.block,
					"player2",
					data.dimmensions,
					data.data
				);
			}
			break;
		case "response":
			if (ws === connections.player1) {
				checkResponse(
					"player1",
					data.data,
					data.index,
					state,
					data.rt,
					data.totalRt,
					data.stage,
					data.block
				);
			}
			if (ws === connections.player2) {
				checkResponse(
					"player2",
					data.data,
					data.index,
					state,
					data.rt,
					data.totalRt,
					data.stage,
					data.block
				);
			}
			break;
	}
}
function gameSepMessaging(data: any, ws: WebSocket, connections: any) {
	switch (data.type) {
		case "instructionsComplete":
			if (connections.player1 === ws) {
				trackingObject.p1sepInstruction = true;
			}
			if (connections.player2 === ws) {
				trackingObject.p2sepInstruction = true;
			}
			if (trackingObject.p1sepInstruction && trackingObject.p2sepInstruction) {
				state = resetState(state, baseRDK, true);
				state.stage = "game";
				state.block = "sep";
				beginGame(
					trialsDirections[state.trialNo],
					state,
					data.stage,
					data.block
				);
				startTrials(data.block);
			}
			break;
		case "difficulty":
			if (ws === connections.player1) {
				handleRDKSelection(
					"player1",
					data.difficulty,
					data.rt,
					state,
					data.stage,
					data.block
				);
			} else if (ws === connections.player2) {
				handleRDKSelection(
					"player2",
					data.difficulty,
					data.rt,
					state,
					data.stage,
					data.block
				);
			}
			break;
		case "response":
			if (ws === connections.player1) {
				checkResponse(
					"player1",
					data.data,
					data.index,
					state,
					data.rt,
					data.totalRt,
					data.stage,
					data.block
				);
				checkCompleted(state, data.block, "player1");
			}
			if (ws === connections.player2) {
				checkResponse(
					"player2",
					data.data,
					data.index,
					state,
					data.rt,
					data.totalRt,
					data.stage,
					data.block
				);
				checkCompleted(state, data.block, "player2");
			}
			break;
	}
}
wss.on("connection", function (ws) {
	if (connections.player1 === null) {
		connections.player1 = ws;
		state.stage = "waitingRoom";
		connections.player1.send(JSON.stringify({ stage: "waitingRoom" }));
		handleNewPlayers("player1");
		trackingObject.p1Ready = true;
	} else if (connections.player2 === null) {
		state.stage = "waitingRoom";
		connections.player2 = ws;
		handleNewPlayers("player2");
		connections.player2.send(JSON.stringify({ stage: "waitingRoom" }));
		trackingObject.p2Ready = true;
	} else {
		console.error("Too many players");
	}
	if (!connections.player1 || !connections.player2) {
		if (connections.player1) {
			connections.player1.send(JSON.stringify({ stage: "waitingRoom" }));
		}
		if (connections.player2) {
			connections.player2.send(JSON.stringify({ stage: "waitingRoom" }));
		}
	}
	if (connections.player1 && connections.player2) {
		if (!testConsts.skipIntro) {
			let startTime = new Date();
			state.startTime = startTime.toISOString();
			state = resetStateonConnection(state);
			mousePos = resetMouseState(mousePos);
			trackingObject = deepCopy(trackingObjectCopy);
			dataArray = [];
			mouseArray = [];
			state.stage = "intro";
			state.RDK.coherence = shuffle(expValues.coherence);
			connections.player1.send(
				JSON.stringify({ stage: "intro", type: "consentForm" })
			);
			connections.player2.send(
				JSON.stringify({ stage: "intro", type: "consentForm" })
			);
		} else if (testConsts.skipIntro) {
			trackingObject.p1SkipReady = true;
			trackingObject.p2SkipReady = true;
			if (trackingObject.p1SkipReady && trackingObject.p2SkipReady) {
				state = resetStateonConnection(state);
				state.RDK.coherence = shuffle(expValues.coherence);
				skipToBlock("game", "sep");
			}
		}
	}

	ws.on("message", function message(m) {
		const data = JSON.parse(m.toString("utf-8"));
		switch (data.stage) {
			case "intro":
				handleIntroductionMessaging(data.type, ws, connections, data.data);
				break;
			case "practice":
				switch (data.block) {
					case "sep":
						practiceSepMessaging(data, ws, connections);
						break;
					case "collab":
						practiceCollabMessaging(data, ws, connections);
						break;
				}
				break;
			case "game":
				switch (data.block) {
					case "collab":
						gameCollabMessaging(data, ws, connections);
						break;
					case "sep":
						gameSepMessaging(data, ws, connections);
						break;
				}
				break;
			case "end":
				if (connections.player1 === ws) {
					connections.player1 = null;
				} else if (connections.player2 === ws) {
					connections.player2 = null;
				}
		}
	});

	ws.on("close", () => {
		if (connections.player1 === ws) removeConnection("player1");
		else if (connections.player2 === ws) removeConnection("player2");
	});

	ws.on("error", console.error);
});
