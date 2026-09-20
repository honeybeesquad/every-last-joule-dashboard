/**
 * loader-progress.js
 *
 * Progress for the initial data-load screen: a determinate rail, a region
 * counter, and the name of the source that just landed.
 *
 * The scrolling five-row terminal this used to drive is gone — the animated
 * mark (src/brand/mark-loop.svg) is the motion on that screen now, and three
 * competing animations read as noise. What survives is the information the
 * terminal actually carried: how far along we are, and where the last batch
 * came from.
 *
 * Usage:
 *   initLoaderProgress(totalRegions, totalFiles)
 *   trackFile(promise, label)  — wraps a FileAttachment promise
 */

let counterEl = null;
let totalEl = null;
let railEl = null;
let sourceEl = null;
let loadedRegions = 0;
let regionsPerFile = 0;
let filesRemaining = 0;
let filesTotal = 0;

/**
 * Called once before the Promise.all starts.
 * @param {number} totalRegions  - REGIONS.length
 * @param {number} totalFiles    - number of FileAttachment promises
 */
export function initLoaderProgress(totalRegions, totalFiles) {
  counterEl = document.getElementById("loader-n");
  totalEl = document.getElementById("loader-total");
  railEl = document.getElementById("loader-rail-fill");
  sourceEl = document.getElementById("loader-source");

  regionsPerFile = Math.floor(totalRegions / totalFiles);
  filesRemaining = totalFiles;
  filesTotal = totalFiles;

  if (totalEl) totalEl.textContent = totalRegions.toLocaleString();
  if (counterEl) counterEl.textContent = "0";
  if (railEl) railEl.style.width = "0%";
  if (sourceEl) sourceEl.textContent = "";
}

/**
 * Wraps a FileAttachment().json() promise.
 * On resolve: advances the rail, updates the counter, names the source.
 * @param {Promise<any>} promise
 * @param {string}       label    — human-readable source name
 */
export function trackFile(promise, label) {
  return promise.then((result) => {
    filesRemaining--;

    // Give the last file whatever regions are still unaccounted for
    const add = filesRemaining === 0
      ? (parseInt(totalEl?.textContent?.replace(/,/g, "") || "0") - loadedRegions)
      : regionsPerFile;

    loadedRegions = Math.max(0, loadedRegions + add);
    if (counterEl) counterEl.textContent = loadedRegions.toLocaleString();

    // The rail measures files, not regions: files resolving is the only
    // progress this page actually observes. It never runs backwards, and it
    // is clamped so an undercounted totalFiles cannot push it past 100%.
    if (railEl && filesTotal > 0) {
      const done = Math.min(filesTotal, Math.max(0, filesTotal - filesRemaining));
      railEl.style.width = `${((done / filesTotal) * 100).toFixed(1)}%`;
    }

    if (sourceEl) sourceEl.textContent = label;

    return result;
  });
}
