import {
	loadWaitingRoom,
	loadWaitingExpEndRoom,
} from "../Content/Forms/waitingRoom.js";
import { loadConsentForm } from "../Content/Forms/consentForm.js";
import { loadInstructions } from "../Content/Forms/instructions.js";
import Game from "./Game.js";

document.addEventListener("DOMContentLoaded", () => {
	const wsURL = `ws://${window.location.host}${window.location.pathname}coms`;
	const ws = new WebSocket(wsURL);
	console.log("Connecting to the server...");
	const queryParams = new URLSearchParams(window.location.search);
	let id = "";
	let origin = "";
	if (queryParams.has("survey_code")) {
		id = queryParams.get("survey_code");
	} else {
		id = "";
	}
	if (queryParams.has("origin")) {
		origin = queryParams.get("origin");
	} else {
		origin = "";
	}
	ws.send(
		JSON.stringify({
			stage: "intro",
			type: "participantInfo",
			id: id,
			origin: origin,
		})
	);
	let game = null;
	const defaultWsOnMessage = (event) => {
		let message = JSON.parse(event.data);
		console.log(message);
		// Clear previous content in 'main' container
		const mainContainer = document.getElementById("main");
		mainContainer.innerHTML = "";
		switch (message.stage) {
			case "waitingRoom":
				loadWaitingRoom("main", ws);
				break;
			case "waitingExpEndRoom":
				loadWaitingExpEndRoom("main", ws);
				break;
			case "intro":
				switch (message.type) {
					case "consentForm":
						loadConsentForm("main", ws);
						break;
					case "instructions":
						loadInstructions("main", ws);
						break;
				}
				break;
			case "practice":
				game = new Game("main", ws, "practice", "sep", id, origin);
				break;
			case "game":
				game = new Game("main", ws, "game", message.block);
				break;
		}
	};

	ws.onopen = () => {
		console.log("Connected to the server");
	};

	ws.onmessage = defaultWsOnMessage;
});
