import {buildApiUrl} from "../../../config/api";

class UserService {
	/**
	 * Cria a conta opcional (E5-04) em {@code POST /api/v1/auth/registro} (§3.1).
	 * O consentimento LGPD é obrigatório (termos de uso com versão vigente).
	 */
	static async registro({fullName, email, password, phone, consentimento}) {
		const payload = {
			fullName: fullName?.trim() || "",
			email: email?.trim() || "",
			password: password || "",
			phone: phone?.trim() || "",
			consentimento: {
				termosUso: consentimento?.termosUso === true,
				versaoTermos: consentimento?.versaoTermos || "1.0",
			},
		};

		const cadastroUrl = buildApiUrl("/api/v1/auth/registro");

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


