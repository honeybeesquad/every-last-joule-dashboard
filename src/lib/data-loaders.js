/**
 * data-loaders.js — the one declared mapping of loader key → data file → label.
 *
 * WHY THIS FILE EXISTS
 *
 * `src/index.md` and `src/embed/globe.md` used to hold two parallel structures
 * each: an array of `FileAttachment(...)` promises, and an array destructuring
 * that named the results. A name was bound to a file by *array position only*.
 *
 * PR #203 inserted six India loaders into the fetch array but appended their
 * names after `pakistan, iran` in the destructuring. That rotated eight
 * bindings by six slots on both pages, and nine regions rendered another
 * region's curtailment on the live dashboard for about three months. Only the
 * three whose data shape differed were caught; the rest were well-formed data
 * in the wrong slot, and nothing — not tsc, not vitest, not a CI gate — could
 * see it. PR #922 corrected the rotation; this file removes the possibility.
 *
 * Here the key and its file are one expression on one line, so a name cannot
 * drift from its file: there is no position to get wrong. Both pages derive
 * their fetch list AND their result record from this array, so the two pages
 * cannot disagree about what to load either.
 *
 * ADDING A LOADER
 *
 * Add one row below. That is the whole change: the dashboard fetches it, the
 * loading terminal counts it, the embed fetches it, and `loadDataFiles()`
 * exposes it as `feeds.<key>`. Then wire `feeds.<key>` into the `regionData`
 * literal on both pages (`tests/globe-drift.test.ts` fails until you do).
 *
 * `FileAttachment` is resolved by Observable Framework at build time and needs
 * a literal string argument, so the paths below cannot be computed — they are
 * relative to *this file* (`src/lib/`), not to the importing page. The
 * framework rewrites them per importer.
 *
 * FIELDS
 *
 *   key    Identifier the pages read the payload as (`feeds.<key>`). Kebab-cased
 *          it must equal the data file's stem — `tests/globe-drift.test.ts`
 *          asserts that pairing, which is what makes a rotation unrepresentable.
 *   file   The FileAttachment. Lazy: nothing is fetched until `.json()`.
 *   label  Human-readable source name shown in the dashboard loading terminal.
 *   embed  Set `false` to keep an entry off `/embed/globe`. Only `zenodoVersion`
 *          is exempt: it is dashboard chrome (the version badge), not a region,
 *          and it is a live Zenodo fetch the embed must not block on.
 *
 * NOT EVERY ENTRY IS ONE REGION. `cbeci`, `anchor` and `zenodoVersion` are
 * non-region payloads, and `statics` bundles many regions into one file. The
 * loading terminal's per-file share is therefore a smoothed approximation of
 * progress, not a literal region tally — but because its denominator is
 * `DATA_LOADERS.length` it still lands on exactly `REGIONS.length`.
 */

import { FileAttachment } from "observablehq:stdlib";

/**
 * @typedef {object} DataLoaderEntry
 * @property {string} key
 * @property {{json: () => Promise<any>}} file
 * @property {string} label
 * @property {boolean} [embed]
 */

