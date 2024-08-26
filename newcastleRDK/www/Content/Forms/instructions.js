/*
This file contains the HTML for the instructions that are displayed to the user at the start of the experiment and during each block. 
MAY NEED TO ADD A REDIRECT FOR PROLIFIC OR SONA PARTICIPANTS AT THE END, DEPENDING ON HOW THE EXPERIMENT IS BEING RUN
*/
const instructionsHTML = `
<div style="text-align: center;">
<h1>Instructions</h1>
</div>

<div class = "instructions" align="center">
<p> In this experiment, you will be asked to select an image displaying a number of dots moving on the screen. Within this image, some of the dots will be moving in the same direction (either left or right)
 and others will be moving in a random direction. Your task is to identify the direction in which the majority of the dots are moving. This will vary from very easy, where many of the dots are moving
 in the same direction, to very difficult, where only a few dots are moving in the same direction, responding as quickly and accurately as you can.</p>
<p> There are two blocks consisting of 30 trials 6 seconds in length, 60 trials in total. In one block you will perform this by yourself, and in the other you will be paired with another participant. <br>
The experiment will take roughly 30 minutes to complete. </p>
<p> During the experiment you will encounter several instructions pages where you can take your time to read it, requiring your to press enter to continue. <br>
While we encourage you to take your time to read and understand these instructions, we also encourage you to consider the other person completing the experiment with you <br>
and respect their time.  </p>
<p> We appreciate your participation</p>
<p> Please press enter to view the practice instructions </p>
</div>
`;
let instructionEventListenerAttached = false;

function loadInstructions(targetElementId, ws) {
	const targetElement = document.getElementById(targetElementId);
	if (targetElement) {
		targetElement.innerHTML = instructionsHTML;

		// Ensure the event listener is not attached more than once
		if (!instructionEventListenerAttached) {
			const keyPressHandler = (event) => {
				if (event.key === "Enter") {
					loadPracticeInstructions(targetElementId, ws);
					// Remove the event listener
					document.removeEventListener("keyup", keyPressHandler);
					instructionEventListenerAttached = false;
				}
			};

			// Add the event listener
			document.addEventListener("keyup", keyPressHandler);
			instructionEventListenerAttached = true;
		}
	} else {
		console.error(`Target element with ID '${targetElementId}' not found.`);
	}
}
const practiceInstructionsHTML = `
<div style="text-align: center;">
<h1>Practice Instructions</h1>
</div>
<div class = "practiceInstructions" align="center">
<p> In this block, you will complete 10 trials, 5 by yourself and 5 with your partner. You are free to select the order in which you complete the different dot motion difficulties. <br>
Initially, the trials will be 12 seconds with a 12 second break. Later it will switch to 6 second trials with a 6 second break, matching the experiment. <br>
Here, you will use the mouse to select a difficulty level by clicking on it, then responding with either "Z" for left or "X" for right when you think you know which direction the dots are moving. <br>
If you respond incorrectly, there will be a 500ms delay before you can respond again. <br>
Please try and complete each task as quickly and accurately as possible. <br>
Please press enter to begin the practice block.
</div>
`;
function loadPracticeInstructions(targetElementId, ws) {
	const targetElement = document.getElementById(targetElementId);
	if (targetElement) {
		targetElement.innerHTML = practiceInstructionsHTML;

		const keyPressHandler = (event) => {
			if (event.key === "Enter") {
				setTimeout(() => {
					handleStartExperiment(ws);
					document.removeEventListener("keyup", keyPressHandler);
				}, 1000);

				// Create and insert the "waiting for other player" message
				let waitingMessage = document.createElement("p");
				waitingMessage.innerText = "Waiting for other player...";
				waitingMessage.style.textAlign = "center";
				waitingMessage.style.fontSize = "16px";
				waitingMessage.style.color = "black";
				targetElement.appendChild(waitingMessage);
			}
		};

		document.addEventListener("keyup", keyPressHandler);
	} else {
		console.error(`Target element with ID '${targetElementId}' not found.`);
	}
}

function handleStartExperiment(ws) {
	ws.send(JSON.stringify({ stage: "intro", type: "completedInstructions" }));
}

const sepInstructionsHTML = `
<div style="text-align: center;">
<h1>Instructions</h1>
</div>
<div class = "sepInstructions align="center">
<p> 
In this block, you will complete the 30 trials by yourself. You are free to select the order in which you complete the different dot motion difficulties. 
Each trial will last 6 seconds, with a 6 second break inbetween trials. <br>
Remember to select the difficulty by clicking, and responding with "Z" for left and "X" for right. Be careful of the 500ms incorrect penalty!
</p>
<p>
Please try and complete each trial as quickly and accurately as possible. <br>
 Please press enter to begin the block
</p>
</div>
`;
let sepInstructionsHandler = null;

