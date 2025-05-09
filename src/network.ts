type Line = {
    name: string;
    innerColor: string;
    outerColor: string;
}

type Station = {
    name: string;
    services: string[];
}

type Connection = {
    from: string;
    to: string;
    services: string[];
    time: number;
}

let lines: Line[] = [];
let stations: Station[] = [];
let edges: Connection[] = [];

export const dataLoadedPromise = fetch("./data/network.json")
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        lines = data.lines;
        stations = data.stations;
        edges = data.edges;
        return true;
    })
    .catch(error => {
        console.error("Could not load network data:", error);
        return false;
    });

export { stations, lines };

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
    return availableStations[Math.floor(Math.random() * availableStations.length)].name;
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
const findShortestSegmentTime = (startName: string, endName: string) => {
    if (!stations.length || !Array.isArray(edges) || edges.length === 0) {
        console.error("Segment calculation requires station data and edges array.");
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
    } = {}; // Lines used for incoming edge
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

        const relevantEdges = edges.filter(edge => edge.from === currentNode || edge.to === currentNode);

        for (const edge of relevantEdges) {
            const neighborName = (edge.from === currentNode) ? edge.to : edge.from;
            if (visited.has(neighborName)) continue;

            const edgeTime = edge.time;
            const edgeLines = Array.from(new Set((edge.services || []).map(s => s.split('|')[0]))); 

            if (typeof edgeTime !== 'number') continue; // Skip invalid edges

            const newTime = currentTime + edgeTime; // NO penalty here

            if (newTime < times[neighborName]) {
                times[neighborName] = newTime;
                previousNodes[neighborName] = currentNode;
                previousLines[neighborName] = edgeLines; // Store lines for edge leading here
                pq.push([newTime, neighborName]);
            }
        }
    }

    if (times[endName] === Infinity) {
        return null; // No path found for segment
    }

    // Return time and the lines used for the *last* edge of this segment
    return {
        time: times[endName],
        linesUsed: previousLines[endName] || [] 
    };
};

export const calculateOptimalPath = (fromName: string, toName: string) => {
    // 1. Initialization
    if (!stations.length || !Array.isArray(edges) || edges.length === 0) { 
        console.error("Path calculation requires station data and edges array.");
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

        const relevantEdges = edges.filter(edge => edge.from === currentNode || edge.to === currentNode);

        for (const edge of relevantEdges) { 
            const neighborName = (edge.from === currentNode) ? edge.to : edge.from;

            if (visited.has(neighborName)) continue;


            const edgeTime = edge.time;
            const edgeLines = Array.from(new Set((edge.services || []).map(s => s.split('|')[0]))); 
            
            if (typeof edgeTime !== 'number') {
                 continue;
            }

            // Calculate change penalty
            let changePenalty = 0;
            if (incomingLines && incomingLines.length > 0) { 
                const hasCommonLine = edgeLines.some(line => incomingLines.includes(line));
                if (!hasCommonLine) {
                    changePenalty = 3; 
                }
            }

            const newTime = currentTime + edgeTime + changePenalty;

            if (newTime < times[neighborName]) {
                times[neighborName] = newTime;
                previousNodes[neighborName] = currentNode;
                previousLines[neighborName] = edgeLines; 
                pq.push([newTime, neighborName, edgeLines]);
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
        current = previousNodes[current];
    }
    path.reverse();

    const changeStations = new Set([fromName]);
    for (let i = 0; i < path.length - 1; i++) {
        const stationA = path[i];
        const stationB = path[i+1];

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
        const segmentStart = path[i];
        const segmentEnd = path[i + 1];

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