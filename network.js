let lines = [];
let stations = [];

const dataLoadedPromise = fetch("./data/network.json")
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        lines = data.lines;
        stations = data.stations;
        return true;
    })
    .catch(error => {
        console.error("Could not load network data:", error);
        return false;
    });

export { dataLoadedPromise, stations, lines };

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
    if (typeof name !== 'string') return ''; // Handle non-string input
    return name
        .replace(/&/g, 'and')
        .replace(/['’]/g, '') // Handle different apostrophes
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
    return supersetMatchingStation?.name
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

    const commonLineNames = fromStation.services.filter(lineName =>
        toStation.services.includes(lineName)
    );

    const connectingLines = commonLineNames.map(lineName => lineName.split("|")[0]);
    return Array.from(new Set(connectingLines)).map(lineName => lines.find(line => line.name === lineName));
};

export const getRandomStation = (avoidStations = []) => {
    const availableStations = stations.filter(station => !avoidStations.includes(station.name));
    return availableStations[Math.floor(Math.random() * availableStations.length)].name;
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

    const lineObjects = stationLineNames.map(lineName =>
        lines.find(line => line.name === lineName)
    ).filter(line => line);

    return lineObjects;
};
