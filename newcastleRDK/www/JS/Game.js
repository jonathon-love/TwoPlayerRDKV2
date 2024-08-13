/*
[] check and see if the block break info is actually shown or if it just jumps stright o instructions
[] do one final check to see if everything switches and runs correctly all the way through.
*/

import {
	loadSepInstructions,
	loadCollabInstructions,
	loadEndGame,
} from "../Content/Forms/instructions.js";
export default class Game {
	constructor(containerId, websocket, stage, block) {
		/*
        Below setsup some of the initial variables for the game including the ids, 
        backgrounds colours and the canvas settings. 
        */
		this.ws = websocket;
		console.log("Game created");
		this.block = block;
		this.stage = stage;
		this.containerId = containerId;
		this.currentlyCompleting = false;
		this.ws.send(
			JSON.stringify({
				stage: this.stage,
				block: block,
				type: "instructionsComplete",
			})
		);
		this.container = document.getElementById(containerId);
		this.clearContainer();
		this.canvas = document.createElement("canvas");
		this.ctx = this.canvas.getContext("2d");
		this.setBackgroundColor("#808080"); // Initial background color
		this.container.appendChild(this.canvas);
		this.resizeCanvas();
		this.state = {};
		this.blockOrder = [];
		this.mouseOverHandler = this.mouseOverHandler.bind(this);
		this.mouseOutHandler = this.mouseOutHandler.bind(this);
		this.clickHandler = this.clickHandler.bind(this);
		this.generateDotMotionAperture = this.generateDotMotionAperture.bind(this);
		this.recordMousepos = this.recordMousepos.bind(this);
		this.responseHandler = null;
		this.expConsts = {
			dotRad: 1.75,
			apertureRad: 50,
			dotColor: "rgb(255,255,255)",
			dotSpeed: 0.75,
			nDots: 100,
			coherence: [0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9],
			directions: [0, 1],
			colourApertureSize: 30,
			pauseDuration: 500,
			blockBreak: 20,
			breakDuration: 10,
			blockLength: 30,
		};
		// Reaction time vars below
		this.breakInfo = {
			p1Completed: 0,
			p2Completed: 0,
			completed: 0,
		};
		this.trialNo = 0;
		this.choiceTimestamp = Date.now();
		this.rtTimestamp = Date.now();
		this.totalRTTimestamp = Date.now();
		this.newDirectionTimeout = null;

		/*
        Below controls the images that are displayed on the canvas.
        This will be on a div that corresponds to a cetain difficulty level.
        */
		this.divs = {
			uncompleted: [],
			completed: [],
		};
		this.images = [
			"../Content/Images/rdk_static1.png",
			"../Content/Images/rdk_static2.png",
			"../Content/Images/rdk_static3.png",
			"../Content/Images/rdk_static4.png",
			"../Content/Images/rdk_static1.png",
			"../Content/Images/rdk_static2.png",
			"../Content/Images/rdk_static3.png",
			"../Content/Images/rdk_static4.png",
		];
		this.img = [];
		this.preloadImages(this.images, this.img);
		window.addEventListener("resize", () => this.resizeCanvas());

		this.coherenceDifficulties = {
			0.1: "Very Easy",
			0.2: "Easy",
			0.3: "Easy-Med",
			0.4: "Med",
			0.6: "Med-Hard",
			0.7: "Hard",
			0.8: "Very Hard",
			0.9: "Ext Hard",
		};

		/*
        Below is for recording and sending the mouse positions to the server. 
        This may then be displayed on the other persons screen. 
        */
		this.mousePos = {
			x: 0,
			y: 0,
		};
		this.ws.onmessage = (event) => {
			let data = JSON.parse(event.data);
			console.log(this.trialNo, this.stage, this.block);
			switch (data.stage) {
				case "practice":
					switch (data.type) {
						case "initialState":
							this.state = data.data;
							this.resetDivs();
							this.resetCanvas(this.canvas);
							this.clearContainer();
							break;
						case "startTrial":
							if (this.breakdiv) {
								this.breakdiv.remove();
							}
							document.addEventListener("mousemove", this.recordMousepos);
							this.choiceTimestamp = Date.now();
							this.trialNo += 1;
							this.state = this.updateState(data.data, data.block);
							this.createImages(this.img);
							this.handleDivInteraction(this.divs.uncompleted);
							break;
						case "load":
							this.totalRTTimestamp = Date.now();
							this.dotTimestamp = Date.now();
							this.currentlyCompleting = true;
							this.removeOtherDivs(this.divs.uncompleted, data.data);
							this.generateDotMotionAperture(
								data.data,
								this.divs.uncompleted,
								this.expConsts,
								this.state.RDK.direction[data.data]
							);
							this.responseHandler = this.addResponseHandler(
								data.data,
								this.state
							);
							break;
						case "completed":
							document.addEventListener("mousemove", this.recordMousepos);
							this.choiceTimestamp = Date.now();
							this.currentlyCompleting = false;
							this.stopAnimation();
							this.divs = this.handleCompletedImages(data.data, this.divs);
							this.restoreImages(this.divs);
							break;
						case "newDirection":
							this.drawNewDirection(
								data.index,
								this.divs.uncompleted,
								this.expConsts,
								data.data
							);
							break;
						case "state":
							this.state = this.updateState(data.data, data.block);
							break;
						case "playerChoice":
							this.divs = this.handleCompletedImages(data.data, this.divs);
							this.restoreImages(this.divs);
							break;
						case "break":
							this.removeEventListeners(this.divs.uncompleted);
							this.stopAnimation();
							this.clearImageDivs();
							this.breakdiv = this.beginBreak(
								data.stage,
								data.block,
								data.data
							);
							break;
						case "blockBreak":
							document.removeEventListener("mousemove", this.recordMousepos);
							this.block = "collab";
							this.breakdiv = this.displayBlockBreak(this.stage, this.block);
							break;
						case "practiceEnd":
							this.stage = "game";
							document.removeEventListener("mousemove", this.recordMousepos);
							this.displayBlockInstructions(this.stage, data.data);
							break;
					}
					break;
				case "game":
					switch (data.type) {
						case "initialState":
							this.trialNo = 0;
							this.state = data.data;
							this.clearContainer();
							this.canvas = this.resetCanvas(this.canvas);
							this.ctx = this.canvas.getContext("2d");
							this.resizeCanvas();
							this.resetDivs();
							break;
						case "startTrial":
							if (this.breakdiv) {
								this.breakdiv.remove();
							}
							this.choiceTimestamp = Date.now();
							this.trialNo += 1;
							this.state = this.updateState(data.data, data.block);
							this.createImages(this.img);
							this.handleDivInteraction(this.divs.uncompleted);
							break;
						case "load":
							this.totalRTTimestamp = Date.now();
							this.dotTimestamp = Date.now();
							this.currentlyCompleting = true;
							this.removeOtherDivs(this.divs.uncompleted, data.data);
							this.generateDotMotionAperture(
								data.data,
								this.divs.uncompleted,
								this.expConsts,
								this.state.RDK.direction[data.data]
							);
							this.responseHandler = this.addResponseHandler(
								data.data,
								this.state
							);
							break;
						case "completed":
							this.choiceTimestamp = Date.now();
							this.currentlyCompleting = false;
							this.stopAnimation();
							this.divs = this.handleCompletedImages(data.data, this.divs);
							this.restoreImages(this.divs);
							break;
						case "newDirection":
							this.dotTimestamp = Date.now();
							this.drawNewDirection(
								data.index,
								this.divs.uncompleted,
								this.expConsts,
								data.data
							);
							break;
						case "state":
							this.state = this.updateState(data.data, data.block);
							break;
						case "playerChoice":
							this.divs = this.handleCompletedImages(data.data, this.divs);
							this.restoreImages(this.divs);
							break;
						case "break":
							this.removeEventListeners(this.divs.uncompleted);
							this.stopAnimation();
							this.clearImageDivs();
							this.breakdiv = this.beginBreak(
								data.stage,
								data.block,
								data.data
							);
							break;
						case "endBlock":
							document.removeEventListener("mousemove", this.recordMousepos);
							if (data.plaform) {
								this.handleInstructionsBreak(
									data.stage,
									data.block,
									data.data,
									data.platform
								);
							} else {
								this.handleInstructionsBreak(data.stage, data.block, data.data);
							}
							break;
					}
			}
		};
	}
	preloadImages(imageList, imgArray) {
		imageList.forEach((image) => {
			const img = new Image();
			img.src = image;
			imgArray.push(img);
		});
	}

