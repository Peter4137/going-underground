import { checkLink, getMatchingStationName, getConnectingLines } from "./network.js";

let lives = 3;
const livesContainer = document.querySelector('.lives-container');
const visitedStations = ["Bank"];
const goalStation = "Oval";

let visitedStationsContainer;
let goalStationContainer;

document.addEventListener('DOMContentLoaded', () => {
    visitedStationsContainer = document.querySelector('.visited-stations-container');
    goalStationContainer = document.getElementById('goal-station-container');

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
                lineSegment.classList.add('line-segment-endless');
                lineSegment.style.backgroundColor = line.outerColor;
                lineSegment.style.width = `${segmentWidth}%`;
                lineSegment.style.transitionDelay = `${index * 0.1}s`;

                if (line.innerColor) {
                    lineSegment.classList.add('has-inner');
                    lineSegment.style.borderColor = line.innerColor;
                } else {
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

const handleGuess = (event) => {
    event.preventDefault();
    const guessInput = document.getElementById("user-input");
    const guess = guessInput.value;
    const guessStationName = getMatchingStationName(guess);

    if (!guessStationName) {
        console.log("Invalid guess");
        // TODO handle invalid guess feedback
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

        // Check for win *after* updating display
        if (guessStationName === goalStation) {
            console.log("You win!");
            document.getElementById('user-input').disabled = true;
            document.getElementById('submit-button').disabled = true;
            // Optional: Add a win message display
        } else {
             // Clear input only if not winning guess (to see final station)
             guessInput.value = '';
        }

    } else {
        // Incorrect guess (not linked)
        lives--;
        updateLivesDisplay();
        console.log("Incorrect guess, stations not linked.");
        // TODO handle incorrect guess feedback

        if (lives === 0) {
            console.log("Game Over!");
            document.getElementById('user-input').disabled = true;
            document.getElementById('submit-button').disabled = true;
            // TODO handle game over feedback
        }
         guessInput.value = ''; // Clear input on incorrect guess
    }
};