function loadSepInstructions(targetElementId, ws) {
	const targetElement = document.getElementById(targetElementId);
	if (targetElement) {
		targetElement.innerHTML = sepInstructionsHTML;

		// Cleanup previous event listener if exists
		if (sepInstructionsHandler) {
			document.removeEventListener("keyup", sepInstructionsHandler);
		}

		// Define the event handler function
		sepInstructionsHandler = function (event) {
			if (event.key === "Enter") {
				// Handle the event
				handleSepIntructions(ws);

				// Remove the event listener after handling
				document.removeEventListener("keyup", sepInstructionsHandler);

				// Create and insert the "waiting for other player" message
				const waitingMessage = document.createElement("p");
				waitingMessage.innerText = "Waiting for other player...";
				waitingMessage.style.textAlign = "center";
				waitingMessage.style.fontSize = "20px";
				waitingMessage.style.color = "black";
				targetElement.appendChild(waitingMessage);
			}
		};

		// Add the event listener
		document.addEventListener("keyup", sepInstructionsHandler);
	} else {
		console.error(`Target element with ID '${targetElementId}' not found.`);
	}
}

function handleSepIntructions(ws) {
	ws.send(
		JSON.stringify({
			stage: "game",
			block: "sep",
			type: "instructionsComplete",
		})
	);
}

const collabInstructionsHTML = `
<div style="text-align: center;">
<h1>Instructions</h1>
</div>
<div class = "collabInstructions" align="center">
<p> In this block, you will complete 20 trials paired with another participant. You are free to select the order in which you complete the different dot motion difficulties, although you cannot complete one that your partner is completing, 
or has already completed. Each trial will last 6 seconds, with a 6 second break inbetween trials. <br> 
Remember to select the difficulty by clicking, and responding with "Z" for left and "X" for right. Be careful of the 500ms incorrect penalty! </p>
<p> Please try and complete each trial as quickly and accurately as possible. </p> 
<p> Please press enter to begin the block </p>
`;
let collabInstructionsHandler = null;

function loadCollabInstructions(targetElementId, ws) {
	const targetElement = document.getElementById(targetElementId);
	if (targetElement) {
		targetElement.innerHTML = collabInstructionsHTML;

		// Remove the previous event listener if it exists
		if (collabInstructionsHandler) {
			document.removeEventListener("keydown", collabInstructionsHandler);
		}

		// Define the event handler function
		collabInstructionsHandler = function (event) {
			if (event.key === "Enter") {
				// Handle the event
				handleCollabInstructions(ws);

				// Remove the event listener after handling
				document.removeEventListener("keydown", collabInstructionsHandler);

				// Create and insert the "waiting for other player" message
				const waitingMessage = document.createElement("p");
				waitingMessage.innerText = "Waiting for other player...";
				waitingMessage.style.textAlign = "center";
				waitingMessage.style.fontSize = "20px";
				waitingMessage.style.color = "black";
				targetElement.appendChild(waitingMessage);
			}
		};

		// Add the event listener
		document.addEventListener("keydown", collabInstructionsHandler);
	} else {
		console.error(`Target element with ID '${targetElementId}' not found.`);
	}
}

function handleCollabInstructions(ws) {
	ws.send(
		JSON.stringify({
			stage: "game",
			block: "collab",
			type: "instructionsComplete",
		})
	);
}

const endGameHTML = `
<div style="text-align: center;">
<h1>End of Experiment</h1>
</div>
<div class = "end-of-experiment" align="center">
<p> Congratulations! You have now completed the experiment, we appreciate your participation. </p>
<p> Your participation in this experiment is fascilitating an invesitgation into how people make decisions and schedule tasks 
both by themselves and in a team environment. We aim to investigate how and why people deviate from the "optimal" decision making process. 
For example, in the task you just completed, the optimal strategy to get the most reward for time invested was to complete each task from easiest to hardest.
Why do people deviate from this strategy, and how do they progress to this strategy (or something close to it) as the task continues? How is this process
different for those operating by themselves versus with a partner? These are the questions and processes we wish to investigate. <br>
If you would like more information or have any questions, please contact Luke Russell at: 
 LRussell1@uon.edu.au </p>
<p> Thank you for your time and participation. This connection will close in 5 minutes. </p>
<p> Please press enter to complete the experiment and return to either Prolific or SONA before this occurs</p>
</div>`;

let endGameHandler = null;
function loadEndGame(targetElementId, ws, id, platform) {
	const targetElement = document.getElementById(targetElementId);
	if (targetElement) {
		targetElement.innerHTML = endGameHTML;
		ws.send(JSON.stringify({ stage: "end", type: "pageReached" }));
		if (endGameHandler) {
			document.removeEventListener("keydown", endGameHandler);
		}
		endGameHandler = function (event) {
			if (event.key === "Enter") {
				handleRedirect(ws, platform);
			}
		};
		document.addEventListener("keydown", endGameHandler);
	} else {
		console.error(`Target element with ID '${targetElementId}' not found.`);
	}
}
function handleRedirect(ws, platform) {
	if (platform === "prolific") {
		window.location.replace(
			"https://app.prolific.com/submissions/complete?cc=CHVSXHS4"
		);
		ws.send(JSON.stringify({ stage: "end", type: "redirect" }));
	} else {
		window.location.replace("https://www.newcastle.edu.au/");
		ws.send(JSON.stringify({ stage: "end", type: "redirect" }));
	}
}
export {
	loadInstructions,
	loadSepInstructions,
	loadCollabInstructions,
	loadEndGame,
};
