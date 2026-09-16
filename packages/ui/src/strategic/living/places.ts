/** Living-map geography: named places, routes and lines (schematic — drawn for
 *  a situation display, not survey data). Positions are [lon, lat]. */

import type { LonLat } from "../geo";

export const P = {
  // Israeli cities and communities
  tel_aviv: [34.78, 32.08], jerusalem: [35.21, 31.77], haifa: [34.99, 32.79], beersheba: [34.79, 31.25],
  ashdod: [34.65, 31.8], ashkelon: [34.57, 31.67], netanya: [34.86, 32.33], afula: [35.29, 32.61],
  eilat: [34.95, 29.56], dimona: [35.03, 31.07], sderot: [34.596, 31.525], kfar_aza: [34.535, 31.485],
  nahal_oz: [34.5, 31.47], netivot: [34.59, 31.42], kiryat_shmona: [35.57, 33.21], metula: [35.58, 33.28],
  nahariya: [35.1, 33.005], shlomi: [35.145, 33.075], kfar_saba: [34.91, 32.18], bnei_brak: [34.83, 32.09],
  kaplan: [34.786, 32.072], knesset: [35.205, 31.777], tel_nof: [34.82, 31.84], dead_sea_works: [35.39, 31.05],
  // bases, batteries, ports, crossings
  ben_gurion: [34.886, 32.009], nevatim: [35.01, 31.21], hatzerim: [34.66, 31.23], ramat_david: [35.18, 32.66],
  palmachim: [34.69, 31.9], haifa_port: [35.0, 32.82], ashdod_port: [34.64, 31.83], eilat_port: [34.96, 29.54],
  dome_south: [34.62, 31.55], dome_gushdan: [34.86, 32.02], dome_north: [35.28, 32.95], dome_negev: [34.72, 31.38],
  arrow: [34.92, 31.85], sling: [35.08, 32.72],
  kerem_shalom: [34.27, 31.23], erez: [34.52, 31.56], rafah_crossing: [34.24, 31.28], allenby: [35.54, 31.87],
  gaza_staging: [34.62, 31.4], north_staging: [35.33, 32.97], wb_staging: [35.0, 32.36], center_staging: [34.95, 31.95],
  // Gaza
  gaza_city: [34.455, 31.515], jabalia: [34.49, 31.535], deir_balah: [34.35, 31.415], khan_younis: [34.305, 31.345],
  rafah: [34.25, 31.29], gaza_port: [34.44, 31.525],
  // West Bank
  jenin: [35.3, 32.46], nablus: [35.26, 32.22], tulkarm: [35.03, 32.31], qalqilya: [34.97, 32.19], ramallah: [35.2, 31.9],
  hebron: [35.1, 31.53], bethlehem: [35.2, 31.7], jericho: [35.45, 31.86],
  ariel: [35.17, 32.1], maale_adumim: [35.3, 31.78], efrat: [35.15, 31.65], kiryat_arba: [35.12, 31.53],
  beit_el: [35.22, 31.94], shilo: [35.29, 32.05], itamar: [35.34, 32.17], huwara: [35.26, 32.15], turmus_ayya: [35.28, 32.03],
  // Lebanon / Syria / Jordan / Egypt
  tyre: [35.2, 33.27], nabatieh: [35.48, 33.38], bint_jbeil: [35.43, 33.12], dahiya: [35.5, 33.85], litani: [35.35, 33.33],
  amman: [35.93, 31.95], cairo: [31.24, 30.04], ismailia: [32.27, 30.6], suez: [32.55, 29.97], el_arish: [33.8, 31.13],
  // further out
  hodeidah: [42.95, 14.8], sanaa: [44.2, 15.35], bab_el_mandeb: [43.35, 12.6], tehran: [51.39, 35.69], isfahan: [51.67, 32.65],
  kermanshah: [47.07, 34.31], natanz: [51.73, 33.72], kharg: [50.32, 29.24], abadan: [48.3, 30.35], riyadh: [46.72, 24.71],
  abu_dhabi: [54.37, 24.45], doha: [51.53, 25.29], ankara: [32.85, 39.93], washington: [-77.04, 38.9], new_york: [-74.0, 40.7],
  brussels: [4.35, 50.85], the_hague: [4.3, 52.08], paris: [2.35, 48.86], london: [-0.13, 51.5], berlin: [13.4, 52.52],
  budapest: [19.04, 47.5], prague: [14.42, 50.08], beirut: [35.5, 33.89], moscow: [37.62, 55.75], beijing: [116.4, 39.9],
  // sea
  east_med: [33.2, 33.4], red_sea_south: [42.2, 15.2], med_west: [24.0, 33.6],
} satisfies Record<string, LonLat>;

export type PlaceId = keyof typeof P;
export const at = (id: PlaceId): LonLat => P[id];

