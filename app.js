// app.js: what the page does. A shared counter, stored with workshop-data.js.
"use strict";

const countText = document.getElementById("count");
const pressButton = document.getElementById("press");
const statusText = document.getElementById("status");

let count = 0;

function show(message) {
  countText.textContent = String(count);
  statusText.textContent = message;
}

async function load() {
  try {
    const stored = await workshopData.get("presses");
    count = typeof stored === "number" ? stored : 0;
    show("");
  } catch (error) {
    show(error.message);
  }
}

pressButton.addEventListener("click", async function () {
  pressButton.disabled = true;
  count += 1;
  show("Saving...");
  try {
    await workshopData.set("presses", count);
    show("Saved.");
  } catch (error) {
    count -= 1;
    show(error.message);
  } finally {
    pressButton.disabled = false;
  }
});

load();
