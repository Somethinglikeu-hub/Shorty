package com.shorty.control

import android.content.Context

data class AppSettings(
    val githubToken: String = "",
    val owner: String = "Somethinglikeu-hub",
    val repo: String = "Shorty",
    val workflowFile: String = "generate-short.yml",
    val branch: String = "main"
)

data class YouTubeConnectionInfo(
    val email: String = "",
    val channelTitle: String = "",
    val channelId: String = "",
    val connectedAtIso: String = ""
)

class AppStorage(context: Context) {
    private val preferences = context.getSharedPreferences("shorty_settings", Context.MODE_PRIVATE)

    fun load(): AppSettings {
        return AppSettings(
            githubToken = preferences.getString("githubToken", "") ?: "",
            owner = preferences.getString("owner", "Somethinglikeu-hub") ?: "Somethinglikeu-hub",
            repo = preferences.getString("repo", "Shorty") ?: "Shorty",
            workflowFile = preferences.getString("workflowFile", "generate-short.yml") ?: "generate-short.yml",
            branch = preferences.getString("branch", "main") ?: "main"
        )
    }

    fun save(settings: AppSettings) {
        preferences.edit()
            .putString("githubToken", settings.githubToken)
            .putString("owner", settings.owner)
            .putString("repo", settings.repo)
            .putString("workflowFile", settings.workflowFile)
            .putString("branch", settings.branch)
            .apply()
    }

    fun loadYouTubeConnection(): YouTubeConnectionInfo {
        return YouTubeConnectionInfo(
            email = preferences.getString("youtubeEmail", "") ?: "",
            channelTitle = preferences.getString("youtubeChannelTitle", "") ?: "",
            channelId = preferences.getString("youtubeChannelId", "") ?: "",
            connectedAtIso = preferences.getString("youtubeConnectedAtIso", "") ?: ""
        )
    }

    fun saveYouTubeConnection(connection: YouTubeConnectionInfo) {
        preferences.edit()
            .putString("youtubeEmail", connection.email)
            .putString("youtubeChannelTitle", connection.channelTitle)
            .putString("youtubeChannelId", connection.channelId)
            .putString("youtubeConnectedAtIso", connection.connectedAtIso)
            .apply()
    }

    fun clearYouTubeConnection() {
        preferences.edit()
            .remove("youtubeEmail")
            .remove("youtubeChannelTitle")
            .remove("youtubeChannelId")
            .remove("youtubeConnectedAtIso")
            .apply()
    }
}
