export type Line = {
    name: string;
    innerColor: string;
    outerColor: string;
}

export type Station = {
    name: string;
    services: string[];
}


export type Connection = {
    from: string;
    to: string;
    services: string[];
    time: number;
}