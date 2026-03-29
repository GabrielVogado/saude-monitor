import {StyleSheet} from "react-native";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: "#fff",
        justifyContent: "flex-start",
    },
    imageContainer: {
        alignItems: "center",
        marginBottom: 15,
    },
    doctorImage: {
        width: 120,
        height: 120,
        resizeMode: "contain",
    },
    title: {
        fontSize: 22,
        fontWeight: "bold",
        marginBottom: 5,
        textAlign: "center",
        color: "#333",
    },
    subtitle: {
        fontSize: 14,
        marginBottom: 20,
        textAlign: "center",
        color: "#666",
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 10,
        marginBottom: 15,
        paddingHorizontal: 10,
        height: 50,
    },
    icon: {
        width: 24,
        height: 24,
        marginRight: 10,
        tintColor: "#333",
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: "#333",
    },
    optionsContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    checkboxContainer: {
        flexDirection: "row",
        alignItems: "center",
    },
    checkbox: {
        fontSize: 18,
        marginRight: 5,
    },
    optionText: {
        fontSize: 14,
        color: "#333",
    },
    link: {
        fontSize: 14,
        color: "#007BFF",
        textDecorationLine: "underline",
    },
    loginButton: {
        backgroundColor: "#007BFF",
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: "center",
        marginBottom: 20,
    },
    loginButtonDisabled: {
        opacity: 0.6,
    },
    loginButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
    lgpdText: {
        fontSize: 12,
        color: "#666",
        textAlign: "center",
        marginTop: 10,
    },
});

export default styles;

