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

# curl serve ao healthcheck do container no deploy da Oracle Cloud
# (deploy/oracle/docker-compose.yml) e a diagnostico dentro da VM.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/build/libs/*.jar app.jar

# Dados do seed de estabelecimentos (DBF + SHP) lidos no startup (app.seed.path=data/).
COPY data data

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]