/** @type {DataLoaderEntry[]} */
export const DATA_LOADERS = [
  { key: "cbeci",               file: FileAttachment("../data/cbeci.json"),                label: "CBECI" },
  { key: "ercot",               file: FileAttachment("../data/ercot.json"),                label: "ERCOT" },
  { key: "caiso",               file: FileAttachment("../data/caiso.json"),                label: "California ISO" },
  { key: "miso",                file: FileAttachment("../data/miso.json"),                 label: "MISO Midwest" },
  { key: "pjm",                 file: FileAttachment("../data/pjm.json"),                  label: "PJM" },
  { key: "spp",                 file: FileAttachment("../data/spp.json"),                  label: "SPP" },
  { key: "nyiso",               file: FileAttachment("../data/nyiso.json"),                label: "New York ISO" },
  { key: "isoNe",               file: FileAttachment("../data/iso-ne.json"),               label: "ISO New England" },
  { key: "bpa",                 file: FileAttachment("../data/bpa.json"),                  label: "Bonneville Power" },
  { key: "soco",                file: FileAttachment("../data/soco.json"),                 label: "Southern Company" },
  { key: "pacw",                file: FileAttachment("../data/pacw.json"),                 label: "PacifiCorp West" },
  { key: "pace",                file: FileAttachment("../data/pace.json"),                 label: "PacifiCorp East" },
  { key: "psco",                file: FileAttachment("../data/psco.json"),                 label: "Public Service Colorado" },
  { key: "azps",                file: FileAttachment("../data/azps.json"),                 label: "Arizona Public Service" },
  { key: "srp",                 file: FileAttachment("../data/srp.json"),                  label: "Salt River Project" },
  { key: "ipco",                file: FileAttachment("../data/ipco.json"),                 label: "Idaho Power" },
  { key: "tepc",                file: FileAttachment("../data/tepc.json"),                 label: "Tucson Electric Power" },
  { key: "entsoe",              file: FileAttachment("../data/entsoe.json"),               label: "ENTSO-E Europe" },
  { key: "germanyCurtailment",  file: FileAttachment("../data/germany-curtailment.json"),  label: "Germany curtailment" },
  { key: "aemo",                file: FileAttachment("../data/aemo.json"),                 label: "AEMO Australia" },
  { key: "aemoPerPlant",        file: FileAttachment("../data/aemo-per-plant.json"),       label: "AEMO Per-Plant" },
  { key: "belgium",             file: FileAttachment("../data/belgium.json"),              label: "Belgium" },
  { key: "france",              file: FileAttachment("../data/france.json"),               label: "France" },
  { key: "denmark",             file: FileAttachment("../data/denmark.json"),              label: "Denmark" },
  { key: "newZealand",          file: FileAttachment("../data/new-zealand.json"),          label: "New Zealand" },
  { key: "newZealandHydro",     file: FileAttachment("../data/new-zealand-hydro.json"),    label: "NZ Hydro" },
  { key: "norway",              file: FileAttachment("../data/norway.json"),               label: "Norway" },
  { key: "atacama",             file: FileAttachment("../data/atacama-chile.json"),        label: "Atacama Chile" },
  { key: "chileWind",           file: FileAttachment("../data/chile-wind.json"),           label: "Chile Wind" },
  { key: "statics",             file: FileAttachment("../data/statics.json"),              label: "Static regions" },
  { key: "anchor",              file: FileAttachment("../data/anchor.json"),               label: "Anchor data" },
  { key: "northSea",            file: FileAttachment("../data/north-sea.json"),            label: "North Sea" },
  { key: "brazilNE",            file: FileAttachment("../data/brazil-ne.json"),            label: "Brazil North-East" },
  { key: "ontario",             file: FileAttachment("../data/ontario.json"),              label: "Ontario" },
  { key: "alberta",             file: FileAttachment("../data/alberta.json"),              label: "Alberta" },
  { key: "ireland",             file: FileAttachment("../data/ireland.json"),              label: "Ireland" },
  { key: "peru",                file: FileAttachment("../data/peru.json"),                 label: "Peru" },
  { key: "peruPerPlant",        file: FileAttachment("../data/peru-per-plant.json"),       label: "Peru Per-Plant" },
  { key: "southAfrica",         file: FileAttachment("../data/south-africa.json"),         label: "South Africa" },
  { key: "argentina",           file: FileAttachment("../data/argentina.json"),            label: "Argentina" },
  { key: "uruguay",             file: FileAttachment("../data/uruguay.json"),              label: "Uruguay" },
  { key: "paraguay",            file: FileAttachment("../data/paraguay.json"),             label: "Paraguay" },
  { key: "mexico",              file: FileAttachment("../data/mexico.json"),               label: "Mexico" },
  { key: "japanChubu",          file: FileAttachment("../data/japan-chubu.json"),          label: "Japan Chubu" },
  { key: "japanChugoku",        file: FileAttachment("../data/japan-chugoku.json"),        label: "Japan Chugoku" },
  { key: "japanHokkaido",       file: FileAttachment("../data/japan-hokkaido.json"),       label: "Japan Hokkaido" },
  { key: "japanHokuriku",       file: FileAttachment("../data/japan-hokuriku.json"),       label: "Japan Hokuriku" },
  { key: "japanKansai",         file: FileAttachment("../data/japan-kansai.json"),         label: "Japan Kansai" },
  { key: "japanKyushu",         file: FileAttachment("../data/japan-kyushu.json"),         label: "Japan Kyushu" },
  { key: "japanOkinawa",        file: FileAttachment("../data/japan-okinawa.json"),        label: "Japan Okinawa" },
  { key: "japanShikoku",        file: FileAttachment("../data/japan-shikoku.json"),        label: "Japan Shikoku" },
  { key: "japanTepco",          file: FileAttachment("../data/japan-tepco.json"),          label: "Japan TEPCO" },
  { key: "japanTohoku",         file: FileAttachment("../data/japan-tohoku.json"),         label: "Japan Tohoku" },
  { key: "vietnam",             file: FileAttachment("../data/vietnam.json"),              label: "Vietnam" },
  { key: "thailand",            file: FileAttachment("../data/thailand.json"),             label: "Thailand" },
  { key: "indiaRajasthan",      file: FileAttachment("../data/india-rajasthan.json"),      label: "India Rajasthan" },
  { key: "cyprus",              file: FileAttachment("../data/cyprus.json"),               label: "Cyprus" },
  { key: "ethiopia",            file: FileAttachment("../data/ethiopia.json"),             label: "Ethiopia" },
  { key: "kazakhstan",          file: FileAttachment("../data/kazakhstan.json"),           label: "Kazakhstan" },
  { key: "honduras",            file: FileAttachment("../data/honduras.json"),             label: "Honduras" },
  { key: "jeju",                file: FileAttachment("../data/jeju.json"),                 label: "Jeju Island" },
  { key: "kenya",               file: FileAttachment("../data/kenya.json"),                label: "Kenya" },
  { key: "egypt",               file: FileAttachment("../data/egypt.json"),                label: "Egypt" },
  { key: "morocco",             file: FileAttachment("../data/morocco.json"),              label: "Morocco" },
  { key: "namibia",             file: FileAttachment("../data/namibia.json"),              label: "Namibia" },
  { key: "waSwis",              file: FileAttachment("../data/wa-swis.json"),              label: "WA SWIS" },
  { key: "ntPilbara",           file: FileAttachment("../data/nt-pilbara.json"),           label: "NT Pilbara" },
  { key: "indonesia",           file: FileAttachment("../data/indonesia.json"),            label: "Indonesia" },
  { key: "malaysia",            file: FileAttachment("../data/malaysia.json"),             label: "Malaysia" },
  { key: "philippines",         file: FileAttachment("../data/philippines.json"),          label: "Philippines" },
  { key: "southKorea",          file: FileAttachment("../data/south-korea.json"),          label: "South Korea" },
  { key: "russiaMainland",      file: FileAttachment("../data/russia-mainland.json"),      label: "Russia" },
  { key: "taiwan",              file: FileAttachment("../data/taiwan.json"),               label: "Taiwan" },
  { key: "jordan",              file: FileAttachment("../data/jordan.json"),               label: "Jordan" },
  { key: "saudiSolar",          file: FileAttachment("../data/saudi-solar.json"),          label: "Saudi Arabia" },
  { key: "uae",                 file: FileAttachment("../data/uae.json"),                  label: "UAE" },
  { key: "oman",                file: FileAttachment("../data/oman.json"),                 label: "Oman" },
  { key: "israel",              file: FileAttachment("../data/israel.json"),               label: "Israel" },
  { key: "innerMongolia",       file: FileAttachment("../data/inner-mongolia.json"),       label: "Inner Mongolia" },
  { key: "gansu",               file: FileAttachment("../data/gansu.json"),                label: "Gansu" },
  { key: "qinghai",             file: FileAttachment("../data/qinghai.json"),              label: "Qinghai" },
  { key: "ningxia",             file: FileAttachment("../data/ningxia.json"),              label: "Ningxia" },
  { key: "yunnan",              file: FileAttachment("../data/yunnan.json"),               label: "Yunnan" },
  { key: "tibet",               file: FileAttachment("../data/tibet.json"),                label: "Tibet" },
  { key: "indiaGujarat",        file: FileAttachment("../data/india-gujarat.json"),        label: "India Gujarat" },
  { key: "indiaTamilNadu",      file: FileAttachment("../data/india-tamil-nadu.json"),     label: "India Tamil Nadu" },
  { key: "indiaKarnataka",      file: FileAttachment("../data/india-karnataka.json"),      label: "India Karnataka" },
  { key: "indiaAndhraPradesh",  file: FileAttachment("../data/india-andhra-pradesh.json"), label: "India Andhra Pradesh" },
  { key: "indiaMaharashtra",    file: FileAttachment("../data/india-maharashtra.json"),    label: "India Maharashtra" },
  { key: "indiaEast",           file: FileAttachment("../data/india-east.json"),           label: "India East" },
  { key: "indiaMadhyaPradesh",  file: FileAttachment("../data/india-madhya-pradesh.json"), label: "India Madhya Pradesh" },
  { key: "indiaTelangana",      file: FileAttachment("../data/india-telangana.json"),      label: "India Telangana" },
  { key: "indiaUttarPradesh",   file: FileAttachment("../data/india-uttar-pradesh.json"),  label: "India Uttar Pradesh" },
  { key: "indiaPunjab",         file: FileAttachment("../data/india-punjab.json"),         label: "India Punjab" },
  { key: "indiaOdisha",         file: FileAttachment("../data/india-odisha.json"),         label: "India Odisha" },
  { key: "indiaChhattisgarh",   file: FileAttachment("../data/india-chhattisgarh.json"),   label: "India Chhattisgarh" },
  { key: "pakistan",            file: FileAttachment("../data/pakistan.json"),             label: "Pakistan" },
  { key: "iran",                file: FileAttachment("../data/iran.json"),                 label: "Iran" },
  { key: "iraqMainland",        file: FileAttachment("../data/iraq-mainland.json"),        label: "Iraq" },
  { key: "kurdistan",           file: FileAttachment("../data/kurdistan.json"),            label: "Kurdistan" },
  { key: "bangladesh",          file: FileAttachment("../data/bangladesh.json"),           label: "Bangladesh" },
  { key: "mongolia",            file: FileAttachment("../data/mongolia.json"),             label: "Mongolia" },
  { key: "britishColumbia",     file: FileAttachment("../data/british-columbia.json"),     label: "British Columbia" },
  { key: "quebec",              file: FileAttachment("../data/quebec.json"),               label: "Québec" },
  { key: "manitoba",            file: FileAttachment("../data/manitoba.json"),             label: "Manitoba" },
  { key: "saskatchewan",        file: FileAttachment("../data/saskatchewan.json"),         label: "Saskatchewan" },
  { key: "turkey",              file: FileAttachment("../data/turkey.json"),               label: "Turkey" },
  { key: "colombia",            file: FileAttachment("../data/colombia.json"),             label: "Colombia" },
  { key: "florida",             file: FileAttachment("../data/florida.json"),              label: "Florida" },
  { key: "chinaShandong",       file: FileAttachment("../data/china-shandong.json"),       label: "China Shandong" },
  { key: "chinaGuangdong",      file: FileAttachment("../data/china-guangdong.json"),      label: "China Guangdong" },
  { key: "chinaJiangsu",        file: FileAttachment("../data/china-jiangsu.json"),        label: "China Jiangsu" },
  { key: "chinaAnhui",          file: FileAttachment("../data/china-anhui.json"),          label: "China Anhui" },
  { key: "chinaHunan",          file: FileAttachment("../data/china-hunan.json"),          label: "China Hunan" },
  { key: "chinaLiaoning",       file: FileAttachment("../data/china-liaoning.json"),       label: "China Liaoning" },
  { key: "chinaHubei",          file: FileAttachment("../data/china-hubei.json"),          label: "China Hubei" },
  { key: "chinaShanxi",         file: FileAttachment("../data/china-shanxi.json"),         label: "China Shanxi" },
  { key: "chinaShaanxi",        file: FileAttachment("../data/china-shaanxi.json"),        label: "China Shaanxi" },
  { key: "chinaZhejiang",       file: FileAttachment("../data/china-zhejiang.json"),       label: "China Zhejiang" },
  { key: "chinaHenan",          file: FileAttachment("../data/china-henan.json"),          label: "China Henan" },
  { key: "chinaFujian",         file: FileAttachment("../data/china-fujian.json"),         label: "China Fujian" },
  { key: "chinaJiangxi",        file: FileAttachment("../data/china-jiangxi.json"),        label: "China Jiangxi" },
  { key: "chinaBeijing",        file: FileAttachment("../data/china-beijing.json"),        label: "China Beijing" },
  { key: "chinaGuizhou",        file: FileAttachment("../data/china-guizhou.json"),        label: "China Guizhou" },
  { key: "chinaChongqing",      file: FileAttachment("../data/china-chongqing.json"),      label: "China Chongqing" },
  { key: "chinaTianjin",        file: FileAttachment("../data/china-tianjin.json"),        label: "China Tianjin" },
  { key: "chinaHainan",         file: FileAttachment("../data/china-hainan.json"),         label: "China Hainan" },
  { key: "chinaShanghai",       file: FileAttachment("../data/china-shanghai.json"),       label: "China Shanghai" },
  { key: "chinaHebei",          file: FileAttachment("../data/china-hebei.json"),          label: "China Hebei" },
  { key: "chinaHeilongjiang",   file: FileAttachment("../data/china-heilongjiang.json"),   label: "China Heilongjiang" },
  { key: "chinaJilin",          file: FileAttachment("../data/china-jilin.json"),          label: "China Jilin" },
  { key: "xinjiang",            file: FileAttachment("../data/xinjiang.json"),             label: "Xinjiang" },
  { key: "sichuan",             file: FileAttachment("../data/sichuan.json"),              label: "Sichuan" },
  { key: "guangxi",             file: FileAttachment("../data/guangxi.json"),              label: "Guangxi" },
  { key: "zenodoVersion",       file: FileAttachment("../data/zenodo-version.json"),       label: "Version metadata", embed: false },
];