/** West Bank separation barrier, including the Jerusalem envelope. */
export const BARRIER: LonLat[] = [
  [35.52, 32.4], [35.4, 32.5], [35.3, 32.53], [35.18, 32.5], [35.07, 32.44], [35.02, 32.38], [34.99, 32.3], [34.98, 32.2],
  [35.02, 32.12], [35.05, 32.03], [35.02, 31.95], [35.05, 31.88], [35.13, 31.86], [35.22, 31.88], [35.3, 31.83], [35.28, 31.74],
  [35.2, 31.7], [35.12, 31.66], [35.05, 31.58], [34.97, 31.5], [34.93, 31.42], [35.0, 31.37], [35.15, 31.37], [35.3, 31.4], [35.45, 31.49],
];
export const GAZA_FENCE: LonLat[] = [[34.27, 31.22], [34.4, 31.34], [34.53, 31.5], [34.565, 31.55], [34.49, 31.595]];
export const LEBANON_BORDER: LonLat[] = [[35.1, 33.09], [35.35, 33.07], [35.5, 33.09], [35.57, 33.27]];
export const EGYPT_BORDER: LonLat[] = [[34.27, 31.22], [34.4, 30.85], [34.55, 30.4], [34.73, 29.9], [34.9, 29.49]];
export const SUEZ: LonLat[] = [[32.35, 31.25], [32.32, 30.85], [32.27, 30.6], [32.4, 30.3], [32.55, 29.95]];

export const KINNERET: LonLat[] = [[35.53, 32.84], [35.57, 32.89], [35.62, 32.885], [35.65, 32.84], [35.645, 32.76], [35.62, 32.71], [35.58, 32.71], [35.55, 32.76]];
export const DEAD_SEA: LonLat[] = [[35.47, 31.77], [35.55, 31.76], [35.58, 31.6], [35.56, 31.45], [35.5, 31.28], [35.43, 31.13], [35.39, 31.2], [35.4, 31.4], [35.43, 31.58]];

/** Water carrier from the Kinneret area to Amman (the treaty water deliveries), schematic. */
export const WATER_PIPE: LonLat[] = [[35.57, 32.7], [35.62, 32.5], [35.75, 32.25], [35.93, 31.95]];

export const RIGS: LonLat[] = [[34.83, 32.6], [34.44, 31.71], [34.2, 33.05]];

export const SEA_LANES = {
  haifa: [[24.0, 34.2], [31.5, 33.4], [34.2, 33.0], [35.0, 32.83]] as LonLat[],
  ashdod: [[24.0, 32.9], [31.0, 32.3], [34.2, 31.95], [34.64, 31.83]] as LonLat[],
  red: [[43.35, 12.7], [42.4, 14.6], [40.6, 17.5], [38.9, 20.3], [37.4, 23.0], [35.6, 26.2], [34.9, 27.5], [34.48, 28.05], [34.62, 28.6], [34.85, 29.2], [34.96, 29.52]] as LonLat[],
};

export const AIR_ROUTES = {
  europe: [[34.886, 32.009], [34.35, 32.15], [31.5, 33.5], [25, 37.5], [14, 42], [2, 48.5]] as LonLat[],
  usa: [[34.886, 32.009], [34.3, 32.05], [30, 33.8], [18, 38], [-6, 43], [-40, 45]] as LonLat[],
  north: [[34.886, 32.009], [34.4, 32.3], [32.5, 34.5], [28.5, 40], [20, 47], [13, 52.5]] as LonLat[],
};

/** Israeli settlements shown as small red-roofed clusters. */
export const SETTLEMENTS: PlaceId[] = ["ariel", "maale_adumim", "efrat", "kiryat_arba", "beit_el", "shilo", "itamar"];
/** Extra hilltop outposts that appear with de-facto / legal annexation. */
export const OUTPOSTS: LonLat[] = [[35.24, 32.08], [35.36, 32.0], [35.18, 31.6], [35.33, 31.93], [35.07, 32.2], [35.25, 32.3], [35.14, 31.47], [35.4, 31.7]];
/** Palestinian towns (for villages and raids). */
export const PAL_TOWNS: PlaceId[] = ["jenin", "nablus", "tulkarm", "qalqilya", "ramallah", "hebron", "bethlehem", "huwara", "turmus_ayya"];

/** Area C, very schematically: the West Bank minus its city islands. */
export const AREA_C: LonLat[][] = [
  [[35.52, 32.38], [35.4, 32.48], [35.34, 32.36], [35.42, 32.2], [35.52, 32.1]],
  [[35.52, 32.0], [35.38, 31.98], [35.34, 31.82], [35.46, 31.6], [35.52, 31.75]],
  [[35.2, 31.62], [35.35, 31.5], [35.45, 31.49], [35.3, 31.4], [35.05, 31.38], [35.0, 31.5]],
  [[35.08, 32.42], [35.14, 32.3], [35.1, 32.14], [35.03, 32.2], [35.0, 32.33]],
];
