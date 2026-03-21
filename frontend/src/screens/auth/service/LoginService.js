class LoginService {
    static login({email, password, rememberDevice}) {
        const loginData = {
            email: email?.trim() || "",
            password: password || "",
            rememberDevice: Boolean(rememberDevice),
        };

        console.log("Dados recebidos no LoginService:", loginData);

        return loginData;
    }
}

export default LoginService;

