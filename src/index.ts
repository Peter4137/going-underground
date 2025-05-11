import {
    calculateChosenPathTime,
    calculateOptimalPath,
    checkLink,
    connectingLineColors,
    getMatchingStationNames,
    randomStation,
    stationLineColors,
} from "./network.js";

import { StationName } from "./data.js";

let lives = 3;
const livesContainer: HTMLElement = document.querySelector('.lives-container') as HTMLElement;
let visitedStations: StationName[];
let goalStation: StationName;

let visitedStationsContainer: HTMLElement;
let goalStationContainer: HTMLElement;
let userInput: HTMLInputElement;
let submitButton: HTMLInputElement;
// Popup element references
let popupOverlay: HTMLElement;
let popupMessageElement: HTMLElement;
let popupCloseButton: HTMLElement;
// Toast element references
let toastElement: HTMLElement;
let toastMessageElement: HTMLElement;
let toastTimeoutId: number | null = null; // To manage the hide timeout
// Hint elements
let hintButton: HTMLInputElement;
let hintLinesContainer: HTMLElement;
// Help Popup elements
let helpButtonElement: HTMLElement;
let helpPopupOverlay: HTMLElement;
let helpPopupCloseButton: HTMLElement;
// Game End Popup elements
let playAgainButton: HTMLElement;
let popupOptimalPath: HTMLElement;
// Game state variables
const INITIAL_LIVES = 3;

document.addEventListener('DOMContentLoaded', async () => {
    visitedStationsContainer = document.querySelector('.visited-stations-container') as HTMLElement;
    goalStationContainer = document.getElementById('goal-station-container') as HTMLElement;
    userInput = document.getElementById('user-input') as HTMLInputElement;
    submitButton = document.getElementById('submit-button') as HTMLInputElement;
    // Assign popup elements
    popupOverlay = document.getElementById('popup-overlay') as HTMLElement;
    popupMessageElement = document.getElementById('popup-message') as HTMLElement;
    popupCloseButton = document.getElementById('popup-close-button') as HTMLElement;
    playAgainButton = document.getElementById('popup-play-again-button') as HTMLElement;
    // Assign toast elements
    toastElement = document.getElementById('toast-notification') as HTMLElement;
    toastMessageElement = document.getElementById('toast-message') as HTMLElement;
    // Assign hint elements
    hintButton = document.getElementById('hint-button') as HTMLInputElement;
    hintLinesContainer = document.getElementById('hint-lines-container') as HTMLElement;
    // Assign Help Popup elements
    helpButtonElement = document.getElementById('help-button') as HTMLElement;
    helpPopupOverlay = document.getElementById('help-popup-overlay') as HTMLElement;
    helpPopupCloseButton = document.getElementById('help-popup-close-button') as HTMLInputElement;
    popupOptimalPath = document.getElementById('popup-optimal-path') as HTMLElement;

    initializeGame();
    setupEventListeners();
});

function setupEventListeners() {
    const submitButton = document.getElementById('submit-button');
    if (submitButton) submitButton.addEventListener('click', handleGuess);

    if (userInput) userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleGuess(event);
        }
    });

    if (popupCloseButton) popupCloseButton.addEventListener('click', () => popupOverlay.classList.add('popup-hidden'));
    if (playAgainButton) playAgainButton.addEventListener('click', resetGame);
    if (popupOverlay) popupOverlay.addEventListener('click', (event) => {
        if (event.target === popupOverlay) popupOverlay.classList.add('popup-hidden');
    });

    if (hintButton) hintButton.addEventListener('click', handleHintClick);
    if (helpButtonElement) helpButtonElement.addEventListener('click', () => {
        if (helpPopupOverlay) helpPopupOverlay.classList.remove('popup-hidden');
    });
    if (helpPopupCloseButton) helpPopupCloseButton.addEventListener('click', () => {
        if (helpPopupOverlay) helpPopupOverlay.classList.add('popup-hidden');
    });
    if (helpPopupOverlay) helpPopupOverlay.addEventListener('click', (event) => {
        if (event.target === helpPopupOverlay) helpPopupOverlay.classList.add('popup-hidden');
    });
}

