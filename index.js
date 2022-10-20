const { Toolkit } = require("actions-toolkit");

Toolkit.run(async (tools) => {
  // Process inputs for use later
  const mode = tools.inputs.mode;
  const count = parseInt(tools.inputs.count, 10);
  const allowedLabels = tools.inputs.labels
    .split(",")
    .map((l) => l.trim())
    .filter((r) => r);

  const exitType = tools.inputs.exit_type || "failure";

  // Validate inputs
  if (tools.inputs.count === "") {
    tools.exit.failure(`[count] input is not provided`);
    return;
  }

  if (allowedLabels.length === 0) {
    tools.exit.failure("[labels] input is empty or not provided");
    return;
  }

  const allowedModes = ["exactly", "minimum", "maximum"];
  if (!allowedModes.includes(mode)) {
    tools.exit.failure(
      `Unknown mode input [${mode}]. Must be one of: ${allowedModes.join(", ")}`
    );
    return;
  }

  const allowedExitCodes = ["success", "neutral", "failure"];
  if (!allowedExitCodes.includes(exitType)) {
    tools.exit.failure(
      `Unknown exit_code input [${exitType}]. Must be one of: ${allowedExitCodes.join(
        ", "
      )}`
    );
    return;
  }

  // If a token is provided, call the API, otherwise read the event.json file
  let labels;
  if (process.env.GITHUB_TOKEN) {
    labels = (await tools.github.issues.listLabelsOnIssue(tools.context.issue))
      .data;
  } else {
    labels = tools.context.payload.pull_request.labels;
  }

  const appliedLabels = labels.map((label) => label.name);

  // How many labels overlap?
  let intersection = allowedLabels.filter((x) => appliedLabels.includes(x));

  if (mode === "exactly" && intersection.length !== count) {
    await exitWithError(
      tools,
      exitType,
      `Label error. Requires exactly ${count} of: ${allowedLabels.join(
        ", "
      )}. Found: ${appliedLabels.join(", ")}`
    );
    return;
  }

  if (mode === "minimum" && intersection.length < count) {
    await exitWithError(
      tools,
      exitType,
      `Label error. Requires at least ${count} of: ${allowedLabels.join(
        ", "
      )}. Found: ${appliedLabels.join(", ")}`
    );
    return;
  }

  if (mode === "maximum" && intersection.length > count) {
    await exitWithError(
      tools,
      exitType,
      `Label error. Requires at most ${count} of: ${allowedLabels.join(
        ", "
      )}. Found: ${appliedLabels.join(", ")}`
    );
    return;
  }

  tools.outputs.status = "success";
  tools.exit.success("Complete");
});

async function exitWithError(tools, exitType, message) {
  if (tools.inputs.add_comment) {
    if (process.env.GITHUB_TOKEN) {
      await tools.github.issues.createComment({
        ...tools.context.issue,
        body: message,
      });
    } else {
      throw new Error(
        "The GITHUB_TOKEN environment variable must be set to add a comment"
      );
    }
  }
  tools.outputs.status = "failure";
  tools.exit[exitType](message);
}
