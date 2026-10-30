#include <jni.h>
#include <string>

extern "C" {
    char* duoorb_ai_find_best_action(const char* state_json, uint32_t simulations, uint32_t threads, int64_t seed);
    char* duoorb_ai_find_ranked_actions(const char* state_json, uint32_t simulations, uint32_t threads, int64_t seed, uint32_t top_k);
    char* duoorb_ai_get_bot_action(const char* state_json, const char* bot_id, int64_t seed);
    char* duoorb_ai_get_hint(const char* state_json);
    char* duoorb_ai_analyze_game(const char* initial_state_json, const char* history_json);
    void duoorb_ai_free_string(char* ptr);

    JNIEXPORT jstring JNICALL
    Java_expo_modules_ai_DuoOrbNativeBridge_nativeFindBestAction(
        JNIEnv* env,
        jobject /* this */,
        jstring stateJson,
        jint simulations,
        jint threads
    ) {
        if (!stateJson) return nullptr;
        const char* nativeState = env->GetStringUTFChars(stateJson, nullptr);
        char* result = duoorb_ai_find_best_action(nativeState, (uint32_t)simulations, (uint32_t)threads, 0);
        env->ReleaseStringUTFChars(stateJson, nativeState);

        if (!result) return nullptr;
        jstring jresult = env->NewStringUTF(result);
        duoorb_ai_free_string(result);
        return jresult;
    }

    JNIEXPORT jstring JNICALL
    Java_expo_modules_ai_DuoOrbNativeBridge_nativeFindRankedActions(
        JNIEnv* env,
        jobject /* this */,
        jstring stateJson,
        jint simulations,
        jint threads,
        jint topK
    ) {
        if (!stateJson) return nullptr;
        const char* nativeState = env->GetStringUTFChars(stateJson, nullptr);
        char* result = duoorb_ai_find_ranked_actions(
            nativeState,
            (uint32_t)simulations,
            (uint32_t)threads,
            0,
            (uint32_t)topK
        );
        env->ReleaseStringUTFChars(stateJson, nativeState);

        if (!result) return nullptr;
        jstring jresult = env->NewStringUTF(result);
        duoorb_ai_free_string(result);
        return jresult;
    }

    JNIEXPORT jstring JNICALL
    Java_expo_modules_ai_DuoOrbNativeBridge_nativeGetBotAction(
        JNIEnv* env,
        jobject /* this */,
        jstring stateJson,
        jstring botId,
        jlong seed
    ) {
        if (!stateJson) return nullptr;
        const char* nativeState = env->GetStringUTFChars(stateJson, nullptr);
        const char* nativeBotId = botId ? env->GetStringUTFChars(botId, nullptr) : nullptr;
        char* result = duoorb_ai_get_bot_action(nativeState, nativeBotId, (int64_t)seed);
        env->ReleaseStringUTFChars(stateJson, nativeState);
        if (botId && nativeBotId) {
            env->ReleaseStringUTFChars(botId, nativeBotId);
        }

        if (!result) return nullptr;
        jstring jresult = env->NewStringUTF(result);
        duoorb_ai_free_string(result);
        return jresult;
    }

    JNIEXPORT jstring JNICALL
    Java_expo_modules_ai_DuoOrbNativeBridge_nativeGetHint(
        JNIEnv* env,
        jobject /* this */,
        jstring stateJson
    ) {
        if (!stateJson) return nullptr;
        const char* nativeState = env->GetStringUTFChars(stateJson, nullptr);
        char* result = duoorb_ai_get_hint(nativeState);
        env->ReleaseStringUTFChars(stateJson, nativeState);

        if (!result) return nullptr;
        jstring jresult = env->NewStringUTF(result);
        duoorb_ai_free_string(result);
        return jresult;
    }

    JNIEXPORT jstring JNICALL
    Java_expo_modules_ai_DuoOrbNativeBridge_nativeAnalyzeGame(
        JNIEnv* env,
        jobject /* this */,
        jstring initialStateJson,
        jstring historyJson
    ) {
        if (!initialStateJson || !historyJson) return nullptr;
        const char* nativeInit = env->GetStringUTFChars(initialStateJson, nullptr);
        const char* nativeHist = env->GetStringUTFChars(historyJson, nullptr);
        char* result = duoorb_ai_analyze_game(nativeInit, nativeHist);
        env->ReleaseStringUTFChars(initialStateJson, nativeInit);
        env->ReleaseStringUTFChars(historyJson, nativeHist);

        if (!result) return nullptr;
        jstring jresult = env->NewStringUTF(result);
        duoorb_ai_free_string(result);
        return jresult;
    }
}