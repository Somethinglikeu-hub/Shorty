package com.shorty.control

import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.common.api.Scope
import org.json.JSONObject
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.Instant
import java.util.Base64

data class ConnectedYouTubeAccount(
    val email: String,
    val channelTitle: String,
    val channelId: String,
    val refreshToken: String,
    val connectedAtIso: String = Instant.now().toString()
)

object YouTubeAuthManager {
    private const val YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.upload"
    private const val TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
    private const val CHANNELS_ENDPOINT = "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true"

    fun isConfigured(): Boolean {
        return BuildConfig.YOUTUBE_CLIENT_ID.isNotBlank() && BuildConfig.YOUTUBE_CLIENT_SECRET.isNotBlank()
    }

    fun createGoogleSignInClient(activity: MainActivity): GoogleSignInClient {
        if (!isConfigured()) {
            throw IllegalStateException("YouTube OAuth client is not configured in this APK build.")
        }
        val options = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestScopes(Scope(YOUTUBE_SCOPE))
            .requestServerAuthCode(BuildConfig.YOUTUBE_CLIENT_ID, true)
            .build()
        return GoogleSignIn.getClient(activity, options)
    }

    fun exchangeServerAuthCode(serverAuthCode: String): ConnectedYouTubeAccount {
        val response = postForm(
            TOKEN_ENDPOINT,
            mapOf(
                "code" to serverAuthCode,
                "client_id" to BuildConfig.YOUTUBE_CLIENT_ID,
                "client_secret" to BuildConfig.YOUTUBE_CLIENT_SECRET,
                "redirect_uri" to BuildConfig.YOUTUBE_TOKEN_REDIRECT_URI,
                "grant_type" to "authorization_code"
            )
        )

        val refreshToken = response.optString("refresh_token")
        if (refreshToken.isBlank()) {
            throw IllegalStateException("Google did not return a refresh token. Please try Connect YouTube again.")
        }

        val accessToken = response.optString("access_token")
        if (accessToken.isBlank()) {
            throw IllegalStateException("Google did not return an access token.")
        }

        val email = decodeEmail(response.optString("id_token"))
        val channel = fetchChannel(accessToken)

        return ConnectedYouTubeAccount(
            email = email,
            channelTitle = channel.first,
            channelId = channel.second,
            refreshToken = refreshToken
        )
    }

    private fun decodeEmail(idToken: String): String {
        if (idToken.isBlank()) {
            return ""
        }
        val parts = idToken.split(".")
        if (parts.size < 2) {
            return ""
        }
        return try {
            val payload = String(Base64.getUrlDecoder().decode(parts[1]), Charsets.UTF_8)
            JSONObject(payload).optString("email")
        } catch (_: Exception) {
            ""
        }
    }

    private fun fetchChannel(accessToken: String): Pair<String, String> {
        val connection = openConnection(CHANNELS_ENDPOINT, "GET")
        connection.setRequestProperty("Authorization", "Bearer $accessToken")
        val payload = JSONObject(readBody(connection))
        if (connection.responseCode !in 200..299) {
            throw IllegalStateException(payload.optString("error_description", payload.optString("error", "Failed to fetch YouTube channel.")))
        }
        val items = payload.optJSONArray("items")
        val first = items?.optJSONObject(0)
            ?: throw IllegalStateException("No YouTube channel was found for the selected Google account.")
        val snippet = first.optJSONObject("snippet")
        return Pair(
            snippet?.optString("title").orEmpty(),
            first.optString("id")
        )
    }

    private fun postForm(url: String, values: Map<String, String>): JSONObject {
        val connection = openConnection(url, "POST")
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
        val body = values.entries.joinToString("&") { (key, value) ->
            "${URLEncoder.encode(key, Charsets.UTF_8.name())}=${URLEncoder.encode(value, Charsets.UTF_8.name())}"
        }
        BufferedWriter(OutputStreamWriter(connection.outputStream, Charsets.UTF_8)).use { writer ->
            writer.write(body)
        }
        val payload = readBody(connection)
        val json = if (payload.isBlank()) JSONObject() else JSONObject(payload)
        if (connection.responseCode !in 200..299) {
            throw IllegalStateException(
                json.optString("error_description")
                    .ifBlank { json.optString("error") }
                    .ifBlank { "Google token exchange failed (${connection.responseCode})." }
            )
        }
        return json
    }

    private fun openConnection(url: String, method: String): HttpURLConnection {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.connectTimeout = 20000
        connection.readTimeout = 30000
        connection.setRequestProperty("Accept", "application/json")
        return connection
    }

    private fun readBody(connection: HttpURLConnection): String {
        val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
        if (stream == null) {
            return ""
        }
        return BufferedReader(InputStreamReader(stream)).use { it.readText() }
    }
}
