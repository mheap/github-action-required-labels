const action = require(".");
const core = require("@actions/core");
const github = require("@actions/github");

const mockedEnv = require("mocked-env");
const nock = require("nock");
nock.disableNetConnect();

// note: these need to match the mocked env vars below
const matchToken = `<!-- demo-workflow/demo-job/required-labels -->\n`;

describe("Required Labels", () => {
  let restore;
  let restoreTest;
  beforeEach(() => {
    restore = mockedEnv({
      GITHUB_WORKFLOW: "demo-workflow",
      GITHUB_JOB: "demo-job",
      GITHUB_ACTION: "required-labels",
      GITHUB_ACTOR: "mheap",
      GITHUB_REPOSITORY: "mheap/missing-repo",
      GITHUB_WORKSPACE: "/github/workspace",
      GITHUB_SHA: "e21490305ed7ac0897b7c7c54c88bb47f7a6d6c4",
      GITHUB_EVENT_NAME: "",
      GITHUB_EVENT_PATH: "",
      INPUT_TOKEN: "this_is_invalid",
      INPUT_MESSAGE:
        "Label error. Requires {{errorString}} {{count}} of: {{ provided }}. Found: {{ applied }}",
    });

    core.setOutput = jest.fn();
    core.warning = jest.fn();
    core.setFailed = jest.fn();
  });

  afterEach(() => {
    restore();
    restoreTest();
    jest.resetModules();

    if (!nock.isDone()) {
      throw new Error(
        `Not all nock interceptors were used: ${JSON.stringify(
          nock.pendingMocks(),
        )}`,
      );
    }
    nock.cleanAll();
  });

  describe("interacts with the API", () => {
    it("fetches the labels from the API", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        GITHUB_TOKEN: "mock-token-here-abc",
      });

      mockLabels(["enhancement", "bug"]);

      await action();
      expect(core.setOutput).toBeCalledTimes(2);
      expect(core.setOutput).toBeCalledWith("status", "success");
      expect(core.setOutput).toBeCalledWith("labels", "enhancement");
    });

    it("fetches the labels from the API (and fails)", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        GITHUB_TOKEN: "mock-token-here-abc",
      });

      mockLabels(["bug"]);

      await action();
      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "failure");
      expect(core.setFailed).toBeCalledTimes(1);
      expect(core.setFailed).toBeCalledWith(
        "Label error. Requires exactly 1 of: enhancement. Found: bug",
      );
    });

    it("posts a comment when enabled", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        INPUT_ADD_COMMENT: "true",
        GITHUB_TOKEN: "mock-token-here-abc",
      });

      mockLabels(["bug"]);

      mockListComments([]);

      nock("https://api.github.com")
        .post("/repos/mheap/missing-repo/issues/28/comments", {
          body: `${matchToken}Label error. Requires exactly 1 of: enhancement. Found: bug`,
        })
        .reply(201);

      await action();
    });

    it("deletes a comment when passing", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        INPUT_ADD_COMMENT: "true",
        GITHUB_TOKEN: "mock-token-here-abc",
      });

      mockLabels(["bug"]);
      mockListComments([{ id: "12345", body: `${matchToken}This` }]);

      nock("https://api.github.com")
        .delete("/repos/mheap/missing-repo/issues/comments/12345")
        .reply(200);

      await action();
    });
  });

  describe("success", () => {
    it("exact count", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
      });
      mockLabels(["enhancement"]);

      await action();

      expect(core.setOutput).toBeCalledTimes(2);
      expect(core.setOutput).toBeCalledWith("status", "success");
      expect(core.setOutput).toBeCalledWith("labels", "enhancement");
    });

    it("at least X", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement,bug,triage",
        INPUT_MODE: "minimum",
        INPUT_COUNT: "2",
      });
      mockLabels(["enhancement", "bug"]);

      await action();

      expect(core.setOutput).toBeCalledTimes(2);
      expect(core.setOutput).toBeCalledWith("status", "success");
      expect(core.setOutput).toBeCalledWith("labels", "enhancement,bug");
    });

    it("at most X", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement,bug,triage",
        INPUT_MODE: "maximum",
        INPUT_COUNT: "2",
      });

      mockLabels(["enhancement", "bug"]);

      await action();

      expect(core.setOutput).toBeCalledTimes(2);
      expect(core.setOutput).toBeCalledWith("status", "success");
      expect(core.setOutput).toBeCalledWith("labels", "enhancement,bug");
    });

    it("exactly (regex)", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhance.*",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        INPUT_USE_REGEX: "true",
      });
      mockLabels(["enhancement"]);

      await action();

      expect(core.setOutput).toBeCalledTimes(2);
      expect(core.setOutput).toBeCalledWith("status", "success");
      expect(core.setOutput).toBeCalledWith("labels", "enhancement");
    });

    it("exactly (multiple regex)", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "backport/none\nbackport \\d.\\d",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        INPUT_USE_REGEX: "true",
      });
      mockLabels(["backport 3.7"]);

      await action();

      expect(core.setOutput).toBeCalledTimes(2);
      expect(core.setOutput).toBeCalledWith("status", "success");
      expect(core.setOutput).toBeCalledWith("labels", "backport 3.7");
    });

    it("at least X (regex)", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhance.*\nbug\ntriage",
        INPUT_MODE: "minimum",
        INPUT_COUNT: "2",
        INPUT_USE_REGEX: "true",
      });
      mockLabels(["enhancement", "bug"]);

      await action();

      expect(core.setOutput).toBeCalledTimes(2);
      expect(core.setOutput).toBeCalledWith("status", "success");
      expect(core.setOutput).toBeCalledWith("labels", "enhancement,bug");
    });

    it("at most X (regex)", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhance.*\nbug\ntriage",
        INPUT_MODE: "maximum",
        INPUT_COUNT: "2",
        INPUT_USE_REGEX: "true",
      });

      mockLabels(["enhancement", "bug"]);

      await action();

      expect(core.setOutput).toBeCalledTimes(2);
      expect(core.setOutput).toBeCalledWith("status", "success");
      expect(core.setOutput).toBeCalledWith("labels", "enhancement,bug");
    });
  });

  describe("failure", () => {
    it("exact count", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
      });
      mockLabels(["enhancement", "bug"]);

      await action();

      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "failure");
      expect(core.setFailed).toBeCalledTimes(1);
      expect(core.setFailed).toBeCalledWith(
        "Label error. Requires exactly 1 of: enhancement, bug. Found: enhancement, bug",
      );
    });

    it("exact count (regex)", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhance.*\nbug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        INPUT_USE_REGEX: "true",
      });
      mockLabels(["enhancement", "bug"]);

      await action();

      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "failure");
      expect(core.setFailed).toBeCalledTimes(1);
      expect(core.setFailed).toBeCalledWith(
        "Label error. Requires exactly 1 of: enhance.*, bug. Found: enhancement, bug",
      );
    });

    it("fails when regex are provided as comma delimited", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhance.*, bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        INPUT_USE_REGEX: "true",
      });
      mockLabels(["enhancement", "bug"]);

      await action();

      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "failure");
      expect(core.setFailed).toBeCalledTimes(1);
      expect(core.setFailed).toBeCalledWith(
        "Label error. Requires exactly 1 of: enhance.*, bug. Found: enhancement, bug",
      );
    });

    it("at least X", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement,bug,triage",
        INPUT_MODE: "minimum",
        INPUT_COUNT: "2",
      });
      mockLabels(["enhancement"]);

      await action();

      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "failure");
      expect(core.setFailed).toBeCalledTimes(1);
      expect(core.setFailed).toBeCalledWith(
        "Label error. Requires at least 2 of: enhancement, bug, triage. Found: enhancement",
      );
    });

    it("at most X", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement,bug,triage",
        INPUT_MODE: "maximum",
        INPUT_COUNT: "2",
      });
      mockLabels(["enhancement", "triage", "bug"]);

      await action();
      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "failure");
      expect(core.setFailed).toBeCalledTimes(1);
      expect(core.setFailed).toBeCalledWith(
        "Label error. Requires at most 2 of: enhancement, bug, triage. Found: enhancement, triage, bug",
      );
    });
  });

  describe("validation", () => {
    it("missing INPUT_MODE", async () => {
      restoreTest = mockPr({});

      await action();

      expect(core.setFailed).toBeCalledTimes(1);
      expect(core.setFailed).toBeCalledWith(
        "Input required and not supplied: mode",
      );
    });

    it("missing INPUT_COUNT", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
      });

      await action();

      expect(core.setFailed).toBeCalledTimes(1);
      expect(core.setFailed).toBeCalledWith(
        "Input required and not supplied: count",
      );
    });

    it("missing INPUT_LABELS", async () => {
      restoreTest = mockPr({
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
      });

      await action();

      expect(core.setFailed).toBeCalledTimes(1);
      expect(core.setFailed).toBeCalledWith(
        "Input required and not supplied: labels",
      );
    });

    it("unknown mode", async () => {
      restoreTest = mockPr({
        INPUT_MODE: "bananas",
        INPUT_LABELS: "enhancement,bug",
        INPUT_COUNT: "1",
      });

      await action();

      expect(core.setFailed).toBeCalledTimes(1);
      expect(core.setFailed).toBeCalledWith(
        "Unknown mode input [bananas]. Must be one of: exactly, minimum, maximum",
      );
    });

    it("unknown exit_code", async () => {
      restoreTest = mockPr({
        INPUT_MODE: "exactly",
        INPUT_LABELS: "enhancement,bug",
        INPUT_COUNT: "1",
        INPUT_EXIT_TYPE: "other",
      });

      await action();

      expect(core.setFailed).toBeCalledTimes(1);
      expect(core.setFailed).toBeCalledWith(
        "Unknown exit_code input [other]. Must be one of: success, failure",
      );
    });
  });

  describe("data integrity", () => {
    it("supports spaces in INPUT_LABELS", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement ,   bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
      });
      mockLabels(["bug"]);

      await action();
      expect(core.setOutput).toBeCalledTimes(2);
      expect(core.setOutput).toBeCalledWith("status", "success");
      expect(core.setOutput).toBeCalledWith("labels", "bug");
    });

    it("supports multiple lines in INPUT_LABELS", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement\nbug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
      });
      mockLabels(["bug"]);

      await action();
      expect(core.setOutput).toBeCalledTimes(2);
      expect(core.setOutput).toBeCalledWith("status", "success");
      expect(core.setOutput).toBeCalledWith("labels", "bug");
    });

    it("supports multiple lines with commas in INPUT_LABELS", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement,\nbug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
      });
      mockLabels(["bug"]);

      await action();
      expect(core.setOutput).toBeCalledTimes(2);
      expect(core.setOutput).toBeCalledWith("status", "success");
      expect(core.setOutput).toBeCalledWith("labels", "bug");
    });

    it("is case insensitive when matching INPUT_LABELS", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "Do Not Merge",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
      });
      mockLabels(["DO NOT MERGE"]);

      await action();
      expect(core.setOutput).toBeCalledTimes(2);
      expect(core.setOutput).toBeCalledWith("status", "success");
      expect(core.setOutput).toBeCalledWith("labels", "Do Not Merge");
    });

    it("is case insensitive when matching INPUT_LABELS using regex", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "needs .*",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "2",
        INPUT_USE_REGEX: "true",
      });
      mockLabels(["Needs Code Review", "Needs QA Review", "Do Not Merge"]);

      await action();

      expect(core.setOutput).toBeCalledTimes(2);
      expect(core.setOutput).toBeCalledWith("status", "success");
      expect(core.setOutput).toBeCalledWith(
        "labels",
        "Needs Code Review,Needs QA Review",
      );
    });
  });

  describe("configurable exit code", () => {
    it("defaults to failure", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
      });
      mockLabels(["enhancement", "bug"]);

      await action();

      expect(core.setFailed).toBeCalledTimes(1);
      expect(core.setFailed).toBeCalledWith(
        "Label error. Requires exactly 1 of: enhancement, bug. Found: enhancement, bug",
      );
    });

    it("explicitly uses failure", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        INPUT_EXIT_TYPE: "failure",
      });
      mockLabels(["enhancement", "bug"]);

      await action();

      expect(core.setFailed).toBeCalledTimes(1);
      expect(core.setFailed).toBeCalledWith(
        "Label error. Requires exactly 1 of: enhancement, bug. Found: enhancement, bug",
      );
    });

    it("explicitly uses success", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        INPUT_EXIT_TYPE: "success",
      });
      mockLabels(["enhancement", "bug"]);

      await action();

      expect(core.warning).toBeCalledTimes(1);
      expect(core.warning).toBeCalledWith(
        "Label error. Requires exactly 1 of: enhancement, bug. Found: enhancement, bug",
      );
    });
  });

  describe("add comment", () => {
    it("does not add a comment when add_comment is false", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        INPUT_ADD_COMMENT: "false",
      });
      mockLabels(["enhancement", "bug"]);

      await action();

      expect(core.setFailed).toBeCalledTimes(1);
      expect(core.setFailed).toBeCalledWith(
        "Label error. Requires exactly 1 of: enhancement, bug. Found: enhancement, bug",
      );
    });

    it("adds a custom comment when comment is provided", async () => {
      restoreTest = mockPr({
        GITHUB_TOKEN: "abc123",
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        INPUT_ADD_COMMENT: "true",
        INPUT_MESSAGE: "This is a static comment",
      });

      mockLabels(["enhancement", "bug"]);

      mockListComments([]);

      nock("https://api.github.com")
        .post("/repos/mheap/missing-repo/issues/28/comments", {
          body: `${matchToken}This is a static comment`,
        })
        .reply(201);

      await action();
    });

    it("updates an existing comment when one is found", async () => {
      restoreTest = mockPr({
        GITHUB_TOKEN: "abc123",
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        INPUT_ADD_COMMENT: "true",
        INPUT_MESSAGE: "This is a static comment",
      });

      mockLabels(["enhancement", "bug"]);

      mockListComments([{ id: "12345", body: `${matchToken}This` }]);

      nock("https://api.github.com")
        .patch("/repos/mheap/missing-repo/issues/comments/12345", {
          issue_number: 28,
          body: `${matchToken}This is a static comment`,
        })
        .reply(200);

      await action();
    });

    it("creates when comments exist but don't match", async () => {
      restoreTest = mockPr({
        GITHUB_TOKEN: "abc123",
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        INPUT_ADD_COMMENT: "true",
        INPUT_MESSAGE: "This is a static comment",
      });

      mockLabels(["enhancement", "bug"]);

      mockListComments([{ id: "12345", body: `No Match` }]);

      nock("https://api.github.com")
        .post("/repos/mheap/missing-repo/issues/28/comments", {
          body: `${matchToken}This is a static comment`,
        })
        .reply(201);

      await action();
    });

    it("interpolates correctly", async () => {
      restoreTest = mockPr({
        GITHUB_TOKEN: "abc123",
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        INPUT_ADD_COMMENT: "true",
        // Spacing is important within braces. Proves that templating is space-tolerant
        INPUT_MESSAGE:
          "Mode: {{mode }}, Count: {{ count}}, Error String: {{errorString }}, Provided: {{ provided }}, Applied: {{applied}}",
      });

      mockLabels(["enhancement", "bug"]);

      mockListComments([]);
      nock("https://api.github.com")
        .post("/repos/mheap/missing-repo/issues/28/comments", {
          body: `${matchToken}Mode: exactly, Count: 1, Error String: exactly, Provided: enhancement, bug, Applied: enhancement, bug`,
        })
        .reply(201);

      await action();
    });
  });
});

function mockPr(env) {
  return mockEvent(
    "pull_request",
    {
      action: "opened",
      pull_request: {
        number: 28,
        labels: [],
      },
    },
    env,
  );
}

function mockLabels(labels) {
  nock("https://api.github.com")
    .get("/repos/mheap/missing-repo/issues/28/labels")
    .reply(
      200,
      labels.map((name) => {
        return { name };
      }),
    );
}

function mockListComments(comments) {
  nock("https://api.github.com")
    .get("/repos/mheap/missing-repo/issues/28/comments")
    .reply(
      200,
      comments.map((c) => {
        return { body: c.body, id: c.id };
      }),
    );
}

function mockEvent(eventName, mockPayload, additionalParams = {}) {
  github.context.payload = mockPayload;

  const params = {
    GITHUB_EVENT_NAME: eventName,
    GITHUB_EVENT_PATH: "/github/workspace/event.json",
    ...additionalParams,
  };

  const r = mockedEnv(params);
  return r;
}
