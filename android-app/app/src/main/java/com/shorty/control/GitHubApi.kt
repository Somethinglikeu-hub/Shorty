package com.shorty.control

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.BufferedReader
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipInputStream

data class WorkflowRunInfo(
    val id: Long,
    val status: String,
    val conclusion: String?,
    val htmlUrl: String,
    val createdAt: String,
    val updatedAt: String
)

data class WorkflowSummary(
    val status: String,
    val title: String? = null,
    val topic: String? = null,
    val youtubeUrl: String? = null,
    val studioUrl: String? = null,
    val errorMessage: String? = null
)

data class GitHubSecretSyncResult(
    val names: List<String>
)

private data class GitHubPublicKey(
    val id: String,
    val key: String
)

class GitHubApi(private val settings: AppSettings) {
    private fun openConnection(url: String, method: String): HttpURLConnection {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.connectTimeout = 20000
        connection.readTimeout = 30000
        connection.setRequestProperty("Accept", "application/vnd.github+json")
        connection.setRequestProperty("Authorization", "Bearer ${settings.githubToken}")
        connection.setRequestProperty("X-GitHub-Api-Version", "2022-11-28")
        connection.setRequestProperty("User-Agent", "ShortyControlAndroid/1.1")
        return connection
    }

    private fun readBody(connection: HttpURLConnection): String {
        val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
        if (stream == null) {
            return ""
        }
        return BufferedReader(InputStreamReader(stream)).use { reader -> reader.readText() }
    }

    private fun parseApiError(connection: HttpURLConnection): String {
        val body = readBody(connection)
        return if (body.isNotBlank()) {
            try {
                JSONObject(body).optString("message", body)
            } catch (_: Exception) {
                body
            }
        } else {
            "GitHub API error ${connection.responseCode}"
        }
    }

    fun dispatchWorkflow(seedTopic: String?, privacy: String) {
        val url = "https://api.github.com/repos/${settings.owner}/${settings.repo}/actions/workflows/${settings.workflowFile}/dispatches"
        val connection = openConnection(url, "POST")
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        val payload = JSONObject()
            .put("ref", settings.branch)
            .put("inputs", JSONObject().put("seed_topic", seedTopic ?: "").put("privacy", privacy))
        connection.outputStream.use { output -> output.write(payload.toString().toByteArray()) }
        if (connection.responseCode != 204) {
            throw IllegalStateException(parseApiError(connection))
        }
    }

    fun syncCloudSecrets(refreshToken: String? = null): GitHubSecretSyncResult {
        val secretsToWrite = linkedMapOf<String, String>()
        if (BuildConfig.GEMINI_API_KEY.isNotBlank()) {
            secretsToWrite["GEMINI_API_KEY"] = BuildConfig.GEMINI_API_KEY
        }
        if (BuildConfig.PEXELS_API_KEY.isNotBlank()) {
            secretsToWrite["PEXELS_API_KEY"] = BuildConfig.PEXELS_API_KEY
        }
        if (BuildConfig.SHORTY_ADMIN_TOKEN.isNotBlank()) {
            secretsToWrite["SHORTY_ADMIN_TOKEN"] = BuildConfig.SHORTY_ADMIN_TOKEN
        }
        if (BuildConfig.YOUTUBE_CLIENT_ID.isNotBlank()) {
            secretsToWrite["YOUTUBE_CLIENT_ID"] = BuildConfig.YOUTUBE_CLIENT_ID
        }
        if (BuildConfig.YOUTUBE_CLIENT_SECRET.isNotBlank()) {
            secretsToWrite["YOUTUBE_CLIENT_SECRET"] = BuildConfig.YOUTUBE_CLIENT_SECRET
        }
        if (!refreshToken.isNullOrBlank()) {
            secretsToWrite["YOUTUBE_REFRESH_TOKEN"] = refreshToken
        }

        if (secretsToWrite.isEmpty()) {
            return GitHubSecretSyncResult(emptyList())
        }

        val publicKey = fetchActionsPublicKey()
        secretsToWrite.forEach { (name, value) ->
            createOrUpdateSecret(publicKey, name, value)
        }
        return GitHubSecretSyncResult(secretsToWrite.keys.toList())
    }

