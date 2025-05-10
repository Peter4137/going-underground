import { LINES, STATIONS, CONNECTIONS, } from "./data.js";
export const checkLink = (from, to) => {
    return STATIONS[from].services.some((fromService) => STATIONS[to].services.some((toService) => toService.line === fromService.line && toService.variant === fromService.variant));
};
const cleanName = (name) => {
    if (typeof name !== 'string')
        return ''; // Handle non-string input
    return name
        .replace(/&/g, 'and')
        .replace(/['']/g, '') // Handle different apostrophes
        .replace(/ /g, "-")
        .replace(/\./g, '')
        .toLowerCase();
};
export const getMatchingStationNames = (input) => {
    const cleanInput = cleanName(input);
    const matchingStations = Object.keys(STATIONS)
        .filter((station) => cleanName(station).includes(cleanInput));
    const exactMatch = matchingStations.find((station) => cleanName(station) === cleanInput);
    if (exactMatch) {
        return [exactMatch];
    }
    return matchingStations;
};
export const connectingLineColors = (from, to) => {
    const commonServices = STATIONS[from].services.filter(fromService => STATIONS[to].services.some((toService) => toService.line === fromService.line && toService.variant === fromService.variant));
    return Array.from(new Set(commonServices.map(service => LINES[service.line])));
};
export const randomStation = (exclude = []) => {
    const availableStations = Object.keys(STATIONS).filter(station => !exclude.includes(station));
    return availableStations[Math.floor(Math.random() * availableStations.length)];
};
export const stationLineColors = (station) => {
    const stationLineNames = Array.from(new Set(STATIONS[station].services.map(service => service.line)));
    return stationLineNames.map(lineName => LINES[lineName]);
};
export const calculateOptimalPath = (from, to) => {
    const result = findShortestPathInternal(from, to, Object.keys(STATIONS), CONNECTIONS, true);
    if (!result) {
        return {
            time: Infinity,
            changes: [],
            firstLegLines: [],
            lastLegLines: [],
            path: []
        };
    }
    // Map ShortestPathResult to OptimalPathInfo
    return {
        time: result.time,
        path: result.path,
        changes: result.changeStations,
        firstLegLines: result.firstLegLines,
        lastLegLines: result.lastLegLines
    };
};
export const calculateChosenPathTime = (path) => {
    if (!path || path.length < 2) {
        console.error("Chosen path must have at least two stations.");
        return Infinity;
    }
    let totalTime = 0;
    let previousSegmentLastLegLines = null;
    const CHANGE_PENALTY = 3;
    for (let i = 0; i < path.length - 1; i++) {
        const segmentStart = path[i];
        const segmentEnd = path[i + 1];
        const segmentOptimalInfo = calculateOptimalPath(segmentStart, segmentEnd);
        if (!segmentOptimalInfo || segmentOptimalInfo.time === Infinity) {
            console.error(`No optimal path found for segment: ${segmentStart} -> ${segmentEnd}`);
            return Infinity; // Entire path is impossible if one segment fails
        }
        // Add the time for the current segment (this time includes penalties *within* the segment)
        totalTime += segmentOptimalInfo.time;
        // Add penalty for changing lines *at segmentStart* if it's an intermediate station
        if (i > 0 && previousSegmentLastLegLines && previousSegmentLastLegLines.length > 0) {
            const currentSegmentFirstLegLines = segmentOptimalInfo.firstLegLines;
            if (currentSegmentFirstLegLines && currentSegmentFirstLegLines.length > 0) {
                const hasCommonLine = currentSegmentFirstLegLines.some(line => previousSegmentLastLegLines.includes(line));
                if (!hasCommonLine) {
                    totalTime += CHANGE_PENALTY;
                }
            }
        }
        previousSegmentLastLegLines = segmentOptimalInfo.lastLegLines;
    }
    return totalTime;
};
// CORE DIJKSTRA IMPLEMENTATION
const CHANGE_PENALTY_MINUTES = 3;
function findShortestPathInternal(start, end, stationsToUse, connectionsToUse, applyChangePenalty) {
    const times = {};
    const previousNodes = {};
    // Stores the lines of the connection that led to a node on its shortest path so far
    const linesToReachNode = {};
    // Priority queue: [time, stationName, linesUsedToArriveAtThisStation]
    const pq = [];
    const visited = new Set();
    stationsToUse.forEach(station => {
        times[station] = Infinity;
        previousNodes[station] = null;
        linesToReachNode[station] = null;
    });
    times[start] = 0;
    pq.push([0, start, null]); // No lines to reach start node from a prior segment
    while (pq.length > 0) {
        pq.sort((a, b) => a[0] - b[0]); // Sort to simulate min-priority queue
        const currentEntry = pq.shift();
        if (!currentEntry)
            break;
        const [currentTime, currentNodeName, incomingLinesToCurrentNode] = currentEntry;
        if (visited.has(currentNodeName)) {
            continue;
        }
        visited.add(currentNodeName);
        if (currentNodeName === end) {
            break; // Target reached
        }
        const outgoingConnections = connectionsToUse.filter(conn => conn.from === currentNodeName || conn.to === currentNodeName);
        for (const connection of outgoingConnections) {
            const neighborName = connection.from === currentNodeName ? connection.to : connection.from;
            if (visited.has(neighborName) || !times[neighborName])
                continue;
            const connectionTime = connection.time;
            if (typeof connectionTime !== 'number')
                continue;
            let currentConnectionCost = connectionTime;
            const linesOfThisConnection = Array.from(new Set((connection.services).map(s => s.line)));
            if (applyChangePenalty && incomingLinesToCurrentNode && incomingLinesToCurrentNode.length > 0) {
                const hasCommonLine = linesOfThisConnection.some(line => incomingLinesToCurrentNode.includes(line));
                if (!hasCommonLine && linesOfThisConnection.length > 0) { // Penalty if no common line and current connection has lines
                    currentConnectionCost += CHANGE_PENALTY_MINUTES;
                }
            }
            const newTime = currentTime + currentConnectionCost;
            if (newTime < times[neighborName]) {
                times[neighborName] = newTime;
                previousNodes[neighborName] = currentNodeName;
                linesToReachNode[neighborName] = linesOfThisConnection;
                pq.push([newTime, neighborName, linesOfThisConnection]);
            }
        }
    }
    if (times[end] === Infinity || !times[end]) {
        return null; // No path found
    }
    // Reconstruct path
    const path = [];
    let currentPathNode = end;
    while (currentPathNode) {
        path.push(currentPathNode);
        currentPathNode = previousNodes[currentPathNode];
    }
    path.reverse();
    // Determine change stations and first/last leg lines
    const changeStations = new Set();
    if (path.length > 0)
        changeStations.add(path[0]);
    for (let i = 0; i < path.length - 1; i++) {
        const s1 = path[i];
        const s2 = path[i + 1];
        const linesToS1 = linesToReachNode[s1] || [];
        const linesToS2 = linesToReachNode[s2] || []; // These are the lines of the segment s1->s2
        if (i > 0) { // Check for change at s1 (path[i])
            // A change occurs at s1 if lines to s1 (from path[i-1]) differ from lines from s1 to s2 (which are linesToS2)
            if (linesToS1.length > 0 && linesToS2.length > 0) {
                const hasCommonLine = linesToS2.some((l2) => linesToS1.includes(l2));
                if (!hasCommonLine) {
                    changeStations.add(s1);
                }
            }
        }
    }
    if (path.length > 0) {
        changeStations.add(path[path.length - 1]);
    }
    const firstLegLines = linesToReachNode[path[1]];
    const lastLegLines = linesToReachNode[end];
    return {
        time: times[end],
        path: path,
        changeStations: Array.from(changeStations),
        firstLegLines: firstLegLines,
        lastLegLines: lastLegLines,
    };
}
;