	resetCanvas(canvas) {
		canvas.remove();
		let canvas2 = document.createElement("canvas");
		this.ctx = canvas2.getContext("2d");
		if (this.container) {
			this.container.appendChild(canvas2);
		} else {
			let container = document.getElementById(this.containerId);
			container.appendChild(canvas2);
		}
		return canvas2;
	}
	displayBlockInstructions(stage, block) {
		this.stage = stage;
		this.block = block;
		if (block === "sep") {
			loadSepInstructions("main", this.ws);
		} else if (block === "collab") {
			loadCollabInstructions("main", this.ws);
		}
	}
	createTimestamp(timestamp) {
		let newTime = Date.now();
		let diff = newTime - timestamp;
		return diff;
	}
	resizeCanvas() {
		this.canvas.width = this.container.clientWidth;
		this.canvas.height = this.container.clientHeight;
		this.render();
	}
	render() {
		// Clear canvas
		this.ctx.fillStyle = this.backgroundColor;
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
	}
	clearContainer() {
		const container = document.getElementById(this.containerId);
		// Use Array.from to safely iterate over the NodeList
		Array.from(container.childNodes).forEach((child) => {
			// Check if the child is not a canvas
			if (child.nodeName != "CANVAS") {
				// Remove the child from the container
				container.removeChild(child);
			}
		});
	}
	static loadContent(contentLoader, ...args) {
		contentLoader(...args);
	}
	resetDivs() {
		this.divs.completed = [];
		this.divs.uncompleted = [];
	}
	findKeyByValue(obj, value) {
		return Object.keys(obj).find((key) => obj[key] === value);
	}
	createImages(images) {
		if (this.breakdiv) {
			this.breakdiv.remove();
		}
		const pixelPos = [
			// Top Center
			[this.canvas.height / 8, this.canvas.width / 2],
			// Top Right
			[this.canvas.height / 4, (this.canvas.width / 4) * 3],
			// Right Center
			[this.canvas.height / 2, (this.canvas.width / 8) * 7],
			// Bottom Right
			[(this.canvas.height / 4) * 3, (this.canvas.width / 4) * 3],
			// Bottom Center
			[(this.canvas.height / 8) * 7, this.canvas.width / 2],
			// Bottom Left
			[(this.canvas.height / 4) * 3, this.canvas.width / 4],
			// Left Center
			[this.canvas.height / 2, this.canvas.width / 8],
			// Top Left
			[this.canvas.height / 4, this.canvas.width / 4],
		];
		for (let i = 0; i < Object.keys(this.coherenceDifficulties).length; i++) {
			const div = document.createElement("div");
			const img = images[i];
			let coherence = this.state.RDK.coherence[i];
			let difficulty = this.coherenceDifficulties[coherence];
			img.style.width = "75px"; // Set image width
			img.style.height = "75px"; // Set image height
			div.style.position = "absolute";
			div.style.width = "75px";
			div.style.height = "75px";
			div.style.left = `${pixelPos[i][1] - 37.5}px`; // Center the div horizontally
			div.style.top = `${pixelPos[i][0] - 37.5}px`; // Center the div vertically
			div.id = i;
			div.appendChild(img); // Append image to the div
			this.divs.uncompleted.push(div); // Store reference to the div
			this.displayDifficultyText(div, difficulty, i); // Display difficulty text
			this.container.appendChild(div);
		}
	}
	handleInstructionsBreak(stage, block, data, platform) {
		if (stage === "game") {
			switch (data) {
				case "endBlock":
					switch (block) {
						case "sep":
							this.block = "collab";
							this.displayBlockInstructions(stage, this.block);
							setTimeout(() => {
								this.ws.send(
									JSON.stringify({
										stage: stage,
										block: this.block,
										type: "gameReady",
									})
								);
							}, 30 * 1000);
							break;
						case "collab":
							this.block = "sep";
							this.displayBlockInstructions(stage, this.block);
							setTimeout(() => {
								this.ws.send(
									JSON.stringify({
										stage: stage,
										block: this.block,
										type: "gameReady",
									})
								);
							}, 30 * 1000);
					}
					break;
				case "endExp":
					loadEndGame("main", this.ws, platform);
					break;
			}
		}
	}
	beginBreak(blockType, block, data) {
		if (blockType === "game") {
			if (block === "sep") {
				document.removeEventListener("keydown", this.responseHandler);
				document.removeEventListener("mousemove", this.recordMousepos);
				// Create a div element for the break overlay
				const breakDiv = document.createElement("div");
				let breakText = "";
				breakText = `<div align="center">
				<p> 
				You have completed ${this.trialNo} of ${this.expConsts.blockLength} trials in this block. Please take a 6 second break.
				</p>
				<p>
				You completed ${data.P1completed} out of 8 tasks in 6 seconds.
				</p>
				</div>`;
				breakDiv.className = "breakDiv";
				breakDiv.style.position = "absolute";
				breakDiv.style.top = "0";
				breakDiv.style.left = "0";
				breakDiv.style.width = "100%";
				breakDiv.style.height = "100%";
				breakDiv.style.display = "flex";
				breakDiv.style.justifyContent = "center"; // Center horizontally
				breakDiv.style.alignItems = "center"; // Center vertically
				breakDiv.style.backgroundColor = "#808080"; // Semi-transparent black background
				breakDiv.innerHTML = breakText;

				// Append breakDiv to the document body or another parent element
				document.body.appendChild(breakDiv); // Example: Append to body

				// Optionally, you might want to return breakDiv if you need to manipulate or remove it later
				return breakDiv;
			} else if (block === "collab") {
				this.stopAnimation(); // Assuming this method stops some animation
				this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Clear the canvas
				this.clearImageDivs(); // Clear the image divs
				document.removeEventListener("keydown", this.responseHandler);
				let breakText = "";
				breakText = `<div align="center">
				<p> 
				You have completed ${this.trialNo} of ${this.expConsts.blockLength} trials in this block. Please take a 6 second break.
				</p>
				<p>
				You completed ${data.P1completed} tasks and your partner completed ${data.P2completed} tasks out of 8 <br>
				in 6 seconds.
				</p>
				</div>`;

				// Create a div element for the break overlay
				const breakDiv = document.createElement("div");
				breakDiv.className = "breakDiv";
				breakDiv.style.position = "absolute";
				breakDiv.style.top = "0";
				breakDiv.style.left = "0";
				breakDiv.style.width = "100%";
				breakDiv.style.height = "100%";
				breakDiv.style.display = "flex";
				breakDiv.style.justifyContent = "center"; // Center horizontally
				breakDiv.style.alignItems = "center"; // Center vertically
				breakDiv.style.backgroundColor = "#808080"; // Semi-transparent black background
				breakDiv.innerHTML = breakText;

				// Append breakDiv to the document body or another parent element
				document.body.appendChild(breakDiv); // Example: Append to body

				// Optionally, you might want to return breakDiv if you need to manipulate or remove it later
				return breakDiv;
			}
		} else if (blockType === "practice") {
			if (block === "sep") {
				this.stopAnimation(); // Assuming this method stops some animation
				this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Clear the canvas
				this.clearImageDivs(); // Clear the image divs
				document.removeEventListener("keydown", this.responseHandler);
				let breakText = "";

				breakText = `<div align="center">
				<p> 
				You have completed ${this.trialNo} of 10 practice trials. Please take a 12 second break.
				</p>
				<p>
				You completed ${data.P1completed} out of 8 tasks in 12 seconds.
				</p>
				</div>`;

				// Create a div element for the break overlay
				const breakDiv = document.createElement("div");
				breakDiv.className = "breakDiv";
				breakDiv.style.position = "absolute";
				breakDiv.style.top = "0";
				breakDiv.style.left = "0";
				breakDiv.style.width = "100%";
				breakDiv.style.height = "100%";
				breakDiv.style.display = "flex";
				breakDiv.style.justifyContent = "center"; // Center horizontally
				breakDiv.style.alignItems = "center"; // Center vertically
				breakDiv.style.backgroundColor = "#808080"; // Semi-transparent black background
				breakDiv.innerHTML = breakText;

				// Append breakDiv to the document body or another parent element
				document.body.appendChild(breakDiv); // Example: Append to body

				// Optionally, you might want to return breakDiv if you need to manipulate or remove it later
				return breakDiv;
			} else if (block === "collab") {
				if (this.trialNo === 7) {
					this.stopAnimation(); // Assuming this method stops some animation
					this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Clear the canvas
					this.clearImageDivs(); // Clear the image divs
					document.removeEventListener("keydown", this.responseHandler);
					let breakText = "";
					breakText = `<div align="center">
				<p> 
				You have completed ${this.trialNo} of 10 practice trials. Please take a 12 second break.
				</p>
				<p>
				You completed ${data.P1completed} tasks and your partner completed ${data.P2completed} tasks out of 8.
				</p>
				<p> 
				The next 3 trials will be completed the same as the experiment. The trial will last 6 seconds, with a 6 second break inbetween trials. 
				</p>
				</div>`;

					// Create a div element for the break overlay
					const breakDiv = document.createElement("div");
					breakDiv.className = "breakDiv";
					breakDiv.style.position = "absolute";
					breakDiv.style.top = "0";
					breakDiv.style.left = "0";
					breakDiv.style.width = "100%";
					breakDiv.style.height = "100%";
					breakDiv.style.display = "flex";
					breakDiv.style.justifyContent = "center"; // Center horizontally
					breakDiv.style.alignItems = "center"; // Center vertically
					breakDiv.style.backgroundColor = "#808080"; // Semi-transparent black background
					breakDiv.innerHTML = breakText;

					// Append breakDiv to the document body or another parent element
					document.body.appendChild(breakDiv); // Example: Append to body

					// Optionally, you might want to return breakDiv if you need to manipulate or remove it later
					return breakDiv;
				} else if (this.trialNo < 7) {
					this.stopAnimation(); // Assuming this method stops some animation
					this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Clear the canvas
					this.clearImageDivs(); // Clear the image divs
					document.removeEventListener("keydown", this.responseHandler);
					let breakText = "";
					breakText = `<div align="center">
					<p> 
					You have completed ${this.trialNo} of 10 practice trials. Please take a 12 second break.
					</p>
					<p>
					You completed ${data.P1completed} tasks and your partner completed ${data.P2completed} tasks out of 8 in 12 seconds.
					</p>
					</div>`;

					// Create a div element for the break overlay
					const breakDiv = document.createElement("div");
					breakDiv.className = "breakDiv";
					breakDiv.style.position = "absolute";
					breakDiv.style.top = "0";
					breakDiv.style.left = "0";
					breakDiv.style.width = "100%";
					breakDiv.style.height = "100%";
					breakDiv.style.display = "flex";
					breakDiv.style.justifyContent = "center"; // Center horizontally
					breakDiv.style.alignItems = "center"; // Center vertically
					breakDiv.style.backgroundColor = "#808080"; // Semi-transparent black background
					breakDiv.innerHTML = breakText;

					// Append breakDiv to the document body or another parent element
					document.body.appendChild(breakDiv); // Example: Append to body

					// Optionally, you might want to return breakDiv if you need to manipulate or remove it later
					return breakDiv;
				} else {
					this.stopAnimation(); // Assuming this method stops some animation
					this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Clear the canvas
					this.clearImageDivs(); // Clear the image divs
					document.removeEventListener("keydown", this.responseHandler);
					let breakText = "";
					breakText = `<div align="center">
					<p> 
					You have completed ${this.trialNo} of 10 practice trials. Please take a 6 second break.
					</p>
					<p>
					You completed ${data.P1completed} tasks and your partner completed ${data.P2completed} tasks out of 8 in 6 seconds.
					</p>
					</div>`;

					// Create a div element for the break overlay
					const breakDiv = document.createElement("div");
					breakDiv.className = "breakDiv";
					breakDiv.style.position = "absolute";
					breakDiv.style.top = "0";
					breakDiv.style.left = "0";
					breakDiv.style.width = "100%";
					breakDiv.style.height = "100%";
					breakDiv.style.display = "flex";
					breakDiv.style.justifyContent = "center"; // Center horizontally
					breakDiv.style.alignItems = "center"; // Center vertically
					breakDiv.style.backgroundColor = "#808080"; // Semi-transparent black background
					breakDiv.innerHTML = breakText;

					// Append breakDiv to the document body or another parent element
					document.body.appendChild(breakDiv); // Example: Append to body

					// Optionally, you might want to return breakDiv if you need to manipulate or remove it later
					return breakDiv;
				}
			}
		}
	}

