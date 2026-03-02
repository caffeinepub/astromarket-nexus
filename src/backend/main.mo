import Map "mo:core/Map";
import List "mo:core/List";
import Array "mo:core/Array";
import Text "mo:core/Text";
import Int "mo:core/Int";
import Float "mo:core/Float";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import OutcallModule "http-outcalls/outcall";



actor {
  type MarketDataPoint = {
    timestamp : Int;
    marketId : Text;
    value : Float;
    volume : Float;
  };

  type PlanetaryPosition = {
    timestamp : Int;
    body : Text;
    longitude : Float;
    latitude : Float;
    distance : Float;
  };

  type AspectEvent = {
    timestamp : Int;
    body1 : Text;
    body2 : Text;
    aspectType : Text;
    orb : Float;
  };

  type MoonPhase = {
    timestamp : Int;
    phase : Text;
    illumination : Float;
  };

  type CorrelationResult = {
    pearsonCoefficient : Float;
    dataPoints : Int;
    significance : Text;
  };

  type Annotation = {
    id : Text;
    timestamp : Int;
    title : Text;
    body : Text;
    tags : [Text];
    authorNote : Text;
  };

  type Stats = {
    totalMarketPoints : Nat;
    totalPositions : Nat;
    totalAspects : Nat;
    totalPhases : Nat;
    totalAnnotations : Nat;
  };

  module MarketDataPoint {
    public func compare(a : MarketDataPoint, b : MarketDataPoint) : Order.Order {
      Int.compare(a.timestamp, b.timestamp);
    };
  };

  module PlanetaryPosition {
    public func compare(a : PlanetaryPosition, b : PlanetaryPosition) : Order.Order {
      Int.compare(a.timestamp, b.timestamp);
    };
  };

  module AspectEvent {
    public func compare(a : AspectEvent, b : AspectEvent) : Order.Order {
      Int.compare(a.timestamp, b.timestamp);
    };
  };

  module MoonPhase {
    public func compare(a : MoonPhase, b : MoonPhase) : Order.Order {
      Int.compare(a.timestamp, b.timestamp);
    };
  };

  module Annotation {
    public func compare(a : Annotation, b : Annotation) : Order.Order {
      Int.compare(a.timestamp, b.timestamp);
    };
  };

  let marketDataStore = Map.empty<Text, List.List<MarketDataPoint>>();
  let positionsStore = List.empty<PlanetaryPosition>();
  let aspectsStore = List.empty<AspectEvent>();
  let phasesStore = List.empty<MoonPhase>();
  let annotationsStore = List.empty<Annotation>();

  public shared ({ caller }) func addMarketDataBatch(batch : [MarketDataPoint]) : async () {
    for (point in batch.values()) {
      let existing = switch (marketDataStore.get(point.marketId)) {
        case (null) { List.empty<MarketDataPoint>() };
        case (?list) { list };
      };
      existing.add(point);
      marketDataStore.add(point.marketId, existing);
    };
  };

  public query ({ caller }) func getMarketData(marketId : Text, start : Int, end : Int) : async [MarketDataPoint] {
    switch (marketDataStore.get(marketId)) {
      case (null) { [] };
      case (?data) {
        data.toArray().filter(func(point) { point.timestamp >= start and point.timestamp <= end });
      };
    };
  };

  public shared ({ caller }) func addPlanetaryPositions(positions : [PlanetaryPosition]) : async () {
    positionsStore.addAll(positions.values());
  };

  public query ({ caller }) func getPlanetaryPositions(body : Text, start : Int, end : Int) : async [PlanetaryPosition] {
    positionsStore.toArray().filter(
      func(pos) {
        pos.body == body and pos.timestamp >= start and pos.timestamp <= end
      }
    );
  };

  public shared ({ caller }) func addAspects(aspects : [AspectEvent]) : async () {
    aspectsStore.addAll(aspects.values());
  };

  public query ({ caller }) func getAspects(body : Text, aspectType : Text, start : Int, end : Int) : async [AspectEvent] {
    aspectsStore.toArray().filter(
      func(aspect) {
        aspect.timestamp >= start and aspect.timestamp <= end and (body == "" or aspect.body1 == body or aspect.body2 == body) and (aspectType == "" or aspect.aspectType == aspectType)
      }
    );
  };

  public shared ({ caller }) func addMoonPhases(phases : [MoonPhase]) : async () {
    phasesStore.addAll(phases.values());
  };

  public query ({ caller }) func getMoonPhases(start : Int, end : Int) : async [MoonPhase] {
    phasesStore.toArray().filter(func(phase) { phase.timestamp >= start and phase.timestamp <= end });
  };

  public shared ({ caller }) func addAnnotation(annotation : Annotation) : async () {
    let existing = annotationsStore.toArray().find(func(a) { a.id == annotation.id });
    if (existing != null) { Runtime.trap("Annotation with id " # annotation.id # " already exists") };
    annotationsStore.add(annotation);
  };

  public query ({ caller }) func getAnnotations(start : Int, end : Int) : async [Annotation] {
    annotationsStore.toArray().filter(func(a) { a.timestamp >= start and a.timestamp <= end });
  };

  public shared ({ caller }) func updateAnnotation(id : Text, updated : Annotation) : async () {
    let updatedList = annotationsStore.toArray().map(
      func(a) {
        if (a.id == id) {
          updated;
        } else {
          a;
        };
      }
    );
    annotationsStore.clear();
    annotationsStore.addAll(updatedList.values());
  };

  public shared ({ caller }) func deleteAnnotation(id : Text) : async () {
    let filtered = annotationsStore.toArray().filter(func(a) { a.id != id });
    annotationsStore.clear();
    annotationsStore.addAll(filtered.values());
  };

  public query ({ caller }) func computeCorrelation(marketId : Text, astroSeriesId : Text, startTime : Int, endTime : Int) : async CorrelationResult {
    {
      pearsonCoefficient = 0.0;
      dataPoints = 0;
      significance = "low";
    };
  };

  public query ({ caller }) func getTopCorrelations(startTime : Int, endTime : Int) : async [CorrelationResult] {
    [];
  };

  public query ({ caller }) func getStats() : async Stats {
    var marketCount = 0;
    for ((k, v) in marketDataStore.entries()) {
      marketCount += v.size();
    };
    {
      totalMarketPoints = marketCount;
      totalPositions = positionsStore.size();
      totalAspects = aspectsStore.size();
      totalPhases = phasesStore.size();
      totalAnnotations = annotationsStore.size();
    };
  };

  public shared ({ caller }) func seedData() : async () {};

  public type LivePrice = {
    marketId : Text;
    value : Float;
    change24h : Float;
    changePct24h : Float;
    lastUpdated : Int;
  };

  let livePricesStore = Map.empty<Text, LivePrice>();

  public shared ({ caller }) func fetchLiveMarketData() : async () {
    let _ = await fetchBtcPrice();
    let _ = await fetchEthPrice();
    let _ = await fetchTotalMcap();
    let _ = await fetchBtcDominance();
    let _ = await fetchFearGreedIndex();
  };

  system func heartbeat() : async () {
    ignore fetchLiveMarketData();
  };

  public query ({ caller }) func getLiveMarketSnapshot() : async [LivePrice] {
    livePricesStore.toArray().map(func((_, price)) { price });
  };

  public query ({ caller }) func getLastFetchTime() : async Int {
    var maxTime = 0 : Int;
    for ((id, price) in livePricesStore.entries()) {
      if (price.lastUpdated > maxTime) {
        maxTime := price.lastUpdated;
      };
    };
    maxTime;
  };

  public shared ({ caller }) func fetchBtcPrice() : async () {};
  public shared ({ caller }) func fetchEthPrice() : async () {};
  public shared ({ caller }) func fetchTotalMcap() : async () {};
  public shared ({ caller }) func fetchBtcDominance() : async () {};
  public shared ({ caller }) func fetchFearGreedIndex() : async () {};

  public query ({ caller }) func transform(input : OutcallModule.TransformationInput) : async OutcallModule.TransformationOutput {
    let headers = [({ name = "Content-Type"; value = "application/json" }) : OutcallModule.Header];
    {
      input.response with
      headers;
    };
  };
};