/**
 * The subset `/embed/globe` loads: everything except the entries flagged
 * `embed: false`. Derived, not hand-maintained, so the embed cannot silently
 * fall behind the dashboard.
 *
 * @type {DataLoaderEntry[]}
 */
export const EMBED_DATA_LOADERS = DATA_LOADERS.filter((entry) => entry.embed !== false);

/**
 * Fetch every entry in parallel and return a record keyed by `entry.key`.
 *
 * Each key travels with its own payload through the whole pipeline — there is
 * no second list to line up against — so the #203 rotation is not
 * representable here either. `entry.file.json()` is called synchronously
 * before the first `await`, so the fetches overlap exactly as the old
 * `Promise.all([...])` did; HTTP/2 multiplexes them.
 *
 * @param {DataLoaderEntry[]} entries
 * @param {(promise: Promise<any>, label: string) => Promise<any>} [wrap]
 *   Optional per-file wrapper. The dashboard passes `trackFile` from
 *   `components/loader-progress.js` so the loading terminal advances as each
 *   source resolves; the embed has no terminal and passes nothing.
 * @returns {Promise<Record<string, any>>}
 */
export async function loadDataFiles(entries, wrap) {
  const pending = entries.map(async (entry) => {
    const promise = entry.file.json();
    return [entry.key, await (wrap ? wrap(promise, entry.label) : promise)];
  });
  return Object.fromEntries(await Promise.all(pending));
}