	displayBlockBreak(stage, block) {
		if (stage === "practice") {
			this.stopAnimation();
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			this.clearImageDivs();
			document.removeEventListener("keydown", this.responseHandler);
			document.removeEventListener("mousemove", this.recordMousepos);
			let breakText = "";
			breakText = `<div align="center">
				<p> 
				You have completed ${this.trialNo} of 10 practice trials. Please take a short 20 second break.
				</p>
				<p>
				The next 5 trials will be completed with a partner. 
				</p>
				</div>`;
			const breakDiv = document.createElement("div");
			breakDiv.style.position = "absolute";
			breakDiv.style.top = "0";
			breakDiv.style.left = "0";
			breakDiv.style.width = "100%";
			breakDiv.style.height = "100%";
			breakDiv.style.display = "flex";
			breakDiv.style.justifyContent = "center"; // Center horizontally
			breakDiv.style.alignItems = "center"; // Center vertically
			breakDiv.style.backgroundColor = "#808080"; // Semi-transparent black background
			breakDiv.innerHTML = breakText;
			document.body.appendChild(breakDiv);
			setTimeout(() => {
				this.ws.send(
					JSON.stringify({
						stage: stage,
						block: block,
						type: "gameReady",
					})
				);
			}, this.expConsts.blockBreak * 1000);
			return breakDiv;
		} else if (stage === "game") {
			this.stopAnimation();
			document.removeEventListener("keydown", this.responseHandler);
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			this.clearImageDivs();
			let breakText = "";
			breakText = `<div align="center">
				<p> 
				You have completed ${this.trialNo} of 40 trials. You are now halfway through the Experiment! Please take a short 30 second break.
				</p>
				<p>
				You completed ${data.P1completed} tasks out of 8. <br>
				</p>
				</div>`;
			const breakDiv = document.createElement("div");
			breakDiv.style.position = "absolute";
			breakDiv.style.top = "0";
			breakDiv.style.left = "0";
			breakDiv.style.width = "100%";
			breakDiv.style.height = "100%";
			breakDiv.style.display = "flex";
			breakDiv.style.justifyContent = "center"; // Center horizontally
			breakDiv.style.alignItems = "center"; // Center vertically
			breakDiv.style.backgroundColor = "#808080"; // Semi-transparent black background

			const breakTextDiv = document.createElement("div");
			breakTextDiv.style.color = "#000000";
			breakTextDiv.style.fontSize = "24px";
			breakTextDiv.textContent = breakText;
			breakDiv.appendChild(breakTextDiv);
			document.body.appendChild(breakDiv);
			setTimeout(() => {
				this.ws.send(
					JSON.stringify({
						stage: stage,
						block: block,
						type: "gameReady",
					})
				);
			}, this.expConsts.blockBreak * 1000);
			return breakDiv;
		}
	}

