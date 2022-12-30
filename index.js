const core = require("@actions/core");
const github = require("@actions/github");

async function action() {
  try {
    const token = core.getInput("token", { required: true });
    const octokit = github.getOctokit(token);

    // Process inputs for use later
    const mode = core.getInput("mode", { required: true });
    const count = parseInt(core.getInput("count", { required: true }), 10);
    const providedLabels = core
      .getInput("labels", { required: true })
      .split(",")
      .map((l) => l.trim())
      .filter((r) => r);

    const exitType = core.getInput("exit_type") || "failure";
    const shouldAddComment = core.getInput("add_comment") == "true";

    const allowedModes = ["exactly", "minimum", "maximum"];
    if (!allowedModes.includes(mode)) {
      await exitWithError(
        exitType,
        octokit,
        shouldAddComment,
        `Unknown mode input [${mode}]. Must be one of: ${allowedModes.join(
          ", "
        )}`
      );
      return;
    }

    const allowedExitCodes = ["success", "failure"];
    if (!allowedExitCodes.includes(exitType)) {
      await exitWithError(
        exitType,
        octokit,
        shouldAddComment,
        `Unknown exit_code input [${exitType}]. Must be one of: ${allowedExitCodes.join(
          ", "
        )}`
      );
      return;
    }

    // Fetch the labels using the API
    // We use the API rather than read event.json in case earlier steps
    // added a label
    const labels = (
      await octokit.rest.issues.listLabelsOnIssue({
        ...github.context.repo,
        issue_number: github.context.issue.number,
      })
    ).data;

    const appliedLabels = labels.map((label) => label.name);

    // How many labels overlap?
    let intersection = providedLabels.filter((x) => appliedLabels.includes(x));

    // Is there an error?
    let errorMode;
    if (mode === "exactly" && intersection.length !== count) {
      errorMode = "exactly";
    } else if (mode === "minimum" && intersection.length < count) {
      errorMode = "at least";
    } else if (mode === "maximum" && intersection.length > count) {
      errorMode = "at most";
    }

    // If so, add a comment (if enabled) and fail the run
    if (errorMode !== undefined) {
      const comment = core.getInput("message");
      const errorMessage = tmpl(comment, {
        mode,
        count,
        errorString: errorMode,
        provided: providedLabels.join(", "),
        applied: appliedLabels.join(", "),
      });

      await exitWithError(exitType, octokit, shouldAddComment, errorMessage);
      return;
    }

    core.setOutput("status", "success");
  } catch (e) {
    core.setFailed(e.message);
  }
}

function tmpl(t, o) {
  return t.replace(/\{\{\s*(.*?)\s*\}\}/g, function (item, param) {
    return o[param];
  });
}

async function exitWithError(exitType, octokit, shouldAddComment, message) {
  if (shouldAddComment) {
    await octokit.rest.issues.createComment({
      ...github.context.repo,
      issue_number: github.context.issue.number,
      body: message,
    });
  }

  core.setOutput("status", "failure");

  if (exitType === "success") {
    core.warning(message);
    return;
  }

  core.setFailed(message);
}

/* istanbul ignore next */
if (require.main === module) {
  action();
}

module.exports = action;
