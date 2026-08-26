package br.com.saude_monitor.api;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Teste de contexto da aplicação.
 *
 * <p>Usa um MongoDB em container (Testcontainers) para que o contexto Spring carregue sem
 * depender de infraestrutura externa. O container é iniciado automaticamente e a URI é
 * injetada via {@link DynamicPropertySource}.</p>
 */
@Testcontainers
@SpringBootTest
class SaudeMonitorApplicationTests {

	@Container
	static final MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

	@DynamicPropertySource
	static void mongoProperties(DynamicPropertyRegistry registry) {
		registry.add("spring.mongodb.uri", mongo::getReplicaSetUrl);
	}

	@Test
	void contextLoads() {
	}

}
