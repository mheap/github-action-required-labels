const { Toolkit } = require("actions-toolkit");
const core = require("@actions/core");
const mockedEnv = require("mocked-env");
const nock = require("nock");
nock.disableNetConnect();

describe("Required Labels", () => {
  let action, tools;

  // Mock Toolkit.run to define `action` so we can call it
  Toolkit.run = jest.fn((actionFn) => {
    action = actionFn;
  });

  // Load up our entrypoint file
  require(".");

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
    });

    tools = new Toolkit();
    tools.context.loadPerTestEnv = function () {
      this.payload = process.env.GITHUB_EVENT_PATH
        ? require(process.env.GITHUB_EVENT_PATH)
        : {};
      this.event = process.env.GITHUB_EVENT_NAME;
    };
    tools.exit.success = jest.fn();
    tools.exit.failure = jest.fn();
    tools.exit.neutral = jest.fn();
    core.setOutput = jest.fn();
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
      restoreTest = mockPr(tools, [], {
        INPUT_LABELS: "enhancement",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        GITHUB_TOKEN: "mock-token-here-abc",
      });

      nock("https://api.github.com")
        .get("/repos/mheap/missing-repo/issues/28/labels")
        .reply(200, [{ name: "enhancement" }, { name: "bug" }]);

      await action(tools);
      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "success");
      expect(tools.exit.success).toBeCalledTimes(1);
      expect(tools.exit.success).toBeCalledWith("Complete");
    });

    it("fetches the labels from the API (and fails)", async () => {
      restoreTest = mockPr(tools, ["enhancement"], {
        INPUT_LABELS: "enhancement",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        GITHUB_TOKEN: "mock-token-here-abc",
      });

      nock("https://api.github.com")
        .get("/repos/mheap/missing-repo/issues/28/labels")
        .reply(200, [{ name: "bug" }]);

      await action(tools);
      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "failure");
      expect(tools.exit.failure).toBeCalledTimes(1);
      expect(tools.exit.failure).toBeCalledWith(
        "Label error. Requires exactly 1 of: enhancement. Found: bug"
      );
    });

    it("posts a comment when enabled", async () => {
      restoreTest = mockPr(tools, ["enhancement"], {
        INPUT_LABELS: "enhancement",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        INPUT_ADD_COMMENT: "true",
        GITHUB_TOKEN: "mock-token-here-abc",
      });

      nock("https://api.github.com")
        .get("/repos/mheap/missing-repo/issues/28/labels")
        .reply(200, [{ name: "bug" }]);

      nock("https://api.github.com")
        .post("/repos/mheap/missing-repo/issues/28/comments", {
          body: "Label error. Requires exactly 1 of: enhancement. Found: bug",
        })
        .reply(201);

      await action(tools);
      expect(tools.exit.failure).toBeCalledWith(
        "Label error. Requires exactly 1 of: enhancement. Found: bug"
      );
    });
  });

  describe("success", () => {
    it("exact count", () => {
      // Create a new Toolkit instance
      restoreTest = mockPr(tools, ["enhancement"], {
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
      });

      action(tools);
      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "success");
      expect(tools.exit.success).toBeCalledTimes(1);
      expect(tools.exit.success).toBeCalledWith("Complete");
    });

    it("at least X", () => {
      // Create a new Toolkit instance
      restoreTest = mockPr(tools, ["enhancement", "triage"], {
        INPUT_LABELS: "enhancement,bug,triage",
        INPUT_MODE: "minimum",
        INPUT_COUNT: "2",
      });

      action(tools);
      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "success");
      expect(tools.exit.success).toBeCalledTimes(1);
      expect(tools.exit.success).toBeCalledWith("Complete");
    });

    it("at most X", () => {
      // Create a new Toolkit instance
      restoreTest = mockPr(tools, ["enhancement", "triage"], {
        INPUT_LABELS: "enhancement,bug,triage",
        INPUT_MODE: "maximum",
        INPUT_COUNT: "2",
      });

      action(tools);
      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "success");
      expect(tools.exit.success).toBeCalledTimes(1);
      expect(tools.exit.success).toBeCalledWith("Complete");
    });
  });

  describe("failure", () => {
    it("exact count", () => {
      // Create a new Toolkit instance
      restoreTest = mockPr(tools, ["enhancement", "bug"], {
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
      });

      action(tools);
      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "failure");
      expect(tools.exit.failure).toBeCalledTimes(1);
      expect(tools.exit.failure).toBeCalledWith(
        "Label error. Requires exactly 1 of: enhancement, bug. Found: enhancement, bug"
      );
    });

    it("at least X", () => {
      // Create a new Toolkit instance
      restoreTest = mockPr(tools, ["enhancement"], {
        INPUT_LABELS: "enhancement,bug,triage",
        INPUT_MODE: "minimum",
        INPUT_COUNT: "2",
      });

      action(tools);
      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "failure");
      expect(tools.exit.failure).toBeCalledTimes(1);
      expect(tools.exit.failure).toBeCalledWith(
        "Label error. Requires at least 2 of: enhancement, bug, triage. Found: enhancement"
      );
    });

    it("at most X", () => {
      // Create a new Toolkit instance
      restoreTest = mockPr(tools, ["enhancement", "triage", "bug"], {
        INPUT_LABELS: "enhancement,bug,triage",
        INPUT_MODE: "maximum",
        INPUT_COUNT: "2",
      });

      action(tools);
      expect(core.setOutput).toBeCalledTimes(1);
      expect(core.setOutput).toBeCalledWith("status", "failure");
      expect(tools.exit.failure).toBeCalledTimes(1);
      expect(tools.exit.failure).toBeCalledWith(
        "Label error. Requires at most 2 of: enhancement, bug, triage. Found: enhancement, triage, bug"
      );
    });
  });

  describe("validation", () => {
    it("missing INPUT_COUNT", () => {
      restoreTest = mockPr(tools, [], {
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
      });
      action(tools);
      expect(tools.exit.failure).toBeCalledTimes(1);
      expect(tools.exit.failure).toBeCalledWith(
        "[count] input is not provided"
      );
    });

    it("missing INPUT_LABELS", () => {
      restoreTest = mockPr(tools, [], {
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
      });

      action(tools);
      expect(tools.exit.failure).toBeCalledTimes(1);
      expect(tools.exit.failure).toBeCalledWith(
        "[labels] input is empty or not provided"
      );
    });

    it("unknown mode", () => {
      restoreTest = mockPr(tools, [], {
        INPUT_MODE: "bananas",
        INPUT_LABELS: "enhancement,bug",
        INPUT_COUNT: "1",
      });

      action(tools);
      expect(tools.exit.failure).toBeCalledTimes(1);
      expect(tools.exit.failure).toBeCalledWith(
        "Unknown mode input [bananas]. Must be one of: exactly, minimum, maximum"
      );
    });

    it("unknown exit_code", () => {
      restoreTest = mockPr(tools, [], {
        INPUT_MODE: "exactly",
        INPUT_LABELS: "enhancement,bug",
        INPUT_COUNT: "1",
        INPUT_EXIT_TYPE: "other",
      });

      action(tools);
      expect(tools.exit.failure).toBeCalledTimes(1);
      expect(tools.exit.failure).toBeCalledWith(
        "Unknown exit_code input [other]. Must be one of: success, neutral, failure"
      );
    });
  });

  describe("data integrity", () => {
    it("supports spaces in INPUT_LABELS", () => {
      restoreTest = mockPr(tools, ["enhancement"], {
        INPUT_LABELS: "enhancement ,   bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
      });

      action(tools);
      expect(tools.exit.success).toBeCalledTimes(1);
      expect(tools.exit.success).toBeCalledWith("Complete");
    });

    it("fetches labels from the API when provided with a GITHUB_TOKEN", async () => {
      tools.github.issues.listLabelsOnIssue = jest
        .fn()
        .mockReturnValue(Promise.resolve({ data: [{ name: "enhancement" }] }));

      restoreTest = mockPr(tools, ["should_not_be_used"], {
        GITHUB_TOKEN: "this_is_a_test_token",
        INPUT_LABELS: "enhancement ,   bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
      });

      await action(tools);

      expect(tools.github.issues.listLabelsOnIssue).toBeCalledTimes(1);
      expect(tools.github.issues.listLabelsOnIssue).toBeCalledWith({
        issue_number: 28,
        owner: "mheap",
        repo: "missing-repo",
      });

      expect(tools.exit.success).toBeCalledTimes(1);
      expect(tools.exit.success).toBeCalledWith("Complete");
    });
  });

  describe("configurable exit code", () => {
    it("defaults to failure", () => {
      // Create a new Toolkit instance
      restoreTest = mockPr(tools, ["enhancement", "bug"], {
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
      });

      action(tools);
      expect(tools.exit.failure).toBeCalledTimes(1);
      expect(tools.exit.failure).toBeCalledWith(
        "Label error. Requires exactly 1 of: enhancement, bug. Found: enhancement, bug"
      );
    });

    it("explicitly uses failure", () => {
      restoreTest = mockPr(tools, ["enhancement", "bug"], {
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        INPUT_EXIT_TYPE: "failure",
      });

      action(tools);
      expect(tools.exit.failure).toBeCalledTimes(1);
      expect(tools.exit.failure).toBeCalledWith(
        "Label error. Requires exactly 1 of: enhancement, bug. Found: enhancement, bug"
      );
    });

    it("explicitly uses success", () => {
      restoreTest = mockPr(tools, ["enhancement", "bug"], {
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        INPUT_EXIT_TYPE: "success",
      });

      action(tools);
      expect(tools.exit.success).toBeCalledTimes(1);
      expect(tools.exit.success).toBeCalledWith(
        "Label error. Requires exactly 1 of: enhancement, bug. Found: enhancement, bug"
      );
    });

    it("explicitly uses neutral", () => {
      restoreTest = mockPr(tools, ["enhancement", "bug"], {
        INPUT_LABELS: "enhancement,bug",
        INPUT_MODE: "exactly",
        INPUT_COUNT: "1",
        INPUT_EXIT_TYPE: "neutral",
      });

      action(tools);
      expect(tools.exit.neutral).toBeCalledTimes(1);
      expect(tools.exit.neutral).toBeCalledWith(
        "Label error. Requires exactly 1 of: enhancement, bug. Found: enhancement, bug"
      );
    });
  });
});

function mockPr(tools, labels, env) {
  return mockEvent(
    tools,
    "pull_request",
    {
      action: "opened",
      pull_request: {
        number: 28,
        labels: labels.map((name) => {
          return { name };
        }),
      },
    },
    env
  );
}

function mockEvent(tools, eventName, mockPayload, additionalParams = {}) {
  jest.mock(
    "/github/workspace/event.json",
    () => {
      return mockPayload;
    },
    {
      virtual: true,
    }
  );

  const params = {
    GITHUB_EVENT_NAME: eventName,
    GITHUB_EVENT_PATH: "/github/workspace/event.json",
    ...additionalParams,
  };

  const r = mockedEnv(params);
  tools.context.loadPerTestEnv();
  return r;
}
