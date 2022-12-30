const action = require(".");
const core = require("@actions/core");
const github = require("@actions/github");

const mockedEnv = require("mocked-env");
const nock = require("nock");
nock.disableNetConnect();

describe("Required Labels", () => {
  let restore;
  let restoreTest;
  beforeEach(() => {
    restore = mockedEnv({
      GITHUB_WORKFLOW: "demo-workflow",
      GITHUB_ACTION: "required-labels",
      GITHUB_ACTOR: "mheap",
      GITHUB_REPOSITORY: "mheap/missing-repo",
      GITHUB_WORKSPACE: "/github/workspace",
      GITHUB_SHA: "e21490305ed7ac0897b7c7c54c88bb47f7a6d6c4",
      GITHUB_EVENT_NAME: "",
      GITHUB_EVENT_PATH: "",
      INPUT_TOKEN: "this_is_invalid",
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
          nock.pendingMocks()
        )}`
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
      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "success");
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
        "Label error. Requires exactly 1 of: enhancement. Found: bug"
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

      nock("https://api.github.com")
        .post("/repos/mheap/missing-repo/issues/28/comments", {
          body: "Label error. Requires exactly 1 of: enhancement. Found: bug",
        })
        .reply(201);

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

      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "success");
    });

    it("at least X", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement,bug,triage",
        INPUT_MODE: "minimum",
        INPUT_COUNT: "2",
      });
      mockLabels(["enhancement", "bug"]);

      await action();

      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "success");
    });

    it("at most X", async () => {
      restoreTest = mockPr({
        INPUT_LABELS: "enhancement,bug,triage",
        INPUT_MODE: "maximum",
        INPUT_COUNT: "2",
      });

      mockLabels(["enhancement", "bug"]);

      await action();

      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "success");
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
        "Label error. Requires exactly 1 of: enhancement, bug. Found: enhancement, bug"
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
        "Label error. Requires at least 2 of: enhancement, bug, triage. Found: enhancement"
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
        "Label error. Requires at most 2 of: enhancement, bug, triage. Found: enhancement, triage, bug"
      );
    });
  });

  describe("validation", () => {
    it("missing INPUT_MODE", async () => {
      restoreTest = mockPr({});

      await action();

      expect(core.setFailed).toBeCalledTimes(1);
      expect(core.setFailed).toBeCalledWith(
        "Input required and not supplied: mode"
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
        "Input required and not supplied: count"
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
        "Input required and not supplied: labels"
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
        "Unknown mode input [bananas]. Must be one of: exactly, minimum, maximum"
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
        "Unknown exit_code input [other]. Must be one of: success, failure"
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
      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "success");
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
        "Label error. Requires exactly 1 of: enhancement, bug. Found: enhancement, bug"
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
        "Label error. Requires exactly 1 of: enhancement, bug. Found: enhancement, bug"
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
        "Label error. Requires exactly 1 of: enhancement, bug. Found: enhancement, bug"
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
        "Label error. Requires exactly 1 of: enhancement, bug. Found: enhancement, bug"
      );
    });

    it("adds a comment when add_comment is true", async () => {
      restoreTest = mockPr({
        GITHUB_TOKEN: "abc123",
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        INPUT_ADD_COMMENT: "true",
      });

      mockLabels(["enhancement", "bug"]);

      nock("https://api.github.com")
        .post("/repos/mheap/missing-repo/issues/28/comments", {
          body: "Label error. Requires exactly 1 of: enhancement, bug. Found: enhancement, bug",
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
    env
  );
}

function mockLabels(labels) {
  nock("https://api.github.com")
    .get("/repos/mheap/missing-repo/issues/28/labels")
    .reply(
      200,
      labels.map((name) => {
        return { name };
      })
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
