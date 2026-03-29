package com.shorty.control

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.common.api.ApiException
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {
    private lateinit var storage: AppStorage

    private lateinit var tokenInput: EditText
    private lateinit var ownerInput: EditText
    private lateinit var repoInput: EditText
    private lateinit var workflowInput: EditText
    private lateinit var branchInput: EditText
    private lateinit var seedTopicInput: EditText
    private lateinit var privacySpinner: Spinner

    private lateinit var saveButton: Button
    private lateinit var connectYoutubeButton: Button
    private lateinit var generateButton: Button
    private lateinit var refreshButton: Button
    private lateinit var openRunButton: Button
    private lateinit var openStudioButton: Button
    private lateinit var openYoutubeButton: Button

    private lateinit var progressBar: ProgressBar
    private lateinit var statusText: TextView
    private lateinit var runText: TextView
    private lateinit var summaryText: TextView
    private lateinit var helpText: TextView
    private lateinit var youtubeStatusText: TextView

    private val mainHandler = Handler(Looper.getMainLooper())
    private var latestRunUrl: String? = null
    private var latestStudioUrl: String? = null
    private var latestYoutubeUrl: String? = null
    private var isPolling = false

    private val googleSignInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode != RESULT_OK || result.data == null) {
            setLoading(false, getString(R.string.youtube_sign_in_cancelled))
            Toast.makeText(this, R.string.youtube_sign_in_cancelled, Toast.LENGTH_LONG).show()
            return@registerForActivityResult
        }

        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(ApiException::class.java)
            val serverAuthCode = account.serverAuthCode
            if (serverAuthCode.isNullOrBlank()) {
                setLoading(false, getString(R.string.missing_server_auth_code))
                Toast.makeText(this, R.string.missing_server_auth_code, Toast.LENGTH_LONG).show()
                return@registerForActivityResult
            }
            finishYouTubeConnection(serverAuthCode)
        } catch (error: ApiException) {
            setLoading(false, error.localizedMessage ?: getString(R.string.generic_error))
            Toast.makeText(this, error.localizedMessage ?: getString(R.string.generic_error), Toast.LENGTH_LONG).show()
        }
    }

    private val pollRunnable = object : Runnable {
        override fun run() {
            fetchLatestRun(showToastOnError = false)
            if (isPolling) {
                mainHandler.postDelayed(this, 10000)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        storage = AppStorage(this)

        bindViews()
        setupSpinner()
        restoreSettings()
        restoreYouTubeConnection()
        wireActions()
    }

    private fun bindViews() {
        tokenInput = findViewById(R.id.githubTokenInput)
        ownerInput = findViewById(R.id.ownerInput)
        repoInput = findViewById(R.id.repoInput)
        workflowInput = findViewById(R.id.workflowInput)
        branchInput = findViewById(R.id.branchInput)
        seedTopicInput = findViewById(R.id.seedTopicInput)
        privacySpinner = findViewById(R.id.privacySpinner)
        saveButton = findViewById(R.id.saveButton)
        connectYoutubeButton = findViewById(R.id.connectYoutubeButton)
        generateButton = findViewById(R.id.generateButton)
        refreshButton = findViewById(R.id.refreshButton)
        openRunButton = findViewById(R.id.openRunButton)
        openStudioButton = findViewById(R.id.openStudioButton)
        openYoutubeButton = findViewById(R.id.openYoutubeButton)
        progressBar = findViewById(R.id.progressBar)
        statusText = findViewById(R.id.statusText)
        runText = findViewById(R.id.runText)
        summaryText = findViewById(R.id.summaryText)
        helpText = findViewById(R.id.helpText)
        youtubeStatusText = findViewById(R.id.youtubeStatusText)
    }

    private fun setupSpinner() {
        val adapter = ArrayAdapter.createFromResource(
            this,
            R.array.privacy_options,
            android.R.layout.simple_spinner_item
        )
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        privacySpinner.adapter = adapter
    }

    private fun restoreSettings() {
        val settings = storage.load()
        tokenInput.setText(settings.githubToken)
        ownerInput.setText(settings.owner)
        repoInput.setText(settings.repo)
        workflowInput.setText(settings.workflowFile)
        branchInput.setText(settings.branch)
        helpText.text = getString(R.string.setup_hint, settings.owner, settings.repo)
    }

    private fun restoreYouTubeConnection() {
        renderYouTubeConnection(storage.loadYouTubeConnection())
    }

    private fun wireActions() {
        saveButton.setOnClickListener {
            storage.save(currentSettings())
            Toast.makeText(this, R.string.saved, Toast.LENGTH_SHORT).show()
        }
        connectYoutubeButton.setOnClickListener { connectYouTube() }
        generateButton.setOnClickListener { dispatchWorkflow() }
        refreshButton.setOnClickListener { fetchLatestRun(showToastOnError = true) }
        openRunButton.setOnClickListener { openExternal(latestRunUrl) }
        openStudioButton.setOnClickListener { openExternal(latestStudioUrl) }
        openYoutubeButton.setOnClickListener { openExternal(latestYoutubeUrl) }
    }

    private fun currentSettings(): AppSettings {
        return AppSettings(
            githubToken = tokenInput.text.toString().trim(),
            owner = ownerInput.text.toString().trim(),
            repo = repoInput.text.toString().trim(),
            workflowFile = workflowInput.text.toString().trim(),
            branch = branchInput.text.toString().trim()
        )
    }

    private fun validateSettings(settings: AppSettings): Boolean {
        if (settings.githubToken.isBlank() || settings.owner.isBlank() || settings.repo.isBlank() ||
            settings.workflowFile.isBlank() || settings.branch.isBlank()
        ) {
            Toast.makeText(this, R.string.missing_settings, Toast.LENGTH_LONG).show()
            return false
        }
        return true
    }

    private fun connectYouTube() {
        val settings = currentSettings()
        if (!validateSettings(settings)) {
            return
        }
        if (!YouTubeAuthManager.isConfigured()) {
            Toast.makeText(this, R.string.youtube_connection_missing_config, Toast.LENGTH_LONG).show()
            return
        }

        storage.save(settings)
        setLoading(true, getString(R.string.opening_google_sign_in))
        val signInClient = YouTubeAuthManager.createGoogleSignInClient(this)
        googleSignInLauncher.launch(signInClient.signInIntent)
    }

    private fun finishYouTubeConnection(serverAuthCode: String) {
        val settings = currentSettings()
        setLoading(true, getString(R.string.finishing_youtube_connect))
        thread {
            try {
                val account = YouTubeAuthManager.exchangeServerAuthCode(serverAuthCode)
                val api = GitHubApi(settings)
                api.syncCloudSecrets(account.refreshToken)
                val connectionInfo = YouTubeConnectionInfo(
                    email = account.email,
                    channelTitle = account.channelTitle,
                    channelId = account.channelId,
                    connectedAtIso = account.connectedAtIso
                )
                storage.save(settings)
                storage.saveYouTubeConnection(connectionInfo)
                runOnUiThread {
                    YouTubeAuthManager.createGoogleSignInClient(this).signOut()
                    renderYouTubeConnection(connectionInfo)
                    setLoading(false, getString(R.string.youtube_connected))
                    Toast.makeText(this, R.string.youtube_connected, Toast.LENGTH_LONG).show()
                }
            } catch (error: Exception) {
                runOnUiThread {
                    setLoading(false, error.message ?: getString(R.string.generic_error))
                    Toast.makeText(this, error.message ?: getString(R.string.generic_error), Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun dispatchWorkflow() {
        val settings = currentSettings()
        if (!validateSettings(settings)) {
            return
        }
        storage.save(settings)
        val privacy = privacySpinner.selectedItem.toString()
        val seedTopic = seedTopicInput.text.toString().trim().ifBlank { null }
        setLoading(true, getString(R.string.dispatching))
        thread {
            try {
                GitHubApi(settings).dispatchWorkflow(seedTopic, privacy)
                runOnUiThread {
                    Toast.makeText(this, R.string.workflow_started, Toast.LENGTH_SHORT).show()
                    setLoading(false, getString(R.string.workflow_started))
                    isPolling = true
                    mainHandler.removeCallbacks(pollRunnable)
                    mainHandler.post(pollRunnable)
                }
            } catch (error: Exception) {
                runOnUiThread {
                    setLoading(false, error.message ?: getString(R.string.generic_error))
                    Toast.makeText(this, error.message ?: getString(R.string.generic_error), Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun fetchLatestRun(showToastOnError: Boolean) {
        val settings = currentSettings()
        if (!validateSettings(settings)) {
            return
        }
        setLoading(true, getString(R.string.loading_run))
        thread {
            try {
                val api = GitHubApi(settings)
                val run = api.fetchLatestRun()
                if (run == null) {
                    runOnUiThread {
                        latestRunUrl = null
                        latestStudioUrl = null
                        latestYoutubeUrl = null
                        updateButtons()
                        setLoading(false, getString(R.string.no_run_found))
                        runText.text = getString(R.string.no_run_found)
                        summaryText.text = ""
                    }
                    return@thread
                }
                latestRunUrl = run.htmlUrl
                val summary = if (run.status == "completed") api.fetchSummary(run.id) else null
                runOnUiThread {
                    latestStudioUrl = summary?.studioUrl
                    latestYoutubeUrl = summary?.youtubeUrl
                    updateButtons()
                    renderRun(run, summary)
                    val statusMessage = buildString {
                        append("Run #")
                        append(run.id)
                        append(" - ")
                        append(run.status)
                        run.conclusion?.let {
                            append(" / ")
                            append(it)
                        }
                    }
                    setLoading(false, statusMessage)
                    if (run.status == "completed") {
                        isPolling = false
                        mainHandler.removeCallbacks(pollRunnable)
                    }
                }
            } catch (error: Exception) {
                runOnUiThread {
                    setLoading(false, error.message ?: getString(R.string.generic_error))
                    if (showToastOnError) {
                        Toast.makeText(this, error.message ?: getString(R.string.generic_error), Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    private fun renderRun(run: WorkflowRunInfo, summary: WorkflowSummary?) {
        runText.text = getString(
            R.string.run_format,
            run.id.toString(),
            run.status,
            run.conclusion ?: "-",
            run.updatedAt
        )
        summaryText.text = if (summary == null) {
            getString(R.string.summary_pending)
        } else {
            buildString {
                appendLine("Status: ${summary.status}")
                summary.title?.let { appendLine("Title: $it") }
                summary.topic?.let { appendLine("Topic: $it") }
                summary.youtubeUrl?.let { appendLine("YouTube: $it") }
                summary.studioUrl?.let { appendLine("Studio: $it") }
                summary.errorMessage?.let { appendLine("Error: $it") }
            }.trim()
        }
    }

    private fun renderYouTubeConnection(connection: YouTubeConnectionInfo) {
        youtubeStatusText.text = if (connection.channelId.isBlank()) {
            getString(R.string.youtube_not_connected)
        } else {
            getString(
                R.string.youtube_connected_format,
                connection.channelTitle.ifBlank { "-" },
                connection.email.ifBlank { "-" },
                connection.channelId
            )
        }
    }

    private fun updateButtons() {
        openRunButton.isEnabled = !latestRunUrl.isNullOrBlank()
        openStudioButton.isEnabled = !latestStudioUrl.isNullOrBlank()
        openYoutubeButton.isEnabled = !latestYoutubeUrl.isNullOrBlank()
    }

    private fun setLoading(isLoading: Boolean, status: String) {
        progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        statusText.text = status
        saveButton.isEnabled = !isLoading
        connectYoutubeButton.isEnabled = !isLoading
        generateButton.isEnabled = !isLoading
        refreshButton.isEnabled = !isLoading
    }

    private fun openExternal(url: String?) {
        if (url.isNullOrBlank()) {
            Toast.makeText(this, R.string.link_missing, Toast.LENGTH_SHORT).show()
            return
        }
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    }

    override fun onDestroy() {
        isPolling = false
        mainHandler.removeCallbacks(pollRunnable)
        super.onDestroy()
    }
}