    private fun fetchActionsPublicKey(): GitHubPublicKey {
        val url = "https://api.github.com/repos/${settings.owner}/${settings.repo}/actions/secrets/public-key"
        val connection = openConnection(url, "GET")
        if (connection.responseCode !in 200..299) {
            throw IllegalStateException(parseApiError(connection))
        }
        val payload = JSONObject(readBody(connection))
        return GitHubPublicKey(
            id = payload.getString("key_id"),
            key = payload.getString("key")
        )
    }

    private fun createOrUpdateSecret(publicKey: GitHubPublicKey, name: String, value: String) {
        val encryptedValue = GitHubSecretCrypto.encryptForGitHub(publicKey.key, value)
        val url = "https://api.github.com/repos/${settings.owner}/${settings.repo}/actions/secrets/$name"
        val connection = openConnection(url, "PUT")
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        val payload = JSONObject()
            .put("encrypted_value", encryptedValue)
            .put("key_id", publicKey.id)
        connection.outputStream.use { output -> output.write(payload.toString().toByteArray()) }
        if (connection.responseCode !in 200..299) {
            throw IllegalStateException(parseApiError(connection))
        }
    }

    fun fetchLatestRun(): WorkflowRunInfo? {
        val url = "https://api.github.com/repos/${settings.owner}/${settings.repo}/actions/workflows/${settings.workflowFile}/runs?per_page=10&event=workflow_dispatch"
        val connection = openConnection(url, "GET")
        if (connection.responseCode !in 200..299) {
            throw IllegalStateException(parseApiError(connection))
        }
        val payload = JSONObject(readBody(connection))
        val runs = payload.optJSONArray("workflow_runs") ?: JSONArray()
        if (runs.length() == 0) {
            return null
        }
        val run = runs.getJSONObject(0)
        return WorkflowRunInfo(
            id = run.getLong("id"),
            status = run.optString("status"),
            conclusion = run.optString("conclusion").takeIf { it.isNotBlank() && it != "null" },
            htmlUrl = run.optString("html_url"),
            createdAt = run.optString("created_at"),
            updatedAt = run.optString("updated_at")
        )
    }

    fun fetchSummary(runId: Long): WorkflowSummary? {
        val url = "https://api.github.com/repos/${settings.owner}/${settings.repo}/actions/runs/$runId/artifacts"
        val connection = openConnection(url, "GET")
        if (connection.responseCode !in 200..299) {
            throw IllegalStateException(parseApiError(connection))
        }
        val payload = JSONObject(readBody(connection))
        val artifacts = payload.optJSONArray("artifacts") ?: JSONArray()
        for (index in 0 until artifacts.length()) {
            val artifact = artifacts.getJSONObject(index)
            val downloadUrl = artifact.optString("archive_download_url")
            if (downloadUrl.isBlank()) {
                continue
            }
            val summary = downloadSummaryZip(downloadUrl)
            if (summary != null) {
                return summary
            }
        }
        return null
    }

    private fun downloadSummaryZip(downloadUrl: String): WorkflowSummary? {
        val connection = openConnection(downloadUrl, "GET")
        if (connection.responseCode !in 200..299) {
            throw IllegalStateException(parseApiError(connection))
        }
        ZipInputStream(BufferedInputStream(connection.inputStream)).use { zip ->
            var entry = zip.nextEntry
            while (entry != null) {
                if (!entry.isDirectory && entry.name.endsWith("headless-last-run.json")) {
                    val payload = JSONObject(readZipEntry(zip))
                    val errorObject = payload.optJSONObject("error")
                    return WorkflowSummary(
                        status = payload.optString("status", "unknown"),
                        title = payload.optString("title").takeIf { it.isNotBlank() },
                        topic = payload.optString("topic").takeIf { it.isNotBlank() },
                        youtubeUrl = payload.optString("youtubeUrl").takeIf { it.isNotBlank() },
                        studioUrl = payload.optString("studioUrl").takeIf { it.isNotBlank() },
                        errorMessage = errorObject?.optString("message")
                            ?: payload.optString("error").takeIf { it.isNotBlank() }
                    )
                }
                zip.closeEntry()
                entry = zip.nextEntry
            }
        }
        return null
    }

    private fun readZipEntry(stream: InputStream): String {
        val buffer = ByteArray(8 * 1024)
        val output = ByteArrayOutputStream()
        while (true) {
            val read = stream.read(buffer)
            if (read <= 0) {
                break
            }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }
}
