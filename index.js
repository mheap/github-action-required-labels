const core = require("@actions/core");
const github = require("@actions/github");

let matchToken;
async function action() {
  // Use a guaranteed-unique (but persistent) string to match "our" comment
  // https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables
  const matchTokenId = [
    process.env.GITHUB_WORKFLOW,
    process.env.GITHUB_JOB,
    process.env.GITHUB_ACTION,
  ].join("/");

  matchToken = `<!-- ${matchTokenId} -->\n`;

  try {
    const token = core.getInput("token", { required: true });
    const octokit = github.getOctokit(token);

    // Process inputs for use later
    const mode = core.getInput("mode", { required: true });
    const count = parseInt(core.getInput("count", { required: true }), 10);

    const exitType = core.getInput("exit_type") || "failure";
    const shouldAddComment = core.getInput("add_comment") == "true";
    const labelsAreRegex = core.getInput("use_regex") == "true";

    let providedLabels = core.getInput("labels", { required: true });

    if (labelsAreRegex) {
      // If labels are regex they must be provided as new line delimited
      providedLabels = providedLabels.split("\n");
    } else {
      // Comma separated are allowed for exact string matches
      // This may be removed in the next major version
      providedLabels = providedLabels
        .split("\n")
        .join(",")
        .split(",")
        .map((l) => l.trim());
    }

    // Remove any empty labels
    providedLabels = providedLabels.filter((r) => r);

    const allowedModes = ["exactly", "minimum", "maximum"];
    if (!allowedModes.includes(mode)) {
      await exitWithError(
        exitType,
        octokit,
        shouldAddComment,
        `Unknown mode input [${mode}]. Must be one of: ${allowedModes.join(
          ", ",
        )}`,
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
          ", ",
        )}`,
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
    let intersection = [];
    if (labelsAreRegex) {
      intersection = appliedLabels.filter((appliedLabel) =>
        providedLabels.some((providedLabel) =>
          new RegExp(providedLabel, "i").test(appliedLabel),
        ),
      );
    } else {
      const lowerCasedAppliedLabels = appliedLabels.map((label) =>
        label.toLowerCase(),
      );
      intersection = providedLabels.filter((x) =>
        lowerCasedAppliedLabels.includes(x.toLowerCase()),
      );
    }

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

    // Remove the comment if it exists
    if (shouldAddComment) {
      const { data: existing } = await octokit.rest.issues.listComments({
        ...github.context.repo,
        issue_number: github.context.issue.number,
      });

      const generatedComment = existing.find((c) =>
        c.body.includes(matchToken),
      );
      if (generatedComment) {
        await octokit.rest.issues.deleteComment({
          ...github.context.repo,
          comment_id: generatedComment.id,
        });
      }
    }

    core.setOutput("labels", intersection.join(","));
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
    // Is there an existing comment?
    const { data: existing } = await octokit.rest.issues.listComments({
      ...github.context.repo,
      issue_number: github.context.issue.number,
    });

    const generatedComment = existing.find((c) => c.body.includes(matchToken));

    const params = {
      ...github.context.repo,
      issue_number: github.context.issue.number,
      body: `${matchToken}${message}`,
    };

    // If so, update it
    let method = "createComment";
    if (generatedComment) {
      method = "updateComment";
      params.comment_id = generatedComment.id;
    }
    await octokit.rest.issues[method](params);
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
