import {StyleSheet} from "react-native";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    content: {
        flex: 1,
        justifyContent: "flex-start",
        alignItems: "flex-start",
        paddingHorizontal: 20,
        paddingTop: 30,
    },
    versionTag: {
        backgroundColor: "#e0f7fa",
        paddingVertical: 6,
        paddingHorizontal: 15,
        borderRadius: 20,
        marginBottom: 15,
    },
    versionText: {
        color: "#007BFF",
        fontSize: 14,
        fontWeight: "600",
    },
    headline: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#333",
        textAlign: "left",
        marginBottom: 15,
        letterSpacing: 1,
    },
    highlight: {
        color: "#3bdcf1",
        fontWeight: "bold",
    },
    description: {
        fontSize: 14,
        color: "#555",
        textAlign: "left",
        marginBottom: 20,
        lineHeight: 20,
    },
    topicsContainer: {
        marginBottom: 20,
        width: "100%",
    },
    topicBlock: {
        marginBottom: 15,
    },
    topicHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 5,
    },
    topicIcon: {
        width: 20,
        height: 20,
        marginRight: 8,
        resizeMode: "contain",
    },
    topicTitle: {
        fontSize: 15,
        fontWeight: "bold",
        color: "#333",
    },
    topicDescription: {
        fontSize: 13,
        color: "#555",
        lineHeight: 18,
    },
    imagePlaceholder: {
        width: "100%",
        height: 150,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#fff",
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 30,
        overflow: "hidden",
    },
    homeImage: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
        backgroundColor: "#fff",
    },
    loginButton: {
        backgroundColor: "#3bdcf1",
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 10,
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
        alignSelf: "flex-start",
    },
    loginButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
});

export default styles;

