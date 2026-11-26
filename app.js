// app.js: Personal Movie Tracker behaviour.
"use strict";

// ----- State -----
let films = []; // array of film objects loaded from storage
let currentFilter = "all";
let currentSort = "date";
let pendingFilm = null; // film being confirmed before adding
let openFilmId = null; // id of film currently shown in detail view
let currentRating = 0; // star rating being edited in detail form

// ----- Storage key -----
const STORAGE_KEY = "movie-watchlist-v1";

// ----- DOM references -----
const screens = document.querySelectorAll(".screen");

const movieListEl = document.getElementById("movie-list");
const listStatus = document.getElementById("list-status");
const emptyMsg = document.getElementById("empty-msg");
const filterBtns = document.querySelectorAll(".filter-btn[data-filter]");
const sortBtns = document.querySelectorAll(".filter-btn[data-sort]");

const searchInput = document.getElementById("search-input");
const searchStatus = document.getElementById("search-status");
const searchResults = document.getElementById("search-results");

const addPoster = document.getElementById("add-poster");
const addNoPoster = document.getElementById("add-no-poster");
const addTitleEl = document.getElementById("add-title");
const addDescEl = document.getElementById("add-desc");
const confirmAddBtn = document.getElementById("confirm-add-btn");
const cancelAddBtn = document.getElementById("cancel-add-btn");
const addStatus = document.getElementById("add-status");

const backBtn = document.getElementById("back-btn");
const detailPoster = document.getElementById("detail-poster");
const detailNoPoster = document.getElementById("detail-no-poster");
const detailTitleEl = document.getElementById("detail-title");
const detailAddedEl = document.getElementById("detail-added");
const detailForm = document.getElementById("detail-form");
const starBtns = document.querySelectorAll(".star-btn");
const reviewInput = document.getElementById("review-input");
const watchDateInput = document.getElementById("watch-date-input");
const watchedCheckbox = document.getElementById("watched-checkbox");
const deleteBtn = document.getElementById("delete-btn");
const detailStatus = document.getElementById("detail-status");

// ----- Utility -----
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function starsText(rating) {
  if (!rating) return "";
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

// ----- Screen navigation -----
function showScreen(id) {
  screens.forEach(function (s) {
    s.classList.toggle("active", s.id === "screen-" + id);
  });
}

// ----- Load / Save films -----
async function loadFilms() {
  listStatus.textContent = "Loading…";
  try {
    const stored = await workshopData.get(STORAGE_KEY);
    films = Array.isArray(stored) ? stored : [];
    listStatus.textContent = "";
    renderList();
  } catch (error) {
    listStatus.textContent = "Could not load your films: " + error.message;
  }
}

// ----- Render Movie List -----
function getFilteredSorted() {
  let list = films.slice();
  if (currentFilter === "watched") {
    list = list.filter(function (f) { return f.watched; });
  } else if (currentFilter === "unwatched") {
    list = list.filter(function (f) { return !f.watched; });
  }
  if (currentSort === "rating") {
    list.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
  } else {
    list.sort(function (a, b) { return b.dateAdded.localeCompare(a.dateAdded); });
  }
  return list;
}

function renderList() {
  const list = getFilteredSorted();
  movieListEl.innerHTML = "";
  if (list.length === 0) {
    emptyMsg.hidden = false;
    return;
  }
  emptyMsg.hidden = true;
  list.forEach(function (film) {
    const li = document.createElement("li");
    li.className = "movie-card";
    li.setAttribute("tabindex", "0");
    li.setAttribute("role", "button");
    li.setAttribute("aria-label", film.title);

    if (film.posterUrl) {
      const img = document.createElement("img");
      img.src = film.posterUrl;
      img.alt = film.title + " poster";
      img.className = "movie-card-poster";
      li.appendChild(img);
    } else {
      const np = document.createElement("div");
      np.className = "movie-card-no-poster";
      np.textContent = "No poster";
      li.appendChild(np);
    }

    const info = document.createElement("div");
    info.className = "movie-card-info";

    const titleP = document.createElement("p");
    titleP.className = "movie-card-title";
    titleP.textContent = film.title;
    info.appendChild(titleP);

    const statusP = document.createElement("p");
    statusP.className = "movie-card-status";
    statusP.textContent = film.watched ? "Watched" : "Unwatched";
    info.appendChild(statusP);

    if (film.rating) {
      const ratingP = document.createElement("p");
      ratingP.className = "movie-card-rating";
      ratingP.textContent = starsText(film.rating);
      ratingP.setAttribute("aria-label", film.rating + " out of 5 stars");
      info.appendChild(ratingP);
    }

    if (film.review) {
      const reviewP = document.createElement("p");
      reviewP.className = "movie-card-review";
      reviewP.textContent = film.review;
      info.appendChild(reviewP);
    }

    li.appendChild(info);

    function openFilm() {
      openFilmId = film.id;
      showDetailScreen(film);
    }
    li.addEventListener("click", openFilm);
    li.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openFilm();
      }
    });

    movieListEl.appendChild(li);
  });
}

