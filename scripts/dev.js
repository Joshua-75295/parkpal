const { spawn } = require("child_process");

const processes = [
  { name: "server", prefix: "server", script: "dev" },
  { name: "client", prefix: "client", script: "dev" },
];
const children = [];
let shuttingDown = false;

const shutdown = (code = 0) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGINT");
    }
  }

  setTimeout(() => {
    process.exit(code);
  }, 200);
};

for (const processConfig of processes) {
  const command =
    process.platform === "win32"
      ? "cmd.exe"
      : "npm";
  const args =
    process.platform === "win32"
      ? [
          "/d",
          "/s",
          "/c",
          `npm --prefix ${processConfig.prefix} run ${processConfig.script}`,
        ]
      : ["--prefix", processConfig.prefix, "run", processConfig.script];

  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    if (shuttingDown) {
      return;
    }

    if (code && code !== 0) {
      console.error(
        `${processConfig.name} process exited with code ${code}`
      );
      shutdown(code);
    }
  });

  child.on("error", (error) => {
    console.error(
      `Failed to start ${processConfig.name} process:`,
      error.message
    );
    shutdown(1);
  });

  children.push(child);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