function initializeGame() {
    lives = INITIAL_LIVES;
    visitedStations = [randomStation()];
    goalStation = randomStation(visitedStations);
    
    // Reset UI elements
    (document.getElementById('user-input') as HTMLInputElement).disabled = false;
    (document.getElementById('submit-button') as HTMLInputElement).disabled = false;
    (document.getElementById('user-input') as HTMLInputElement).value = ''; // Clear input
    if (hintButton) hintButton.disabled = false;
    if (hintLinesContainer) hintLinesContainer.innerHTML = ''; // Clear hints
    if (popupOverlay) popupOverlay.classList.add('popup-hidden'); // Ensure popup is hidden
    if (visitedStationsContainer) visitedStationsContainer.innerHTML = ''; // Clear previous path display

    // Initial display updates
    updateLivesDisplay();
    updateVisitedStationsDisplay();
    updateGoalStationDisplay();
    console.log(`New Game Started! Start: ${visitedStations[0]}, Goal: ${goalStation}`);
}

function resetGame() {
    console.log("Resetting game...");
    initializeGame(); // Re-run the initialization logic
}

const getCurrentStation = () => {
    return visitedStations[visitedStations.length - 1] as StationName;
}

const updateVisitedStationsDisplay = () => {
    if (!visitedStationsContainer) return;

    visitedStationsContainer.innerHTML = '';

    visitedStations.forEach((station, index) => {
        if (index > 0) {
            const prevStationName = visitedStations[index - 1];
            if (!prevStationName) return;
            const lineColors = connectingLineColors(prevStationName, station);

            const lineContainer = document.createElement('div');
            lineContainer.classList.add('line-connector-container');

            const segmentWidth = 100 / Math.max(1, lineColors.length);
            const borderWidth = 3 / Math.max(1, lineColors.length);

            lineColors.forEach((line, idx) => {
                const lineSegment = document.createElement('div');
                lineSegment.classList.add('line-segment');
                lineSegment.style.width = `${segmentWidth}%`;
                lineSegment.style.transitionDelay = `${idx * 0.2}s`;
                lineSegment.classList.add('has-inner');
                lineSegment.style.borderRight = `${borderWidth}px solid ${line.outerColor}`;
                lineSegment.style.borderLeft = `${borderWidth}px solid ${line.outerColor}`;
                lineSegment.style.backgroundColor = line.innerColor;

                if (index === visitedStations.length - 1) {
                    setTimeout(() => {
                        lineSegment.classList.add('animate');
                    }, 10);
                } else {
                    lineSegment.classList.add('animate');
                    lineSegment.style.width = `${segmentWidth}%`;
                    lineSegment.style.transition = 'none';
                }

                lineContainer.appendChild(lineSegment);
            });

            visitedStationsContainer.appendChild(lineContainer);
        }

        const stationDiv = document.createElement('div');
        stationDiv.classList.add('station-display');

        const dotSpan = document.createElement('span');
        dotSpan.classList.add('station-marker-dot');

        const nameSpan = document.createElement('span');
        nameSpan.classList.add('station-marker-name');
        nameSpan.textContent = station;

        stationDiv.appendChild(dotSpan);
        stationDiv.appendChild(nameSpan);
        visitedStationsContainer.appendChild(stationDiv);

        if (index === visitedStations.length - 1 && index > 0) {
            dotSpan.style.opacity = '0';
            nameSpan.style.opacity = '0';
            nameSpan.style.maxWidth = '0px';

            setTimeout(() => {
                dotSpan.style.width = '1em';
                dotSpan.style.opacity = '1';
                dotSpan.classList.add('spin-animate');
            }, 500);

            setTimeout(() => {
                nameSpan.style.opacity = '1';
                nameSpan.style.maxWidth = '100%';
                nameSpan.classList.add('slide-animate');
            }, 750);
        } else {
            dotSpan.style.width = '1em';
            dotSpan.style.opacity = '1';
            nameSpan.style.opacity = '1';
            nameSpan.style.maxWidth = '100%';
        }
    });

    visitedStationsContainer.scrollTop = visitedStationsContainer.scrollHeight;
};

const updateGoalStationDisplay = () => {
    if (goalStationContainer) {
        goalStationContainer.textContent = `Get me to: ${goalStation}`;
    }
};

const updateLivesDisplay = () => {
    livesContainer.innerHTML = '';
    for (let i = 0; i < lives; i++) {
        const dot = document.createElement('span');
        dot.classList.add('life-dot');
        livesContainer.appendChild(dot);
    }
};