	updateState(data, block) {
		let newState = data;
		return newState;
	}

	clearImageDivs() {
		if (this.divs && this.img) {
			for (let img of this.img) {
				img.style.display = "block";
			}
			// Remove completed divs
			this.divs.completed.forEach((div) => this.removeElement(div));
			// Remove uncompleted divs
			this.divs.uncompleted.forEach((div) => this.removeElement(div));

			// Reset imageDivs to empty arrays
			this.divs.completed = [];
			this.divs.uncompleted = [];
		}
	}
	removeElement(element) {
		if (element && element.parentNode) {
			element.parentNode.removeChild(element);
		}
	}

	mouseOverHandler(event) {
		event.currentTarget.style.opacity = 0.5;
	}

	mouseOutHandler(event) {
		event.currentTarget.style.opacity = 1;
	}

	clickHandler(event) {
		let choiceEndTime = this.createTimestamp(this.choiceTimestamp);
		this.ws.send(
			JSON.stringify({
				stage: this.stage,
				block: this.block,
				type: "difficulty",
				difficulty: event.currentTarget.id,
				rt: choiceEndTime,
			})
		);
	}
	addResponseHandler(Index) {
		const responseHandler = (event) => {
			event.preventDefault();

			if (event.key === "x") {
				let dotRT = this.createTimestamp(this.dotTimestamp);
				let totalRT = this.createTimestamp(this.totalRTTimestamp);
				this.ws.send(
					JSON.stringify({
						stage: this.stage,
						block: this.block,
						type: "response",
						index: Index,
						data: "right",
						rt: dotRT,
						totalRt: totalRT,
					})
				);
			} else if (event.key === "z") {
				let dotRT = this.createTimestamp(this.dotTimestamp);
				let totalRT = this.createTimestamp(this.totalRTTimestamp);
				this.ws.send(
					JSON.stringify({
						stage: this.stage,
						block: this.block,
						type: "response",
						index: Index,
						data: "left",
						rt: dotRT,
						totalRt: totalRT,
					})
				);
			}
		};
		document.addEventListener("keydown", responseHandler);
		// Optional: return the handler function in case you need to remove it later
		return responseHandler;
	}
	recordMousepos(event) {
		const x = event.clientX;
		const y = event.clientY;
		const width = window.innerWidth;
		const height = window.innerHeight;
		this.ws.send(
			JSON.stringify({
				stage: this.stage,
				block: this.block,
				type: "mousePos",
				dimmensions: { width, height },
				data: { x, y },
			})
		);
	}
	handleCompletedImages(ID, divObj) {
		// Check if the ID exists in divObj.uncompleted
		document.addEventListener("mousemove", this.recordMousepos);
		document.removeEventListener("keydown", this.responseHandler);
		let completedDiv = divObj.uncompleted.find((div) => div.id === ID);
		if (!completedDiv) {
			return divObj; // Return the original divObj without any changes
		}

		// Add the completedDiv to divObj.completed
		divObj.completed.push(completedDiv);

		// Remove the completedDiv from divObj.uncompleted
		divObj.uncompleted = divObj.uncompleted.filter((div) => div.id !== ID);

		return divObj;
	}
	restoreCompletedImages(divObj) {
		this.responseHandler = null;
		for (let div of divObj.completed) {
			this.removeEventListeners(div);
			div.style.opacity = 0.5;
			div.querySelector("img").style.display = "block";
			let difficultyText = div.querySelector("div");
			if (difficultyText) {
				difficultyText.style.display = "block";
			}
		}
	}
	restoreUncompletedImages(divObj) {
		for (let div of divObj.uncompleted) {
			div.style.opacity = 1;
			let difficultyText = div.querySelector("div");

			if (difficultyText) {
				difficultyText.style.display = "block";
			}
		}
		this.handleDivInteraction(divObj.uncompleted);
	}
	restoreImages(divObj) {
		if (this.currentlyCompleting) {
			return;
		} else {
			this.restoreCompletedImages(divObj);
			this.restoreUncompletedImages(divObj);
			this.choiceStartTime = performance.now();
		}
	}
	displayDifficultyText(parentDiv, difficulty, id) {
		const difficultyText = document.createElement("div");
		difficultyText.textContent = difficulty;
		difficultyText.style.position = "absolute";
		difficultyText.style.bottom = "-20px"; // Adjust to position under the image div
		difficultyText.style.width = "100%"; // Full width
		difficultyText.style.textAlign = "center"; // Center text horizontally
		difficultyText.style.fontSize = "18px";
		difficultyText.id = id;
		parentDiv.appendChild(difficultyText);
	}
	removeDiv(divList) {
		for (let div of divList) {
			div.style.opacity = "0.5";
			this.removeEventListeners(div);
		}
	}

