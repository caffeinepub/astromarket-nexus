import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface LivePrice {
    change24h: number;
    value: number;
    lastUpdated: bigint;
    marketId: string;
    changePct24h: number;
}
export interface CorrelationResult {
    pearsonCoefficient: number;
    significance: string;
    dataPoints: bigint;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface PlanetaryPosition {
    latitude: number;
    body: string;
    distance: number;
    longitude: number;
    timestamp: bigint;
}
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface Annotation {
    id: string;
    title: string;
    body: string;
    tags: Array<string>;
    authorNote: string;
    timestamp: bigint;
}
export interface Stats {
    totalAspects: bigint;
    totalMarketPoints: bigint;
    totalPositions: bigint;
    totalPhases: bigint;
    totalAnnotations: bigint;
}
export interface MarketDataPoint {
    value: number;
    volume: number;
    marketId: string;
    timestamp: bigint;
}
export interface AspectEvent {
    orb: number;
    aspectType: string;
    timestamp: bigint;
    body1: string;
    body2: string;
}
export interface http_header {
    value: string;
    name: string;
}
export interface MoonPhase {
    illumination: number;
    timestamp: bigint;
    phase: string;
}
export interface backendInterface {
    addAnnotation(annotation: Annotation): Promise<void>;
    addAspects(aspects: Array<AspectEvent>): Promise<void>;
    addMarketDataBatch(batch: Array<MarketDataPoint>): Promise<void>;
    addMoonPhases(phases: Array<MoonPhase>): Promise<void>;
    addPlanetaryPositions(positions: Array<PlanetaryPosition>): Promise<void>;
    computeCorrelation(marketId: string, astroSeriesId: string, startTime: bigint, endTime: bigint): Promise<CorrelationResult>;
    deleteAnnotation(id: string): Promise<void>;
    fetchBtcDominance(): Promise<void>;
    fetchBtcPrice(): Promise<void>;
    fetchEthPrice(): Promise<void>;
    fetchFearGreedIndex(): Promise<void>;
    fetchLiveMarketData(): Promise<void>;
    fetchTotalMcap(): Promise<void>;
    getAnnotations(start: bigint, end: bigint): Promise<Array<Annotation>>;
    getAspects(body: string, aspectType: string, start: bigint, end: bigint): Promise<Array<AspectEvent>>;
    getLastFetchTime(): Promise<bigint>;
    getLiveMarketSnapshot(): Promise<Array<LivePrice>>;
    getMarketData(marketId: string, start: bigint, end: bigint): Promise<Array<MarketDataPoint>>;
    getMoonPhases(start: bigint, end: bigint): Promise<Array<MoonPhase>>;
    getPlanetaryPositions(body: string, start: bigint, end: bigint): Promise<Array<PlanetaryPosition>>;
    getStats(): Promise<Stats>;
    getTopCorrelations(startTime: bigint, endTime: bigint): Promise<Array<CorrelationResult>>;
    seedData(): Promise<void>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
    updateAnnotation(id: string, updated: Annotation): Promise<void>;
}
