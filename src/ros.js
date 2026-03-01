import * as ROSLIB from "roslib";

export function createRos(url) {
  return new ROSLIB.Ros({ url });
}

export function makeTopic(ros, name, messageType) {
  return new ROSLIB.Topic({ ros, name, messageType });
}

export function makeActionClient(ros, name, actionName) {
  return new ROSLIB.ActionClient({
    ros,
    serverName: name,
    actionName,
  });
}

export function makeService(ros, name, serviceType) {
  return new ROSLIB.Service({ ros, name, serviceType });
}