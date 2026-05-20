import assert from 'node:assert/strict'
import test from 'node:test'

import config from '../src/config.js'
import { KIM_NWP_CRON_OPTIONS, buildInitialCollectionJobs, scheduleKimNwpJob } from '../src/index.js'

test('KIM NWP scheduler uses UTC for synoptic release retry windows', () => {
  const calls = []
  const fakeScheduler = {
    schedule: (...args) => {
      calls.push(args)
      return { stop() {} }
    },
  }

  scheduleKimNwpJob(fakeScheduler)

  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], config.schedule.kim_surface_wind_interval)
  assert.equal(typeof calls[0][1], 'function')
  assert.deepEqual(calls[0][2], KIM_NWP_CRON_OPTIONS)
  assert.deepEqual(KIM_NWP_CRON_OPTIONS, { timezone: 'Etc/UTC' })
})

test('initial collection can omit KIM NWP for low-resource startup', () => {
  assert.equal(
    buildInitialCollectionJobs({ includeKimNwp: false }).some(([type]) => type === 'kim_surface_wind'),
    false,
  )
  assert.equal(
    buildInitialCollectionJobs({ includeKimNwp: true }).some(([type]) => type === 'kim_surface_wind'),
    true,
  )
})