	handleDivInteraction(divList) {
		document.addEventListener("mousemove", this.recordMousepos);
		for (let div of divList) {
			div.addEventListener("mouseover", this.mouseOverHandler);
			div.addEventListener("mouseout", this.mouseOutHandler);
			div.addEventListener("click", this.clickHandler);
		}
	}

	removeEventListeners(div) {
		document.removeEventListener("keydown", this.responseHandler);
		document.removeEventListener("mousemove", this.recordMousepos);
		if (div && div.parentNode) {
			div.removeEventListener("mouseover", this.mouseOverHandler);
			div.removeEventListener("mouseout", this.mouseOutHandler);
			div.removeEventListener("click", this.clickHandler);
		}
	}

	removeOtherDivs(divList, selectedDiv) {
		for (let div of divList) {
			this.removeEventListeners(div);
			if (div.id !== selectedDiv) {
				div.style.opacity = "0.5";
			}
			if (div.id === selectedDiv) {
				this.removeEventListeners(div);
				let difficultyText = div.querySelector("div");
				if (difficultyText) {
					difficultyText.style.display = "none";
				}
			}
		}
	}
	drawNewDirection(Index, divlist, expConsts, direction) {
		this.stopAnimation();
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		document.removeEventListener("keydown", this.responseHandler);
		this.responseHandler = null;

		setTimeout(() => {
			this.dotTimestamp = Date.now();
			this.generateDotMotionAperture(Index, divlist, expConsts, direction);
			this.responseHandler = this.addResponseHandler(Index);
		}, expConsts.pauseDuration);
	}
	drawDot(x, y) {
		this.ctx.fillStyle = this.expConsts.dotColor;
		this.ctx.beginPath();
		this.ctx.arc(x, y, this.expConsts.dotRad, 0, Math.PI * 2, true);
		this.ctx.closePath();
		this.ctx.fill();
	}
	drawCircle(centerX, centerY, radius) {
		// Adjust canvas size to cover the entire window
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;

		// Draw the circle
		this.ctx.beginPath();
		this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
		this.ctx.fillStyle = "#808080";
		this.ctx.fill();
		this.ctx.strokeStyle = "black"; // Set border color to the provided borderColor
		this.ctx.lineWidth = 1; // Optionally, set the border width
		this.ctx.stroke();
		this.ctx.closePath();
	}

