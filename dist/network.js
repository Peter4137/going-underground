import { lines, stations, connections } from "./data.js";
// HELPER FUNCTIONS
/**
 * Filters the global station, connection, and line data based on specified options.
 */
export function filterNetworkData(options) {
    let filteredStations = [...stations];
    let filteredLines = [...lines];
    let filteredConnections = [...connections];
    if (!options) {
        return { stations: filteredStations, connections: filteredConnections, lines: filteredLines };
    }
    // Filter Stations
    if (options.includedStationNames) {
        const includeSet = new Set(options.includedStationNames);
        filteredStations = filteredStations.filter(s => includeSet.has(s.name));
    }
    if (options.excludedStationNames) {
        const excludeSet = new Set(options.excludedStationNames);
        filteredStations = filteredStations.filter(s => !excludeSet.has(s.name));
    }
    const validStationNames = new Set(filteredStations.map(s => s.name));
    // Filter Lines
    if (options.includedLineNames) {
        const includeSet = new Set(options.includedLineNames);
        filteredLines = filteredLines.filter(l => includeSet.has(l.name));
    }
    if (options.excludedLineNames) {
        const excludeSet = new Set(options.excludedLineNames);
        filteredLines = filteredLines.filter(l => !excludeSet.has(l.name));
    }
    const validLineNames = new Set(filteredLines.map(l => l.name));
    // Filter Connections
    filteredConnections = filteredConnections.filter(conn => validStationNames.has(conn.from) &&
        validStationNames.has(conn.to) &&
        (conn.services.some(serviceName => {
            const mainLine = serviceName.split('|')[0];
            return mainLine ? validLineNames.has(mainLine) : false;
        })));
    // Further refine connections: ensure their services *only* contain valid lines
    // This is important if a line is excluded, connections solely on that line should be less viable or their service list pruned.
    filteredConnections = filteredConnections.map(conn => {
        const validServices = conn.services.filter(serviceName => {
            const mainLine = serviceName.split('|')[0];
            return mainLine ? validLineNames.has(mainLine) : false;
        });
        return { ...conn, services: validServices };
    }).filter(conn => conn.services.length > 0); // Connection is only valid if it has at least one valid service after filtering
    return { stations: filteredStations, connections: filteredConnections, lines: filteredLines };
}
export const checkLink = (fromName, toName) => {
    if (!stations || stations.length === 0) {
        console.warn("checkLink called before stations data loaded.");
        return false;
    }
    const fromStation = stations.find(station => station.name === fromName);
    const toStation = stations.find(station => station.name === toName);
    if (!fromStation || !toStation) {
        return false;
    }
    // Assuming fromStation.services is an array of arrays of connected station names
    for (const service of fromStation.services) {
        if (toStation.services.includes(service)) {
            return true;
        }
    }
    return false;
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
export const getMatchingStationName = (input) => {
    if (!stations || stations.length === 0) {
        console.warn("getMatchingStation called before stations data loaded.");
        return undefined;
    }
    const cleanInput = cleanName(input);
    const matchingStation = stations.find(station => cleanName(station.name) === cleanInput);
    if (matchingStation) {
        return matchingStation.name;
    }
    const supersetMatchingStation = stations.find(station => cleanName(station.name).includes(cleanInput));
    return supersetMatchingStation?.name;
};
export const getConnectingLines = (fromName, toName) => {
    if (!stations.length || !lines.length) {
        console.warn("getConnectingLines called before data loaded.");
        return [];
    }
    const fromStation = stations.find(station => station.name === fromName);
    const toStation = stations.find(station => station.name === toName);
    if (!fromStation || !toStation || !fromStation.services || !toStation.services) {
        return [];
    }
    const commonLineNames = fromStation.services.filter(lineName => toStation.services.includes(lineName));
    const connectingLines = commonLineNames.map(lineName => lineName.split("|")[0]);
    return Array.from(new Set(connectingLines))
        .map(lineName => lines.find(line => line.name === lineName))
        .filter((line) => !!line);
};
export const getRandomStation = (avoidStations = []) => {
    const availableStations = stations.filter(station => !avoidStations.includes(station.name));
    return availableStations[Math.floor(Math.random() * availableStations.length)];
};
export const getStationLines = (stationName) => {
    if (!stations.length || !lines.length) {
        console.warn("getStationLines called before data loaded.");
        return [];
    }
    const station = stations.find(s => s.name === stationName);
    if (!station || !station.services) {
        return [];
    }
    const stationLineNames = Array.from(new Set(station.services.map(lineName => lineName.split("|")[0])));
    const lineObjects = stationLineNames.map(lineName => lines.find(line => line.name === lineName)).filter(line => !!line);
    return lineObjects;
};
export const calculateOptimalPath = (fromName, toName) => {
    const { stations, connections } = filterNetworkData();
    const result = findShortestPathInternal(fromName, toName, stations, connections, true);
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
function findShortestPathInternal(startName, endName, stationsToUse, connectionsToUse, applyChangePenalty) {
    const times = {};
    const previousNodes = {};
    // Stores the lines of the connection that led to a node on its shortest path so far
    const linesToReachNode = {};
    // Priority queue: [time, stationName, linesUsedToArriveAtThisStation]
    const pq = [];
    const visited = new Set();
    stationsToUse.forEach(station => {
        times[station.name] = Infinity;
        previousNodes[station.name] = null;
        linesToReachNode[station.name] = null;
    });
    times[startName] = 0;
    pq.push([0, startName, null]); // No lines to reach start node from a prior segment
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
        if (currentNodeName === endName) {
            break; // Target reached
        }
        const outgoingConnections = connectionsToUse.filter(conn => conn.from === currentNodeName || conn.to === currentNodeName);
        for (const connection of outgoingConnections) {
            const neighborName = connection.from === currentNodeName ? connection.to : connection.from;
            if (visited.has(neighborName) || !times.hasOwnProperty(neighborName))
                continue;
            const connectionTime = connection.time;
            if (typeof connectionTime !== 'number')
                continue;
            let currentConnectionCost = connectionTime;
            const linesOfThisConnection = Array.from(new Set((connection.services || []).map(s => {
                const mainLine = s.split('|')[0];
                return mainLine ? mainLine : ""; // handle undefined case, though should not happen
            }).filter(Boolean)));
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
    if (times[endName] === Infinity || !times.hasOwnProperty(endName)) {
        return null; // No path found
    }
    // Reconstruct path
    const path = [];
    let currentPathNode = endName;
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
        const s1Name = path[i];
        const s2Name = path[i + 1];
        const linesToS1 = linesToReachNode[s1Name] || [];
        const linesToS2 = linesToReachNode[s2Name] || []; // These are the lines of the segment s1->s2
        if (i > 0) { // Check for change at s1 (path[i])
            // A change occurs at s1 if lines to s1 (from path[i-1]) differ from lines from s1 to s2 (which are linesToS2)
            if (linesToS1.length > 0 && linesToS2.length > 0) {
                const hasCommonLine = linesToS2.some((l2) => linesToS1.includes(l2));
                if (!hasCommonLine) {
                    changeStations.add(s1Name);
                }
            }
        }
    }
    if (path.length > 0) {
        changeStations.add(path[path.length - 1]);
    }
    const firstLegLines = (path.length > 1 && linesToReachNode[path[1]]) ? linesToReachNode[path[1]] : [];
    const lastLegLines = linesToReachNode[endName] || [];
    return {
        time: times[endName],
        path: path,
        changeStations: Array.from(changeStations),
        firstLegLines: firstLegLines,
        lastLegLines: lastLegLines,
    };
}
;
