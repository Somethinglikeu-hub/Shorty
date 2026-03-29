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
import androidx.appcompat.app.AppCompatActivity
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

    private val mainHandler = Handler(Looper.getMainLooper())
    private var latestRunUrl: String? = null
    private var latestStudioUrl: String? = null
    private var latestYoutubeUrl: String? = null
    private var isPolling = false

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

    private fun wireActions() {
        saveButton.setOnClickListener {
            storage.save(currentSettings())
            Toast.makeText(this, R.string.saved, Toast.LENGTH_SHORT).show()
        }
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

    private fun updateButtons() {
        openRunButton.isEnabled = !latestRunUrl.isNullOrBlank()
        openStudioButton.isEnabled = !latestStudioUrl.isNullOrBlank()
        openYoutubeButton.isEnabled = !latestYoutubeUrl.isNullOrBlank()
    }

    private fun setLoading(isLoading: Boolean, status: String) {
        progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        statusText.text = status
        saveButton.isEnabled = !isLoading
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