const showPopup = (message: string, score: string | null = null, optimalPath: string | null = null) => {
    if (!popupOverlay || !popupMessageElement) return;

    let fullMessage = message;
    if (score !== null) {
        fullMessage += `\nYou scored: ${score}`;
    }
    popupMessageElement.innerText = fullMessage;
    popupOverlay.classList.remove('popup-hidden');
    if (optimalPath) {
        popupOptimalPath.innerText = "Optimal Path: " + optimalPath;
    }
}

// Function to show the toast notification
const showToast = (message: string, duration = 3000) => {
    if (!toastElement || !toastMessageElement) return;

    if (toastTimeoutId) {
        clearTimeout(toastTimeoutId);
    }

    toastMessageElement.textContent = message;
    toastElement.classList.remove('toast-hidden');

    toastTimeoutId = setTimeout(() => {
        toastElement.classList.add('toast-hidden');
        toastTimeoutId = null;
    }, duration);
}

// Handler for the hint button click
const handleHintClick = () => {
    if (!hintButton || !hintLinesContainer || !goalStation) return;

    const linesForGoal = stationLineColors(goalStation);

    hintLinesContainer.innerHTML = '';

    if (linesForGoal.length > 0) {
        linesForGoal.forEach(line => {
            const indicator = document.createElement('div');
            indicator.classList.add('hint-line-indicator');

            // Apply final colors immediately
            indicator.style.backgroundColor = line.innerColor;
            indicator.style.borderTopColor = line.outerColor;
            indicator.style.borderBottomColor = line.outerColor;


            hintLinesContainer.appendChild(indicator);

            setTimeout(() => {
                indicator.classList.add('visible');
            }, 10);
        });
    } else {
        hintLinesContainer.textContent = "(No line info available for goal)";
    }

    hintButton.disabled = true;
};

const handleGuess = (event: MouseEvent | KeyboardEvent) => {
    event.preventDefault();
    const guessInput = document.getElementById("user-input") as HTMLInputElement;
    const guess = guessInput.value;
    if (!guess) {
        showToast("Please enter a station name!");
        return;
    }
    const guessStationNames = getMatchingStationNames(guess);

    if (guessStationNames.length === 0) {
        showToast("Invalid station name!");
        guessInput.value = '';
        return;
    }

    if (guessStationNames.length > 1) {
        showToast("Multiple matching stations found, please be more specific!");
        return;
    }

    const guessStationName = guessStationNames[0] as StationName;

    const currentStation = getCurrentStation();
    if (guessStationName === currentStation) {
        showToast("You're already at that station!");
        guessInput.value = '';
        return;
    }

    if (checkLink(currentStation, guessStationName)) {
        visitedStations.push(guessStationName);
        updateVisitedStationsDisplay();

        if (guessStationName === goalStation) {
            // WIN CONDITION
            const playerPath = [...visitedStations];
            const startStation = playerPath[0] as StationName;
            const endStation = playerPath[playerPath.length - 1] as StationName;

            // Delay the win popup and input disabling until animation finishes
            const animationDuration = 1000; // Match CSS transition duration (1.0s)
            
            setTimeout(() => {
                // Calculate times *after* the delay to ensure network data is likely ready
                const playerTime = calculateChosenPathTime(playerPath);
                const optimalResult = calculateOptimalPath(startStation, endStation);
                const optimalTime = optimalResult ? optimalResult.time : Infinity;

                let scoreText = "(Optimal path calculation failed)";
                let optimalPath = null;
                if (playerTime !== Infinity && optimalTime !== undefined && optimalTime !== Infinity && playerTime > 0 && optimalResult) {
                    const score = Math.round((optimalTime / playerTime) * 100);
                    scoreText = `${score}%`;
                    optimalPath = optimalResult.changes.join(", ");
                } else if (playerTime === Infinity) {
                    scoreText = "(Your path seems impossible?)";
                }

                userInput.disabled = true;
                submitButton.disabled = true;
                hintButton.disabled = true;
                // Pass the score string to the popup
                showPopup(`Congratulations! You reached ${endStation}!`, scoreText, optimalPath); 
            }, animationDuration);

        } else {
             guessInput.value = '';
        }

    } else {
        lives--;
        updateLivesDisplay();
        showToast("No connection between stations!");

        if (lives === 0) {
            userInput.disabled = true;
            submitButton.disabled = true;

            const optimalResult = calculateOptimalPath(visitedStations[0] as StationName, goalStation);
            const optimalPath = optimalResult ? optimalResult.changes.join(", ") : null;

            showPopup("Game Over! You ran out of lives.", null, optimalPath);
        }
        guessInput.value = '';
    }
};

