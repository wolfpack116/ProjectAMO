import cron from 'node-cron'
import config from './config.js'
import store from './store.js'
import stats from './stats.js'
import metarProcessor from './processors/metar-processor.js'
import tafProcessor from './processors/taf-processor.js'
import warningProcessor from './processors/warning-processor.js'
import sigmetProcessor from './processors/sigmet-processor.js'
import airmetProcessor from './processors/airmet-processor.js'
import sigwxLowProcessor from './processors/sigwx-low-processor.js'
import amosProcessor from './processors/amos-processor.js'
import lightningProcessor from './processors/lightning-processor.js'
import radarEchoProcessor from './processors/radar-echo-processor.js'
import kimSurfaceWindProcessor from './processors/kim-surface-wind-processor.js'
import satelliteProcessor from './processors/satellite-processor.js'
import groundForecastProcessor from './processors/ground-forecast-processor.js'
import environmentProcessor from './processors/environment-processor.js'
import airportInfoProcessor from './processors/airport-info-processor.js'

const locks = { metar: false, taf: false, warning: false, sigmet: false, airmet: false, sigwx_low: false, amos: false, lightning: false, radar_echo: false, kim_surface_wind: false, satellite: false, ground_forecast: false, environment: false, airport_info: false };
const KIM_NWP_CRON_OPTIONS = { timezone: 'Etc/UTC' }
const AIRPORT_INFO_CRON_OPTIONS = { timezone: 'Asia/Seoul' }

async function runWithLock(type, job) {
  if (locks[type]) {
    console.warn(`${type}: skipped (already running)`);
    return;
  }

  locks[type] = true;
  try {
    const result = await job();
    console.log(`[${new Date().toISOString()}] ${type}:`, result);
    stats.recordSuccess(type, result);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ${type} failed:`, error.message);
    stats.recordFailure(type, error.message);
  } finally {
    locks[type] = false;
  }
}

function scheduleKimNwpJob(scheduler = cron) {
  return scheduler.schedule(
    config.schedule.kim_surface_wind_interval,
    () => runWithLock("kim_surface_wind", kimSurfaceWindProcessor.process),
    KIM_NWP_CRON_OPTIONS,
  )
}

function scheduleAirportInfoJob(scheduler = cron) {
  return scheduler.schedule(
    config.schedule.airport_info_interval,
    () => runWithLock("airport_info", airportInfoProcessor.process),
    AIRPORT_INFO_CRON_OPTIONS,
  )
}

function buildInitialCollectionJobs({ includeKimNwp = config.kim_nwp?.collect_on_startup !== false } = {}) {
  const jobs = [
    ["metar", metarProcessor.processAll],
    ["taf", tafProcessor.processAll],
    ["warning", warningProcessor.process],
    ["sigmet", sigmetProcessor.process],
    ["airmet", airmetProcessor.process],
    ["sigwx_low", sigwxLowProcessor.process],
    ["amos", amosProcessor.process],
    ["lightning", lightningProcessor.process],
    ["radar_echo", radarEchoProcessor.process],
    ["satellite", satelliteProcessor.process],
    ["ground_forecast", groundForecastProcessor.process],
    ["environment", environmentProcessor.process],
    ["airport_info", airportInfoProcessor.process],
  ]
  if (includeKimNwp) jobs.splice(10, 0, ["kim_surface_wind", kimSurfaceWindProcessor.process])
  return jobs
}

async function main() {
  store.ensureDirectories(config.storage.base_path);
  store.initFromFiles(config.storage.base_path);
  stats.initFromFile(config.storage.base_path);

  console.log("Scheduler started");

  cron.schedule(config.schedule.metar_interval, () => runWithLock("metar", metarProcessor.processAll));
  cron.schedule(config.schedule.taf_interval, () => runWithLock("taf", tafProcessor.processAll));
  cron.schedule(config.schedule.warning_interval, () => runWithLock("warning", warningProcessor.process));
  cron.schedule(config.schedule.sigmet_interval, () => runWithLock("sigmet", sigmetProcessor.process));
  cron.schedule(config.schedule.airmet_interval, () => runWithLock("airmet", airmetProcessor.process));
  cron.schedule(config.schedule.sigwx_low_interval, () => runWithLock("sigwx_low", sigwxLowProcessor.process));
  cron.schedule(config.schedule.amos_interval, () => runWithLock("amos", amosProcessor.process));
  cron.schedule(config.schedule.lightning_interval, () => runWithLock("lightning", lightningProcessor.process));
  cron.schedule(config.schedule.radar_echo_interval, () => runWithLock("radar_echo", radarEchoProcessor.process));
  scheduleKimNwpJob();
  cron.schedule(config.schedule.satellite_interval, () => runWithLock("satellite", satelliteProcessor.process));
  cron.schedule(config.schedule.ground_forecast_interval, () => runWithLock("ground_forecast", groundForecastProcessor.process));
  cron.schedule(config.schedule.environment_interval, () => runWithLock("environment", environmentProcessor.process));
  scheduleAirportInfoJob();

  // 서버 시작 직후 1회 즉시 수집
  console.log("Running initial data collection...");
  await Promise.allSettled(
    buildInitialCollectionJobs().map(([type, job]) => runWithLock(type, job)),
  );
  console.log("Initial data collection complete.");
}

const __filename = new URL(import.meta.url).pathname
if (process.argv[1] && (__filename === process.argv[1] || __filename.endsWith(process.argv[1]))) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { AIRPORT_INFO_CRON_OPTIONS, KIM_NWP_CRON_OPTIONS, buildInitialCollectionJobs, main, runWithLock, scheduleAirportInfoJob, scheduleKimNwpJob }
export default { AIRPORT_INFO_CRON_OPTIONS, KIM_NWP_CRON_OPTIONS, buildInitialCollectionJobs, main, runWithLock, scheduleAirportInfoJob, scheduleKimNwpJob }
