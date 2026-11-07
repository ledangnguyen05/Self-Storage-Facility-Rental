
# Stage 1: Build Spring Boot application
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn -B -DskipTests clean package

# Stage 2: Run application
FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=build /app/target/boxora-backend-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 10000

ENTRYPOINT ["sh", "-c", "java -Dserver.address=0.0.0.0 -Dserver.port=${PORT:-10000} -jar /app/app.jar"]