	drawManyDots(centerX, centerY, apertureRadius, ndots, coherence, direction) {
		// Calculate number of coherent dots
		const dotCoherence = Math.round(ndots * coherence);
		let dotDict = {};

		// Generate random directions for each dot
		for (let i = 0; i < ndots; i++) {
			let dotDirection;
			if (i > dotCoherence) {
				// Coherent dots move in the specified direction
				dotDirection = direction;
			} else {
				dotDirection = "random";
			}

			// Generate random positions within the aperture
			const randomAngle = Math.random() * 2 * Math.PI;
			const randomRadius = Math.random() * apertureRadius;

			// Calculate dot position relative to center
			let dotX = centerX + randomRadius * Math.cos(randomAngle);
			let dotY = centerY + randomRadius * Math.sin(randomAngle);

			dotDict[i] = {
				x: dotX,
				y: dotY,
				direction: dotDirection,
				alive: true,
				angle: randomAngle,
			};
		}

		return dotDict;
	}
	moveDots(dotDict, centerX, centerY, apertureRadius) {
		for (let dot in dotDict) {
			if (dotDict[dot].alive) {
				switch (dotDict[dot].direction) {
					case "random":
						dotDict[dot].x +=
							this.expConsts.dotSpeed * Math.cos(dotDict[dot].angle);
						dotDict[dot].y +=
							this.expConsts.dotSpeed * Math.sin(dotDict[dot].angle);
						break;
					case "left":
						dotDict[dot].x -= this.expConsts.dotSpeed;
						break;
					case "right":
						dotDict[dot].x += this.expConsts.dotSpeed;
						break;
				}

				// Check if the dot is outside the aperture and reset if necessary
				if (
					Math.sqrt(
						(dotDict[dot].x - centerX) ** 2 + (dotDict[dot].y - centerY) ** 2
					) > apertureRadius
				) {
					dotDict[dot] = this.killDots(
						dotDict[dot],
						centerX,
						centerY,
						apertureRadius
					);
				}
			}
		}
		return dotDict;
	}
	killDots(dot, centerX, centerY, apertureRadius) {
		const randomRadius = Math.random() * apertureRadius;
		const randomAngle = Math.random() * 2 * Math.PI;
		dot.x = centerX + randomRadius * Math.cos(randomAngle);
		dot.y = centerY + randomRadius * Math.sin(randomAngle);
		dot.angle = Math.random() * 2 * Math.PI;
		dot.alive = true;
		return dot;
	}
	animateDots(centerX, centerY, apertureRadius) {
		if (!this.animating) return;

		// Clear the entire canvas before drawing
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		// Redraw aperture circle
		this.drawCircle(centerX, centerY, apertureRadius);

		// Move and redraw dots
		this.dotDict = this.moveDots(
			this.dotDict,
			centerX,
			centerY,
			apertureRadius
		);
		for (let dot in this.dotDict) {
			const { x, y, direction } = this.dotDict[dot];
			const color = direction === "random" ? "red" : "green";
			if (
				Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) <= apertureRadius
			) {
				this.drawDot(x, y, color);
			}
		}

