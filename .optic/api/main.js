const { inspect } = require('util');
const specData = require("./specification.json");

function main() {
  const spec = Spec.fromSpecData(specData);
  const graph = Graph.fromSpec(spec);
  const changelog = spec.generateChangelog(graph);

  // console.log(inspect(graph, {
  //   depth: 5,
  //   colors: true,
  // }));

  console.log(inspect(changelog, {
    depth: 5,
    colors: true,
  }));
}

class Graph {
  constructor() {
    this.path = {};
    this.shape = {};
    this.field = {};
    this.request = {};
    this.requestBody = {};
    this.response = {};
    this.responseBody = {}
    this.requestParameter = {};
  }

  static fromSpec(spec) {
    const graph = new Graph();
    for (const batch of spec.batches) {
      for (const event of batch.events) {
        graph.handleEvent(event);
      }
    }
    return graph;
  }

  addEvent(event, nodeType, idProp, props) {
    const eventData = event.allData();
    const pluckedData = props.reduce((memo, prop) => {
      memo[prop] = eventData[prop];
      return memo;
    }, {});
    this[nodeType][eventData[idProp]] = pluckedData;
  }

  handleEvent(event) {
    switch (event.getType()) {
      case "PathComponentAdded":
        this.addEvent(event, "path", "pathId", ["parentPathId", "name"]);
        break;
      case "ShapeAdded":
        this.addEvent(event, "shape", "shapeId", ["baseShapeId"])
        break;
      case "RequestAdded":
        this.addEvent(event, "request", "requestId", ["pathId", "httpMethod"]);
        break;
      case "RequestBodySet":
        this.addEvent(event, "requestBody", "requestId", ["bodyDescriptor"]);
        break;
      case "FieldAdded":
        this.addEvent(event, "field", "fieldId", ["shapeId", "name", "shapeDescriptor"]);
        break;
      case "ResponseBodySet":
        this.addEvent(event, "responseBody", "responseId", ["bodyDescriptor"]);
        break;
      case "RequestParameterShapeSet":
        this.addEvent(event, "requestParameter", "parameterId", ["parameterDescriptor"]);
        break;
      case "ResponseAddedByPathAndMethod":
        this.addEvent(event, "response", "responseId", ["pathId", "httpMethod", "httpStatusCode"]);
        break;
    }
  }
}

class Spec {
  constructor(batches = []) {
    this.batches = batches;
  }

  static fromSpecData(specData) {
    const cursor = new Cursor(specData);
    const spec = new Spec();
    let currEvent = cursor.currEvent();

    while (!cursor.isDone()) {
      if (currEvent.eventIs("BatchCommitStarted")) {
        const batch = new Batch(currEvent.eventData("batchId"), currEvent.eventData("commitMessage"));
        currEvent = cursor.next();
        while (!currEvent.eventIs("BatchCommitEnded")) {
          batch.addEvent(currEvent);
          currEvent = cursor.next();
        }
        spec.batches.push(batch);
      }
      currEvent = cursor.next();
    }
    return spec;
  }

  generateChangelog(graph) {
    const changes = [];
    for (const batch of this.batches) {
      for (const event of batch.events) {
        switch (event.getType()) {
          // Yikes
          case "FieldAdded":
            const fieldId = event.eventData("fieldId");
            const field = graph.field[fieldId];
            const fieldTypeShapeId = field.shapeDescriptor.FieldShapeFromShape.shapeId;
            const fieldType = graph.shape[fieldTypeShapeId].baseShapeId;

            for (const responseId in graph.responseBody) {
              const responseBody = graph.responseBody[responseId];
              if (field.shapeId === responseBody.bodyDescriptor.shapeId) {
                const response = graph.response[responseId];
                const path = graph.path[response.pathId];
                changes.push({
                  category: 'response.field.added',
                  info: {
                    fieldId,
                    httpMethod: response.httpMethod,
                    httpStatusCode: response.httpStatusCode,
                    path
                  },
                  name: field.name,
                  type: fieldType
                })
              }
            }

            for (const requestId in graph.requestBody) {
              const requestBody = graph.requestBody[requestId];
              if (field.shapeId === requestBody.bodyDescriptor.shapeId) {
                const request = graph.request[requestId];
                const path = graph.path[request.pathId];
                changes.push({
                  category: 'request.field.added',
                  info: {
                    fieldId,
                    httpMethod: request.httpMethod,
                    path
                  },
                  name: field.name,
                  type: fieldType
                })
              }
            }
        }
      }
    }
    return { changes };
  }
}

class Batch {
  constructor(batchId, commitMessage) {
    this.batchId = batchId;
    this.commitMessage = commitMessage;
    this.events = [];
  }

  addEvent(event) {
    this.events.push(event);
  }
}

class Cursor {
  constructor(specData) {
    this.eventIdx = 0;
    this.specData = specData;
  }

  currEvent() {
    return new Event(this.specData[this.eventIdx]);
  }

  next() {
    this.eventIdx++;
    return this.currEvent();
  }

  isDone() {
    return this.eventIdx === specData.length;
  }
}

class Event {
  constructor(data) {
    this.data = data;
  }

  eventIs(eventName) {
    return eventName in this.data;
  }

  getType() {
    return Object.keys(this.data)[0];
  }

  allData() {
    return this.data[this.getType()];
  }

  eventData(property) {
    return this.data[this.getType()][property];
  }
}

main();