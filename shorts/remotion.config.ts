/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import fs from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

// En las sesiones de Claude en la nube no se puede descargar el navegador de
// Remotion, así que se usa el que ya viene instalado. En una computadora
// normal ese archivo no existe y Remotion descarga el suyo.
const navegadorNube =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (fs.existsSync(navegadorNube)) {
  Config.setBrowserExecutable(navegadorNube);
}
