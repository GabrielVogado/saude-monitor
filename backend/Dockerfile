FROM eclipse-temurin:25-jdk AS builder
WORKDIR /app

COPY gradlew gradlew
COPY gradle gradle
COPY settings.gradle build.gradle ./
COPY src src

RUN sed -i 's/\r$//' gradlew && chmod +x gradlew
RUN ./gradlew --no-daemon clean bootJar

FROM eclipse-temurin:25-jre
WORKDIR /app

# SEG-06: a aplicação roda com um usuário sem privilégio, e não como root. Uma falha de
# execução remota numa biblioteca fica presa a esse usuário, sem escrita no sistema.
# O curl que ficava aqui servia só ao deploy da Oracle Cloud, que não existe mais: saiu,
# para não deixar ferramenta de rede à mão dentro do contêiner.
RUN useradd --system --uid 10001 --user-group --no-create-home --shell /usr/sbin/nologin app

COPY --from=builder /app/build/libs/*.jar app.jar

# Dados do seed de estabelecimentos (DBF + SHP) lidos no startup (app.seed.path=data/).
COPY data data

EXPOSE 8080

USER 10001:10001

ENTRYPOINT ["java", "-jar", "/app/app.jar"]

