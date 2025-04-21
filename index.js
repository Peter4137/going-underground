import { checkLink, getMatchingStationName, getConnectingLines, getRandomStation, dataLoadedPromise, stations } from "./network.js";

let lives = 3;
const livesContainer = document.querySelector('.lives-container');
let visitedStations = [];
let goalStation = "";

let visitedStationsContainer;
let goalStationContainer;
// Popup element references
let popupOverlay;
let popupMessageElement;
let popupCloseButton;
// Toast element references
let toastElement;
let toastMessageElement;
let toastTimeoutId = null; // To manage the hide timeout

document.addEventListener('DOMContentLoaded', async () => {
    visitedStationsContainer = document.querySelector('.visited-stations-container');
    goalStationContainer = document.getElementById('goal-station-container');
    // Assign popup elements
    popupOverlay = document.getElementById('popup-overlay');
    popupMessageElement = document.getElementById('popup-message');
    popupCloseButton = document.getElementById('popup-close-button');
    // Assign toast elements
    toastElement = document.getElementById('toast-notification');
    toastMessageElement = document.getElementById('toast-message');

    const dataReady = await dataLoadedPromise;

    
    if (!dataReady || stations.length === 0) {
        goalStationContainer.textContent = "Error loading station data!";
        return;
    }

    visitedStations = [getRandomStation()];
    goalStation = getRandomStation(visitedStations);

    updateLivesDisplay();
    updateVisitedStationsDisplay();
    updateGoalStationDisplay();

    const submitButton = document.getElementById('submit-button');
    if (submitButton) {
        submitButton.addEventListener('click', handleGuess);
    }

    const userInput = document.getElementById('user-input');
    if (userInput) {
        userInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleGuess(event);
            }
        });
    }

    if (popupCloseButton) {
        popupCloseButton.addEventListener('click', () => {
            popupOverlay.classList.add('popup-hidden');
        });
    }

    if (popupOverlay) {
        popupOverlay.addEventListener('click', (event) => {
            if (event.target === popupOverlay) {
                popupOverlay.classList.add('popup-hidden');
            }
        });
    }
});

const getCurrentStation = () => {
    return visitedStations[visitedStations.length - 1];
}

const updateVisitedStationsDisplay = () => {
    if (!visitedStationsContainer) return;

    visitedStationsContainer.innerHTML = '';

    visitedStations.forEach((stationName, index) => {
        if (index > 0) {
            const prevStationName = visitedStations[index - 1];
            const connectingLines = getConnectingLines(prevStationName, stationName);

            const lineContainer = document.createElement('div');
            lineContainer.classList.add('line-connector-container');

            const segmentWidth = 100 / Math.max(1, connectingLines.length);

            connectingLines.forEach((line, lineIndex) => {
                const lineSegment = document.createElement('div');
                lineSegment.classList.add('line-segment');
                lineSegment.style.width = `${segmentWidth}%`;
                lineSegment.style.transitionDelay = `${index * 0.1}s`;

                if (line.innerColor) {
                    lineSegment.classList.add('has-inner');
                    lineSegment.style.backgroundColor = line.innerColor;
                    lineSegment.style.borderLeftColor = line.outerColor;
                    lineSegment.style.borderRightColor = line.outerColor;
                } else {
                     lineSegment.style.backgroundColor = line.outerColor;
                     lineSegment.style.border = 'none';
                }

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
        nameSpan.textContent = stationName;

        stationDiv.appendChild(dotSpan);
        stationDiv.appendChild(nameSpan);
        visitedStationsContainer.appendChild(stationDiv);
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

const showPopup = (message) => {
    if (!popupOverlay || !popupMessageElement) return;

    popupMessageElement.textContent = message;
    popupOverlay.classList.remove('popup-hidden');
}

// Function to show the toast notification
const showToast = (message, duration = 3000) => {
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

const handleGuess = (event) => {
    event.preventDefault();
    const guessInput = document.getElementById("user-input");
    const guess = guessInput.value;
    const guessStationName = getMatchingStationName(guess);

    if (!guessStationName) {
        showToast("Invalid station name!");
        guessInput.value = '';
        return;
    }

    const currentStation = getCurrentStation();
    if (guessStationName === currentStation) {
        console.log("Already at station");
        guessInput.value = '';
        return;
    }

    if (checkLink(currentStation, guessStationName)) {
        // Correct guess
        visitedStations.push(guessStationName);
        updateVisitedStationsDisplay();

        if (guessStationName === goalStation) {
            // WIN CONDITION
            console.log("You win!");
            document.getElementById('user-input').disabled = true;
            document.getElementById('submit-button').disabled = true;
            showPopup("Congratulations! You reached the goal station!"); // Show win popup
        } else {
             guessInput.value = '';
        }

    } else {
        // Incorrect guess (not linked)
        lives--;
        updateLivesDisplay();
        console.log("Incorrect guess, stations not linked.");

        if (lives === 0) {
            // LOSS CONDITION
            console.log("Game Over!");
            document.getElementById('user-input').disabled = true;
            document.getElementById('submit-button').disabled = true;
            showPopup("Game Over! You ran out of lives."); // Show loss popup
        }
        guessInput.value = '';
    }
};

