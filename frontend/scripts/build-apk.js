const {spawnSync} = require("child_process");

const RENDER_API_BASE_URL = "https://saude-monitor.onrender.com";

process.env.EXPO_PUBLIC_API_BASE_URL =
    process.env.EXPO_PUBLIC_API_BASE_URL || RENDER_API_BASE_URL;

console.log(`EXPO_PUBLIC_API_BASE_URL=${process.env.EXPO_PUBLIC_API_BASE_URL}`);

const result = spawnSync(
    "npx",
    ["expo", "run:android", "--variant", "release"],
    {stdio: "inherit", shell: true}
);

process.exit(result.status ?? 1);
