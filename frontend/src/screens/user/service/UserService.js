import {buildApiUrl} from "../../../config/api";

class UserService {
	static async cadastro({fullName, email, password, phone}) {
		const payload = {
			fullName: fullName?.trim() || "",
			email: email?.trim() || "",
			password: password || "",
			phone: phone?.trim() || "",
		};

		const cadastroUrl = buildApiUrl("/api/user/cadastro");

		let response;

		try {
			response = await fetch(cadastroUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});
		} catch (error) {
			if (error.message === "Network request failed") {
				throw new Error(`Nao foi possivel conectar ao backend em ${cadastroUrl}. Verifique API, URL e rede.`);
			}

			throw error;
		}

		const rawResponseBody = await response.text();
		let responseData = null;

		if (rawResponseBody) {
			try {
				responseData = JSON.parse(rawResponseBody);
			} catch {
				responseData = null;
			}
		}

		if (!response.ok || responseData?.success === false) {
			const message = responseData?.message || `Falha ao realizar cadastro (HTTP ${response.status})`;
			const fieldErrors = responseData && responseData.errors
				? `\n${Object.values(responseData.errors).join("\n")}`
				: "";
			throw new Error(`${message}${fieldErrors}`);
		}

		return responseData;
	}
}

export default UserService;


