/**
 * loader-progress.js
 *
 * Scrolling terminal UI for the initial data-load screen.
 * Shows each data source as it resolves, with a live region counter.
 *
 * Usage:
 *   initLoaderProgress(totalRegions, totalFiles)
 *   trackFile(promise, label)  — wraps a FileAttachment promise
 */

const ROW_H       = 23;   // px — must match CSS .loader-t-row height
const VISIBLE_ROWS = 5;   // rows shown at once

let scrollEl    = null;
let counterEl   = null;
let totalEl     = null;
let rows        = [];
let loadedRegions = 0;
let regionsPerFile = 0;
let filesRemaining = 0;

/**
 * Called once before the Promise.all starts.
 * @param {number} totalRegions  - REGIONS.length
 * @param {number} totalFiles    - number of FileAttachment promises
 */
export function initLoaderProgress(totalRegions, totalFiles) {
  scrollEl      = document.getElementById("loader-terminal-scroll");
  counterEl     = document.getElementById("loader-n");
  totalEl       = document.getElementById("loader-total");

  regionsPerFile = Math.floor(totalRegions / totalFiles);
  filesRemaining = totalFiles;

  if (totalEl) totalEl.textContent = totalRegions.toLocaleString();
  if (counterEl) counterEl.textContent = "0";
}

/**
 * Wraps a FileAttachment().json() promise.
 * On resolve: adds a row to the terminal, updates the counter.
 * @param {Promise<any>} promise
 * @param {string}       label    — human-readable source name shown in the terminal
 */
export function trackFile(promise, label) {
  return promise.then((result) => {
    filesRemaining--;

    // Give the last file whatever regions are still unaccounted for
    const add = filesRemaining === 0
      ? (parseInt(totalEl?.textContent?.replace(/,/g, "") || "0") - loadedRegions)
      : regionsPerFile;

    loadedRegions = Math.max(0, loadedRegions + add);
    _addRow(label);
    if (counterEl) counterEl.textContent = loadedRegions.toLocaleString();

    return result;
  });
}

/** @private */
function _addRow(label) {
  if (!scrollEl) return;

  // Mark previous active row as done
  const prev = scrollEl.querySelector(".loader-t-row.active");
  if (prev) {
    prev.classList.replace("active", "done");
    const icon = prev.querySelector(".loader-t-icon");
    if (icon) icon.textContent = "✓";
  }

  // Append new active row
  const row = document.createElement("div");
  row.className = "loader-t-row active";
  row.innerHTML =
    `<span class="loader-t-icon">···</span>` +
    `<span class="loader-t-name">${label}</span>`;
  scrollEl.appendChild(row);
  rows.push(row);

  // Slide the list up so the new row enters from the bottom
  const offset = Math.max(0, (rows.length - VISIBLE_ROWS) * ROW_H);
  scrollEl.style.transition =
    rows.length > VISIBLE_ROWS
      ? "transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)"
      : "none";
  scrollEl.style.transform = `translateY(-${offset}px)`;
}
