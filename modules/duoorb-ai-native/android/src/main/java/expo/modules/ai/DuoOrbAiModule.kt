package expo.modules.ai

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class DuoOrbAiModule : Module() {
  private val scope = CoroutineScope(Dispatchers.Default)

  override fun definition() = ModuleDefinition {
    Name("DuoOrbAi")

    AsyncFunction("getBestAction") { stateJson: String, simulations: Int, threads: Int, promise: Promise ->
      scope.launch {
        try {
          val action = DuoOrbNativeBridge.findBestAction(stateJson, simulations, threads)
          promise.resolve(action)
        } catch (e: Throwable) {
          android.util.Log.e("DuoOrbAi", "getBestAction error: " + e.message, e)
          promise.resolve(null)
        }
      }
    }

    AsyncFunction("getRankedActions") { stateJson: String, simulations: Int, threads: Int, topK: Int, promise: Promise ->
      scope.launch {
        try {
          val ranked = DuoOrbNativeBridge.findRankedActions(stateJson, simulations, threads, topK)
          promise.resolve(ranked)
        } catch (e: Throwable) {
          android.util.Log.e("DuoOrbAi", "getRankedActions error: " + e.message, e)
          promise.resolve(null)
        }
      }
    }

    AsyncFunction("getBotAction") { stateJson: String, botId: String?, seed: Long?, promise: Promise ->
      scope.launch {
        try {
          val action = DuoOrbNativeBridge.getBotAction(stateJson, botId, seed ?: 0L)
          promise.resolve(action)
        } catch (e: Throwable) {
          android.util.Log.e("DuoOrbAi", "getBotAction error: " + e.message, e)
          promise.resolve(null)
        }
      }
    }

    AsyncFunction("getHint") { stateJson: String, promise: Promise ->
      scope.launch {
        try {
          val hint = DuoOrbNativeBridge.getHint(stateJson)
          promise.resolve(hint)
        } catch (e: Throwable) {
          android.util.Log.e("DuoOrbAi", "getHint error: " + e.message, e)
          promise.resolve(null)
        }
      }
    }

    AsyncFunction("analyzeGame") { initialStateJson: String, historyJson: String, promise: Promise ->
      scope.launch {
        try {
          val review = DuoOrbNativeBridge.analyzeGame(initialStateJson, historyJson)
          promise.resolve(review)
        } catch (e: Throwable) {
          android.util.Log.e("DuoOrbAi", "analyzeGame error: " + e.message, e)
          promise.resolve(null)
        }
      }
    }

    AsyncFunction("isNeuralLoaded") { promise: Promise ->
      scope.launch {
        try {
          promise.resolve(DuoOrbNativeBridge.isNeuralLoaded())
        } catch (e: Throwable) {
          android.util.Log.e("DuoOrbAi", "isNeuralLoaded error: " + e.message, e)
          promise.resolve(false)
        }
      }
    }
  }
}

object DuoOrbNativeBridge {
  init {
    try {
      System.loadLibrary("duoorb_analyzer")
      android.util.Log.i("DuoOrbAi", "Successfully loaded libduoorb_analyzer.so")
    } catch (e: Throwable) {
      android.util.Log.e("DuoOrbAi", "Failed to load duoorb_analyzer: " + e.message, e)
    }
    try {
      System.loadLibrary("duoorb_ai")
      android.util.Log.i("DuoOrbAi", "Successfully loaded libduoorb_ai.so")
    } catch (e: Throwable) {
      android.util.Log.e("DuoOrbAi", "Failed to load duoorb_ai: " + e.message, e)
    }
    Thread {
      try {
        val loaded = isNeuralLoaded()
        android.util.Log.i("DuoOrbAi", "Embedded ONNX AlphaZero neural evaluator loaded: $loaded")
      } catch (e: Throwable) {
        android.util.Log.e("DuoOrbAi", "Failed to pre-warm ONNX neural evaluator: " + e.message, e)
      }
    }.start()
  }

  fun findBestAction(stateJson: String, simulations: Int, threads: Int): String? {
    return try {
      nativeFindBestAction(stateJson, simulations, threads)
    } catch (e: Throwable) {
      android.util.Log.e("DuoOrbAi", "nativeFindBestAction error: " + e.message, e)
      null
    }
  }

  fun findRankedActions(stateJson: String, simulations: Int, threads: Int, topK: Int): String? {
    return try {
      nativeFindRankedActions(stateJson, simulations, threads, topK)
    } catch (e: Throwable) {
      android.util.Log.e("DuoOrbAi", "nativeFindRankedActions error: " + e.message, e)
      null
    }
  }

  fun getBotAction(stateJson: String, botId: String?, seed: Long): String? {
    return try {
      val res = nativeGetBotAction(stateJson, botId, seed)
      if (res == null) {
        android.util.Log.w("DuoOrbAi", "nativeGetBotAction returned null for bot: " + botId)
      }
      res
    } catch (e: Throwable) {
      android.util.Log.e("DuoOrbAi", "nativeGetBotAction exception for bot " + botId + ": " + e.message, e)
      null
    }
  }

  fun getHint(stateJson: String): String? {
    return try {
      nativeGetHint(stateJson)
    } catch (e: Throwable) {
      android.util.Log.e("DuoOrbAi", "nativeGetHint error: " + e.message, e)
      null
    }
  }

  fun analyzeGame(initialStateJson: String, historyJson: String): String? {
    return try {
      val res = nativeAnalyzeGame(initialStateJson, historyJson)
      if (res == null) {
        android.util.Log.w("DuoOrbAi", "nativeAnalyzeGame returned null")
      }
      res
    } catch (e: Throwable) {
      android.util.Log.e("DuoOrbAi", "nativeAnalyzeGame error: " + e.message, e)
      null
    }
  }

  fun isNeuralLoaded(): Boolean {
    return try {
      nativeIsNeuralLoaded()
    } catch (e: Throwable) {
      android.util.Log.e("DuoOrbAi", "nativeIsNeuralLoaded error: " + e.message, e)
      false
    }
  }

  private external fun nativeFindBestAction(stateJson: String, simulations: Int, threads: Int): String?
  private external fun nativeFindRankedActions(stateJson: String, simulations: Int, threads: Int, topK: Int): String?
  private external fun nativeGetBotAction(stateJson: String, botId: String?, seed: Long): String?
  private external fun nativeGetHint(stateJson: String): String?
  private external fun nativeAnalyzeGame(initialStateJson: String, historyJson: String): String?
  private external fun nativeIsNeuralLoaded(): Boolean
}