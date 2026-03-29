import {buildApiUrl} from "../../../config/api";

class LoginService {
    static async login({email, password, rememberDevice}) {
        const loginData = {
            email: email?.trim() || "",
            password: password || "",
            rememberDevice: Boolean(rememberDevice),
        };
        const loginUrl = buildApiUrl("/api/auth/login");

        let response;

        try {
            response = await fetch(loginUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(loginData),
            });
        } catch (error) {
            if (error.message === "Network request failed") {
                throw new Error(`Nao foi possivel conectar ao backend em ${loginUrl}. Verifique API, URL e rede.`);
            }

            throw error;
        }

        const responseData = await response.json();

        if (!response.ok) {
            const message = responseData?.message || "Falha ao realizar login";
            const fieldErrors = responseData?.errors
                ? `\n${Object.values(responseData.errors).join("\n")}`
                : "";
            throw new Error(`${message}${fieldErrors}`);
        }

        return responseData;
    }
}

export default LoginService;

