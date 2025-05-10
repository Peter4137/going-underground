import {
    LINES,
    STATIONS,
    CONNECTIONS,
    Station,
    Connection,
    LineName,
    LineColor,
    StationName,
} from "./data.js";
// INTERFACES AND TYPES
interface ShortestPathResult {
    time: number;
    path: StationName[]; // Full sequence of stations from start to end for this segment
    changeStations: StationName[]; // Stations where changes occurred *within this segment's path*
    firstLegLines: LineName[]; // Lines used for the first direct connection in this segment's path
    lastLegLines: LineName[]; // Lines used for the final direct connection in this segment's path
}

export interface OptimalPathInfo {
    time: number;
    changes: StationName[];
    firstLegLines: LineName[];
    lastLegLines: LineName[];
    path: StationName[]; // Also include the path itself for clarity if needed elsewhere
}

export const checkLink = (from: StationName, to: StationName) => {
    return STATIONS[from].services.some(
        (fromService) => (STATIONS[to] as Station).services.some(
            (toService) => toService.line === fromService.line && toService.variant === fromService.variant
        )
    )
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

export const getMatchingStationNames = (input: string): StationName[] => {
    const cleanInput = cleanName(input);
    const matchingStations = (Object.keys(STATIONS) as StationName[])
        .filter((station) => cleanName(station).includes(cleanInput))
    const exactMatch = matchingStations.find((station) => cleanName(station) === cleanInput)
    if (exactMatch) {
        return [exactMatch]
    }
    return matchingStations;
};

export const connectingLineColors = (from: StationName, to: StationName): LineColor[] => {
    const commonServices = STATIONS[from].services.filter(fromService =>
        (STATIONS[to] as Station).services.some(
            (toService) => toService.line === fromService.line && toService.variant === fromService.variant
        )
    );

    return Array.from(new Set(commonServices.map(service => LINES[service.line])));
};

export const randomStation = (exclude: StationName[] = []): StationName => {
    const availableStations = (Object.keys(STATIONS) as StationName[]).filter(station => !exclude.includes(station));
    return availableStations[Math.floor(Math.random() * availableStations.length)] as StationName;
};

export const stationLineColors = (station: StationName): LineColor[] => {
    const stationLineNames = Array.from(new Set(STATIONS[station].services.map(service => service.line)));

    return stationLineNames.map(lineName => LINES[lineName]);
};

export const calculateOptimalPath = (from: StationName, to: StationName): OptimalPathInfo | null => {
    const result = findShortestPathInternal(
        from,
        to,
        Object.keys(STATIONS) as StationName[],
        CONNECTIONS,
        true
    );

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

export const calculateChosenPathTime = (path: StationName[]): number => {
    if (!path || path.length < 2) {
        console.error("Chosen path must have at least two stations.");
        return Infinity;
    }

    let totalTime = 0;
    let previousSegmentLastLegLines: LineName[] | null = null;
    const CHANGE_PENALTY = 3;

    for (let i = 0; i < path.length - 1; i++) {
        const segmentStart = path[i] as StationName;
        const segmentEnd = path[i + 1] as StationName;

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
                const hasCommonLine = currentSegmentFirstLegLines.some(line =>
                    (previousSegmentLastLegLines as LineName[]).includes(line)
                );
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

function findShortestPathInternal(
    start: StationName,
    end: StationName,
    stationsToUse: StationName[],
    connectionsToUse: Connection[],
    applyChangePenalty: boolean
): ShortestPathResult | null {

    const times: Partial<Record<StationName, number>> = {};
    const previousNodes: Partial<Record<StationName, StationName | null>> = {};
    // Stores the lines of the connection that led to a node on its shortest path so far
    const linesToReachNode: Partial<Record<StationName, LineName[] | null>> = {};
    // Priority queue: [time, stationName, linesUsedToArriveAtThisStation]
    const pq: [number, StationName, LineName[] | null][] = [];
    const visited = new Set<StationName>();

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
        if (!currentEntry) break;

        const [currentTime, currentNodeName, incomingLinesToCurrentNode] = currentEntry;

        if (visited.has(currentNodeName)) {
            continue;
        }
        visited.add(currentNodeName);

        if (currentNodeName === end) {
            break; // Target reached
        }

        const outgoingConnections = connectionsToUse.filter(
            conn => conn.from === currentNodeName || conn.to === currentNodeName
        );

        for (const connection of outgoingConnections) {
            const neighborName = connection.from === currentNodeName ? connection.to : connection.from;

            if (visited.has(neighborName) || !times[neighborName]) continue;

            const connectionTime = connection.time;
            if (typeof connectionTime !== 'number') continue;

            let currentConnectionCost = connectionTime;
            const linesOfThisConnection = Array.from(new Set((connection.services).map(s => s.line)))

            if (applyChangePenalty && incomingLinesToCurrentNode && incomingLinesToCurrentNode.length > 0) {
                const hasCommonLine = linesOfThisConnection.some(line =>
                    incomingLinesToCurrentNode.includes(line)
                );
                if (!hasCommonLine && linesOfThisConnection.length > 0) { // Penalty if no common line and current connection has lines
                    currentConnectionCost += CHANGE_PENALTY_MINUTES;
                }
            }

            const newTime = currentTime + currentConnectionCost;

            if (newTime < (times[neighborName] as number)) {
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
    const path: StationName[] = [];
    let currentPathNode: StationName | null = end;
    while (currentPathNode) {
        path.push(currentPathNode);
        currentPathNode = previousNodes[currentPathNode as StationName] as StationName | null;
    }
    path.reverse();

    // Determine change stations and first/last leg lines
    const changeStations = new Set<StationName>();
    if (path.length > 0) changeStations.add(path[0] as StationName);

    for (let i = 0; i < path.length - 1; i++) {
        const s1 = path[i] as StationName;
        const s2 = path[i + 1] as StationName;

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
        changeStations.add(path[path.length - 1] as StationName);
    }

    const firstLegLines = linesToReachNode[path[1] as StationName] as LineName[]
    const lastLegLines = linesToReachNode[end] as LineName[]

    return {
        time: times[end] as number,
        path: path,
        changeStations: Array.from(changeStations),
        firstLegLines: firstLegLines,
        lastLegLines: lastLegLines,
    };
};