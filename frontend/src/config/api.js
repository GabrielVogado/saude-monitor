import Constants from "expo-constants";
import {Platform} from "react-native";

const DEFAULT_PORT = "8080";

const getExpoHost = () => {
    const hostUri =
        Constants.expoConfig?.hostUri ||
        Constants.expoGoConfig?.debuggerHost ||
        Constants.manifest2?.extra?.expoGo?.debuggerHost;

    if (!hostUri || typeof hostUri !== "string") {
        return null;
    }

    return hostUri.split(":")[0] || null;
};

const getPlatformDefaultApiBaseUrl = () => {
    if (Platform.OS === "android") {
        // Android emulator cannot access host localhost directly.
        return `http://10.0.2.2:${DEFAULT_PORT}`;
    }

    if (Platform.OS === "web") {
        return `http://localhost:${DEFAULT_PORT}`;
    }

    const expoHost = getExpoHost();

    if (expoHost) {
        return `http://${expoHost}:${DEFAULT_PORT}`;
    }

    return `http://localhost:${DEFAULT_PORT}`;
};

const DEFAULT_API_BASE_URL = getPlatformDefaultApiBaseUrl();

const getApiBaseUrl = () => {
    const extra = Constants.expoConfig?.extra || {};
    const configuredApiBaseUrl =
        (Platform.OS === "android" && extra.apiBaseUrlAndroid) ||
        (Platform.OS === "ios" && extra.apiBaseUrlIos) ||
        (Platform.OS === "web" && extra.apiBaseUrlWeb) ||
        extra.apiBaseUrl ||
        DEFAULT_API_BASE_URL;

    return configuredApiBaseUrl.replace(/\/+$/, "");
};

const buildApiUrl = (path) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    return `${getApiBaseUrl()}${normalizedPath}`;
};

export {DEFAULT_API_BASE_URL, getApiBaseUrl, buildApiUrl};