// ----- Filter / Sort buttons -----
filterBtns.forEach(function (btn) {
  btn.addEventListener("click", function () {
    currentFilter = btn.dataset.filter;
    filterBtns.forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    renderList();
  });
});

sortBtns.forEach(function (btn) {
  btn.addEventListener("click", function () {
    currentSort = btn.dataset.sort;
    sortBtns.forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    renderList();
  });
});

// ----- Search Films -----
let searchTimer = null;

searchInput.addEventListener("input", function () {
  clearTimeout(searchTimer);
  const query = searchInput.value.trim();
  if (!query) {
    searchResults.innerHTML = "";
    searchResults.hidden = true;
    searchStatus.textContent = "";
    return;
  }
  searchStatus.textContent = "Searching…";
  searchTimer = setTimeout(function () { runSearch(query); }, 300);
});

async function runSearch(query) {
  searchResults.innerHTML = "";
  searchResults.hidden = true;

  let titles = [];
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 10000);
  try {
    const url = "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=8&srsearch=" + encodeURIComponent(query + " film");
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) throw new Error("Wikipedia search failed (" + resp.status + ").");
    const data = await resp.json();
    if (data && data.query && Array.isArray(data.query.search)) {
      titles = data.query.search.map(function (item) { return item.title; });
    }
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      searchStatus.textContent = "The search timed out. Try again later.";
    } else {
      searchStatus.textContent = "The search could not be completed right now. Try again later.";
    }
    return;
  }

  if (titles.length === 0) {
    searchStatus.textContent = "No results found. Try a different title.";
    return;
  }
  searchStatus.textContent = "Loading results…";

  // Fetch summaries for each title (up to 5) in parallel
  const summaryPromises = titles.slice(0, 5).map(function (title) {
    const ctrl = new AbortController();
    const t = setTimeout(function () { ctrl.abort(); }, 10000);
    return fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title), { signal: ctrl.signal })
      .then(function (r) { clearTimeout(t); return r.ok ? r.json() : null; })
      .catch(function () { clearTimeout(t); return null; });
  });

  let summaries;
  try {
    summaries = await Promise.all(summaryPromises);
  } catch (err) {
    searchStatus.textContent = "The results could not be loaded right now. Try again later.";
    return;
  }

  searchStatus.textContent = "";
  searchResults.innerHTML = "";
  let shown = 0;

  summaries.forEach(function (summary) {
    if (!summary || !summary.title) return;
    shown++;
    const li = document.createElement("li");
    li.className = "search-result-card";

    if (summary.thumbnail && summary.thumbnail.source) {
      const img = document.createElement("img");
      img.src = summary.thumbnail.source;
      img.alt = summary.title + " poster";
      img.className = "movie-card-poster";
      li.appendChild(img);
    } else {
      const np = document.createElement("div");
      np.className = "movie-card-no-poster";
      np.textContent = "No poster";
      li.appendChild(np);
    }

    const infoDiv = document.createElement("div");
    infoDiv.className = "search-result-info";

    const titleP = document.createElement("p");
    titleP.className = "search-result-title";
    titleP.textContent = summary.title;
    infoDiv.appendChild(titleP);

    if (summary.description) {
      const descP = document.createElement("p");
      descP.className = "search-result-desc";
      descP.textContent = summary.description;
      infoDiv.appendChild(descP);
    }

    li.appendChild(infoDiv);

    const pickBtn = document.createElement("button");
    pickBtn.type = "button";
    pickBtn.className = "pick-btn";
    pickBtn.textContent = "Add";
    pickBtn.setAttribute("aria-label", "Add " + summary.title);
    pickBtn.addEventListener("click", function () {
      pendingFilm = {
        title: summary.title,
        posterUrl: (summary.thumbnail && summary.thumbnail.source) ? summary.thumbnail.source : "",
        description: summary.description || ""
      };
      showAddScreen(pendingFilm);
    });
    li.appendChild(pickBtn);

    searchResults.appendChild(li);
  });

  if (shown === 0) {
    searchStatus.textContent = "No film results found. Try a different title.";
  } else {
    searchResults.hidden = false;
  }
}

