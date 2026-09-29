package expo.modules.sfx

import android.media.AudioAttributes
import android.media.SoundPool
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * DuoOrb game SFX on Android: a single SoundPool holding every short effect
 * pre-decoded in memory.
 *
 * Why SoundPool and not ExoPlayer/MediaPlayer: SoundPool is built for exactly
 * this — short clips, decoded once, played on N concurrent streams with
 * hardware mixing. A repeated event starts a NEW stream; the previous one is
 * never seeked, restarted, or cut. Rapid fire is absorbed by the mixer, not
 * serialized in JS.
 *
 * maxStreams = 6: enough for a move + wall + notify + goal tail overlapping
 * with headroom, small enough that a pathological burst degrades by evicting
 * the oldest stream (all priorities equal) rather than allocating unboundedly.
 *
 * AudioAttributes are USAGE_GAME / CONTENT_TYPE_SONIFICATION: game/UI sounds
 * on the music stream. No voice-call usage (never the earpiece), no record
 * usage, no background-audio flags.
 */
class DuoOrbSfxModule : Module() {
  private var pool: SoundPool? = null
  private val soundIds = mutableMapOf<String, Int>()
  private val loadedIds = mutableSetOf<Int>()
  private val lock = Any()
  @Volatile private var muted = false
  @Volatile private var ready = false
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("DuoOrbSfx")

    OnDestroy {
      releasePool()
    }

    /**
     * Preloads every sound and resolves true only when ALL native loads
     * completed. A 10s safety timeout resolves false rather than hanging the
     * JS init promise forever.
     */
    AsyncFunction("loadSounds") { sounds: Map<String, String>, promise: Promise ->
      try {
        releasePool()
        synchronized(lock) {
          soundIds.clear()
          loadedIds.clear()
        }
        ready = false

        val attributes = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_GAME)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
        val sp = SoundPool.Builder()
          .setMaxStreams(MAX_STREAMS)
          .setAudioAttributes(attributes)
          .build()
        pool = sp

        if (sounds.isEmpty()) {
          ready = true
          promise.resolve(true)
          return@AsyncFunction
        }

        val settled = AtomicBoolean(false)
        val remaining = AtomicInteger(sounds.size)
        fun settle(value: Boolean) {
          if (settled.compareAndSet(false, true)) {
            ready = value
            promise.resolve(value)
          }
        }

        sp.setOnLoadCompleteListener { _, sampleId, status ->
          if (status == 0) {
            synchronized(lock) { loadedIds.add(sampleId) }
          }
          if (remaining.decrementAndGet() == 0) {
            val count = synchronized(lock) { loadedIds.size }
            settle(count == sounds.size)
          }
        }

        for ((name, uri) in sounds) {
          val path = uri.removePrefix("file://")
          val id = sp.load(path, 1)
          synchronized(lock) { soundIds[name] = id }
        }

        mainHandler.postDelayed({ settle(false) }, LOAD_TIMEOUT_MS)
      } catch (e: Exception) {
        releasePool()
        promise.reject("SFX_INIT_FAILED", e.message ?: "SoundPool init failed", e)
      }
    }

    /**
     * One new native stream per call. Never seeks, never restarts an active
     * stream, never queues. Unknown or not-yet-loaded names are dropped
     * silently — a missing blip is always preferable to a gameplay hitch.
     */
    Function("playSound") { name: String ->
      if (muted) return@Function
      val sp = pool ?: return@Function
      val id = synchronized(lock) { soundIds[name] } ?: return@Function
      val loaded = synchronized(lock) { loadedIds.contains(id) }
      if (!loaded) return@Function
      sp.play(id, 1.0f, 1.0f, 1, 0, 1.0f)
    }

    /**
     * Gates future plays. In-flight tails (every DuoOrb clip is <=0.7s)
     * decay naturally instead of being cut — identical on both platforms,
     * with no paused-stream bookkeeping that could strand pool slots.
     */
    Function("setNativeMuted") { value: Boolean ->
      muted = value
    }

    Function("releaseSounds") {
      releasePool()
    }

    Function("isNativeReady") {
      return@Function ready
    }
  }

  private fun releasePool() {
    ready = false
    try {
      pool?.release()
    } catch (_: Exception) {
      // Releasing twice or mid-load must never crash the app.
    }
    pool = null
    synchronized(lock) {
      soundIds.clear()
      loadedIds.clear()
    }
  }

  companion object {
    private const val MAX_STREAMS = 6
    private const val LOAD_TIMEOUT_MS = 10_000L
  }
}