		// Request next animation frame if still animating
		if (this.animating) {
			requestAnimationFrame(() =>
				this.animateDots(centerX, centerY, apertureRadius)
			);
		}
	}
	stopAnimation() {
		this.animating = false;
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
	}
	generateDotMotionAperture(divID, divlist, expConsts, direction) {
		// Clear previous drawings
		this.currentlyCompleting = true;
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.setzIndex = 1;
		let coherence = this.state.RDK.coherence[divID];

		// Find the correct div based on divID
		const selectedDiv = divlist.find((div) => div.id === divID);
		if (!selectedDiv) {
			this.restoreCompletedImages(this.divs);
			return;
		}
		const divImage = selectedDiv.querySelector("img");
		const divText = selectedDiv.querySelector("div");
		divImage.style.display = "none"; // Hide the image
		divText.style.display = "none"; // Hide the difficulty text
		if (selectedDiv) {
			const centerX = selectedDiv.offsetLeft + selectedDiv.clientWidth / 2;
			const centerY = selectedDiv.offsetTop + selectedDiv.clientHeight / 2;
			const apertureRadius = expConsts.apertureRad;
			const nDots = expConsts.nDots;
			// Generate initial dots
			this.dotDict = this.drawManyDots(
				centerX,
				centerY,
				apertureRadius,
				nDots,
				coherence,
				direction
			);
			// Start the animation loop
			this.dotStartTime = performance.now();
			this.animating = true;
			this.animateDots(centerX, centerY, apertureRadius);
		}
	}
	setBackgroundColor(color) {
		this.backgroundColor = color;
		this.render();
	}
	destroy() {
		// Clean up canvas and remove event listener
		this.canvas.remove();

		// Remove resize event listener
		window.removeEventListener("resize", this.resizeCanvas.bind(this));

		// Stop any ongoing animations
		this.animating = false;

		// Remove mouse event listeners if they were added to the canvas
		this.canvas.removeEventListener("mousemove", this.getMousePos.bind(this));

		// Clear image divs
		this.clearImageDivs();

		// Remove mouse over, out, and click handlers for each div
		for (let div of this.divs.uncompleted.concat(this.divs.completed)) {
			this.removeEventListeners(div);
		}

		// Remove response handler if exists
		if (this.responseHandler) {
			document.removeEventListener("keydown", this.responseHandler);
		}
		document.removeEventListener("keydown", this.responseHandler);
		document.removeEventListener("mouseover", this.mouseOverHandler);
		document.removeEventListener("mouseout", this.mouseOutHandler);
		this.ws.send(
			JSON.stringify({
				stage: this.stage,
				block: this.block,
				type: "destroy",
			})
		);
	}
}
