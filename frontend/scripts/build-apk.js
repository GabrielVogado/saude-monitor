const {spawnSync} = require("child_process");

const CLOUD_RUN_API_BASE_URL = "https://saude-monitor-backend-dev-uly57kmmia-rj.a.run.app";

process.env.EXPO_PUBLIC_API_BASE_URL =
    process.env.EXPO_PUBLIC_API_BASE_URL || CLOUD_RUN_API_BASE_URL;

console.log(`EXPO_PUBLIC_API_BASE_URL=${process.env.EXPO_PUBLIC_API_BASE_URL}`);

const result = spawnSync(
    "npx",
    ["expo", "run:android", "--variant", "release"],
    {stdio: "inherit", shell: true}
);

process.exit(result.status ?? 1);
