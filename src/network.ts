import { lines, stations, connections } from "./data.js";
import { Station, Line } from "./types";

export const checkLink = (fromName: string, toName: string) => {
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

const cleanName = (name: string) => {
    if (typeof name !== 'string') return ''; // Handle non-string input
    return name
        .replace(/&/g, 'and')
        .replace(/['']/g, '') // Handle different apostrophes
        .replace(/ /g, "-")
        .replace(/\./g, '')
        .toLowerCase();
};

export const getMatchingStationName = (input: string) => {
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
    return supersetMatchingStation?.name
};

export const getConnectingLines = (fromName: string, toName: string): Line[] => {
    if (!stations.length || !lines.length) {
        console.warn("getConnectingLines called before data loaded.");
        return [];
    }

    const fromStation = stations.find(station => station.name === fromName);
    const toStation = stations.find(station => station.name === toName);

    if (!fromStation || !toStation || !fromStation.services || !toStation.services) {
        return [];
    }

    const commonLineNames = fromStation.services.filter(lineName =>
        toStation.services.includes(lineName)
    );

    const connectingLines = commonLineNames.map(lineName => lineName.split("|")[0]);
    return Array.from(new Set(connectingLines))
        .map(lineName => lines.find(line => line.name === lineName))
        .filter((line) => !!line);
};

export const getRandomStation = (avoidStations: string[] = []) => {
    const availableStations = stations.filter(station => !avoidStations.includes(station.name));
    return availableStations[Math.floor(Math.random() * availableStations.length)] as Station;
};

export const getStationLines = (stationName: string): Line[] => {
    if (!stations.length || !lines.length) {
        console.warn("getStationLines called before data loaded.");
        return [];
    }
    const station = stations.find(s => s.name === stationName);
    if (!station || !station.services) {
        return [];
    }

    const stationLineNames = Array.from(new Set(station.services.map(lineName => lineName.split("|")[0])));

    const lineObjects = stationLineNames.map(lineName =>
        lines.find(line => line.name === lineName)
    ).filter(line => !!line);

    return lineObjects;
};

// Finds shortest time between two stations WITHOUT change penalties
const findShortestSegmentTime = (startName: string, endName: string): {time: number, linesUsed: string[]} | null => {
    if (!stations.length || !Array.isArray(connections) || connections.length === 0) {
        console.error("Segment calculation requires station data and connections array.");
        return null; 
    }

    const times: {
        [key: string]: number
    } = {};
    const previousNodes: {
        [key: string]: string | null
    } = {};
    const previousLines: {
        [key: string]: string[] | null
    } = {}; // Lines used for incoming connection
    const pq: [number, string][] = []; // [(time, station)] - Don't need incoming lines here
    const visited = new Set();

    stations.forEach(station => {
        times[station.name] = Infinity;
        previousNodes[station.name] = null;
        previousLines[station.name] = null;
    });

    times[startName] = 0;
    pq.push([0, startName]);

    while (pq.length > 0) {
        pq.sort((a, b) => a[0] - b[0]);
        const nextVal = pq.shift();
        if (!nextVal) {
            break;
        }
        const [currentTime, currentNode] = nextVal;
        if (visited.has(currentNode)) continue;
        visited.add(currentNode);

        if (currentNode === endName) break; // Found shortest path

        const relevantConnections = connections.filter(connection => connection.from === currentNode || connection.to === currentNode);

        for (const connection of relevantConnections) {
            const neighborName = (connection.from === currentNode) ? connection.to : connection.from;
            if (visited.has(neighborName)) continue;

            const connectionTime = connection.time;
            const connectionLines = Array.from(new Set((connection.services || []).map(s => s.split('|')[0]))) as string[]; 

            if (typeof connectionTime !== 'number') continue; // Skip invalid connections

            const newTime = currentTime + connectionTime; // NO penalty here

            if (newTime < (times[neighborName] as number)) {
                times[neighborName] = newTime;
                previousNodes[neighborName] = currentNode;
                previousLines[neighborName] = connectionLines; // Store lines for connection leading here
                pq.push([newTime, neighborName]);
            }
        }
    }

    if (times[endName] === Infinity) {
        return null; // No path found for segment
    }

    // Return time and the lines used for the *last* connection of this segment
    return {
        time: times[endName] as number,
        linesUsed: previousLines[endName] || [] 
    };
};

export const calculateOptimalPath = (fromName: string, toName: string) => {
    // 1. Initialization
    if (!stations.length || !Array.isArray(connections) || connections.length === 0) { 
        console.error("Path calculation requires station data and connections array.");
        return null; 
    }

    const times: {
        [key: string]: number
    } = {};
    const previousNodes: {
        [key: string]: string | null
    } = {};
    const previousLines: {
        [key: string]: string[] | null
    } = {}
    const pq: [number, string, string[]][] = [];
    const visited = new Set();

    stations.forEach(station => {
        times[station.name] = Infinity;
        previousNodes[station.name] = null;
        previousLines[station.name] = null;
    });

    times[fromName] = 0;
    pq.push([0, fromName, []]);

    // 2. Main Loop (Dijkstra-like)
    while (pq.length > 0) {
        pq.sort((a, b) => a[0] - b[0]);
        const nextValue = pq.shift();
        if (!nextValue) {
            break
        }
        const [currentTime, currentNode, incomingLines] = nextValue

        if (visited.has(currentNode)) {
            continue;
        }
        visited.add(currentNode);

        if (currentNode === toName) {
            break; 
        }

        const relevantConnections = connections.filter(connection => connection.from === currentNode || connection.to === currentNode);

        for (const connection of relevantConnections) { 
            const neighborName = (connection.from === currentNode) ? connection.to : connection.from;

            if (visited.has(neighborName)) continue;


            const connectionTime = connection.time;
            const connectionLines = Array.from(new Set((connection.services || []).map(s => s.split('|')[0]))) as string[]; 
            
            if (typeof connectionTime !== 'number') {
                 continue;
            }

            // Calculate change penalty
            let changePenalty = 0;
            if (incomingLines && incomingLines.length > 0) { 
                const hasCommonLine = connectionLines.some(line => incomingLines.includes(line));
                if (!hasCommonLine) {
                    changePenalty = 3; 
                }
            }

            const newTime = currentTime + connectionTime + changePenalty;

            if (newTime < (times[neighborName] as number)) {
                times[neighborName] = newTime;
                previousNodes[neighborName] = currentNode;
                previousLines[neighborName] = connectionLines; 
                pq.push([newTime, neighborName, connectionLines]);
            }
        }
    }


    // 3. Path Reconstruction and Change Detection (This part should remain the same)
    if (times[toName] === Infinity) {
        return { time: Infinity, changes: [] };
    }

    const path = [];
    let current: string | null = toName;
    while (current !== null) {
        path.push(current);
        current = previousNodes[current] as string | null;
    }
    path.reverse();

    const changeStations = new Set([fromName]);
    for (let i = 0; i < path.length - 1; i++) {
        const stationA = path[i] as string;
        const stationB = path[i+1] as string;

        const linesToA = previousLines[stationA] || [];
        const linesToB = previousLines[stationB] || [];

        if (i > 0) {
             const hasCommonLine = linesToB.some(line => linesToA.includes(line));
             if (!hasCommonLine) {
                changeStations.add(stationA);
             }
        }
    }
    changeStations.add(toName);

    return {
        time: times[toName],
        changes: Array.from(changeStations)
    };
};

export const calculateChosenPathTime = (path: string[]) => {
    if (!path || path.length < 2) {
        console.error("Chosen path must have at least two stations.");
        return Infinity;
    }

    let totalTime = 0;
    let previousSegmentLines: string[] | null = null;
    const CHANGE_PENALTY = 3;

    for (let i = 0; i < path.length - 1; i++) {
        const segmentStart = path[i] as string;
        const segmentEnd = path[i + 1] as string;

        const segmentResult = findShortestSegmentTime(segmentStart, segmentEnd);

        if (!segmentResult) {
            console.error(`No path found for segment: ${segmentStart} -> ${segmentEnd}`);
            return Infinity; // Entire path is impossible if one segment fails
        }

        totalTime += segmentResult.time;

        // Check for change penalty (after the first segment)
        if (i > 0 && !!previousSegmentLines) {
            const prevSegmentLines = previousSegmentLines
            const currentSegmentLines = segmentResult.linesUsed;
            const hasCommonLine = currentSegmentLines.some(line => prevSegmentLines.includes(line));
            
            if (!hasCommonLine && currentSegmentLines.length > 0 && prevSegmentLines.length > 0) {
                totalTime += CHANGE_PENALTY;
            }
        }

        previousSegmentLines = segmentResult.linesUsed; // Store lines for the next comparison
    }

    return totalTime;
};