// ----- Add Film Screen -----
function showAddScreen(film) {
  addStatus.textContent = "";
  addTitleEl.textContent = film.title;
  addDescEl.textContent = film.description || "";
  if (film.posterUrl) {
    addPoster.src = film.posterUrl;
    addPoster.alt = film.title + " poster";
    addPoster.hidden = false;
    addNoPoster.hidden = true;
  } else {
    addPoster.src = "";
    addPoster.alt = "";
    addPoster.hidden = true;
    addNoPoster.hidden = false;
  }
  showScreen("add-film");
}

confirmAddBtn.addEventListener("click", async function () {
  if (!pendingFilm) return;
  confirmAddBtn.disabled = true;
  addStatus.textContent = "Adding…";
  const film = {
    id: makeId(),
    title: pendingFilm.title,
    posterUrl: pendingFilm.posterUrl,
    watched: false,
    rating: 0,
    review: "",
    dateWatched: "",
    dateAdded: new Date().toISOString()
  };
  films.push(film);
  try {
    await workshopData.set(STORAGE_KEY, films);
    addStatus.textContent = "Added!";
    pendingFilm = null;
    setTimeout(function () {
      showScreen("movie-list");
      searchInput.value = "";
      searchResults.innerHTML = "";
      searchResults.hidden = true;
      searchStatus.textContent = "";
      renderList();
    }, 600);
  } catch (err) {
    films.pop();
    addStatus.textContent = "Could not save: " + err.message;
  } finally {
    confirmAddBtn.disabled = false;
  }
});

cancelAddBtn.addEventListener("click", function () {
  pendingFilm = null;
  showScreen("movie-list");
});

// ----- Film Detail Screen -----
function showDetailScreen(film) {
  detailStatus.textContent = "";
  detailTitleEl.textContent = film.title;
  detailAddedEl.textContent = "Added " + formatDate(film.dateAdded);

  if (film.posterUrl) {
    detailPoster.src = film.posterUrl;
    detailPoster.alt = film.title + " poster";
    detailPoster.hidden = false;
    detailNoPoster.hidden = true;
  } else {
    detailPoster.src = "";
    detailPoster.alt = "";
    detailPoster.hidden = true;
    detailNoPoster.hidden = false;
  }

  currentRating = film.rating || 0;
  updateStars(currentRating);

  reviewInput.value = film.review || "";
  watchDateInput.value = film.dateWatched || "";
  watchedCheckbox.checked = film.watched || false;

  showScreen("film-detail");
}

function updateStars(value) {
  starBtns.forEach(function (btn) {
    btn.classList.toggle("lit", parseInt(btn.dataset.value, 10) <= value);
  });
}

starBtns.forEach(function (btn) {
  btn.addEventListener("click", function () {
    const val = parseInt(btn.dataset.value, 10);
    // Allow toggling off if same star is clicked
    currentRating = currentRating === val ? 0 : val;
    updateStars(currentRating);
  });
  btn.addEventListener("mouseover", function () {
    updateStars(parseInt(btn.dataset.value, 10));
  });
  btn.addEventListener("mouseout", function () {
    updateStars(currentRating);
  });
});

backBtn.addEventListener("click", function () {
  openFilmId = null;
  showScreen("movie-list");
  renderList();
});

detailForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  if (!openFilmId) return;
  const film = films.find(function (f) { return f.id === openFilmId; });
  if (!film) return;

  const saveBtn = detailForm.querySelector(".btn-primary");
  saveBtn.disabled = true;
  detailStatus.textContent = "Saving…";

  film.rating = currentRating;
  film.review = reviewInput.value.trim();
  film.dateWatched = watchDateInput.value;
  film.watched = watchedCheckbox.checked;

  try {
    await workshopData.set(STORAGE_KEY, films);
    detailStatus.textContent = "Saved.";
  } catch (err) {
    detailStatus.textContent = "Could not save: " + err.message;
  } finally {
    saveBtn.disabled = false;
  }
});

deleteBtn.addEventListener("click", async function () {
  if (!openFilmId) return;
  deleteBtn.disabled = true;
  detailStatus.textContent = "Removing…";
  films = films.filter(function (f) { return f.id !== openFilmId; });
  try {
    await workshopData.set(STORAGE_KEY, films);
    openFilmId = null;
    showScreen("movie-list");
    renderList();
  } catch (err) {
    detailStatus.textContent = "Could not remove: " + err.message;
    deleteBtn.disabled = false;
  }
});

// ----- Boot -----
loadFilms();
