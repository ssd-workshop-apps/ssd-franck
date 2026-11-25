// workshop-data.js: stores the app's data on the workshop's data service.
// Do not change this file. Use it from app.js:
//   const score = await workshopData.get("score");   // the stored value, or null when there is none
//   await workshopData.set("score", 42);              // any JSON value: number, text, list, object
//   await workshopData.remove("score");
// Keys use letters, digits, dashes and underscores. Every visitor of the app shares the same data.
"use strict";

(function () {
  const KEY = /^[A-Za-z0-9_-]+$/;

  // The app lives at /apps/<nickname>/; its data at /api/apps/<nickname>/data/<key> on the same server.
  function address(key) {
    const match = /^\/apps\/([^/]+)\//.exec(location.pathname);
    if (!match) {
      throw new Error("This page is not running at its workshop address, so it cannot store data.");
    }
    if (typeof key !== "string" || !KEY.test(key)) {
      throw new Error("A key may only hold letters, digits, dashes and underscores.");
    }
    return "/api/apps/" + match[1] + "/data/" + key;
  }

  async function send(method, key, value) {
    const options = { method: method, credentials: "omit", headers: { accept: "application/json" } };
    if (method === "PUT") {
      options.headers["content-type"] = "application/json";
      options.body = JSON.stringify(value);
    }
    let response;
    try {
      response = await fetch(address(key), options);
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error("The data service could not be reached. Check the connection and try again.", {
          cause: error,
        });
      }
      throw error;
    }
    if (response.status === 404) {
      throw new Error("This app is not live on the workshop yet, so it cannot load or save data.");
    }
    if (!response.ok) {
      let message = "The data service answered with an error (" + response.status + ").";
      try {
        const body = await response.json();
        if (body && typeof body.message === "string") message = body.message;
      } catch {
        // Keep the general message.
      }
      throw new Error(message);
    }
    // A key with no value answers null.
    return method === "GET" ? response.json() : undefined;
  }

  window.workshopData = Object.freeze({
    get: function (key) {
      return send("GET", key);
    },
    set: function (key, value) {
      if (value === undefined) return Promise.reject(new Error("There is no value to store."));
      return send("PUT", key, value);
    },
    remove: function (key) {
      return send("DELETE", key);
    },
  });
})();
