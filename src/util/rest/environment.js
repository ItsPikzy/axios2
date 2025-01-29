"use strict";

let defaultStrategy;
function setDefaultStrategy(newStrategy) {
  defaultStrategy = newStrategy;
}

function getDefaultStrategy() {
  return defaultStrategy;
}

module.exports = {
  setDefaultStrategy,
  getDefaultStrategy
}
