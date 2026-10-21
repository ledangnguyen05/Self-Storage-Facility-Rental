package com.boxora.service.impl;

import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/**
 * JavaMail resolves this machine's canonical host name for the EHLO greeting on EVERY connection unless
 * {@code mail.smtp.localhost} is set. On Windows that reverse lookup blocks for about five seconds, which made
 * every OTP / PIN / reset mail slow. The configured name must be announced instead.
 */
class SmtpHelloNameTest {

    @Test
    @DisplayName("application.properties khai báo tên EHLO (mail.smtp.localhost), quitwait=false và các timeout")
    void mailPropertiesAvoidTheHostNameLookup() throws IOException {
        Properties properties = new Properties();
        try (InputStream in = getClass().getResourceAsStream("/application.properties")) {
            assertNotNull(in);
            properties.load(new InputStreamReader(in, StandardCharsets.UTF_8));
        }
        assertTrue(properties.getProperty("spring.mail.properties.mail.smtp.localhost", "").contains("MAIL_SMTP_LOCALHOST"));
        assertTrue(properties.getProperty("spring.mail.properties.mail.host", "").contains("MAIL_SMTP_LOCALHOST"),
                "mail.host stops the Message-ID suffix from triggering the same lookup");
        assertEquals("false", properties.getProperty("spring.mail.properties.mail.smtp.quitwait"));
        assertNotNull(properties.getProperty("spring.mail.properties.mail.smtp.connectiontimeout"));
        assertNotNull(properties.getProperty("spring.mail.properties.mail.smtp.timeout"));
        assertNotNull(properties.getProperty("spring.mail.properties.mail.smtp.writetimeout"));
    }

    @Test
    @DisplayName("Thư gửi qua SMTP công bố đúng tên EHLO / Message-ID đã cấu hình (không tra cứu tên máy) và vẫn được giao đủ")
    void configuredNameIsAnnouncedInEhlo() throws Exception {
        try (ServerSocket server = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
            CompletableFuture<List<String>> transcript = CompletableFuture.supplyAsync(() -> serveOneMessage(server));

            JavaMailSenderImpl sender = new JavaMailSenderImpl();
            sender.setHost("127.0.0.1");
            sender.setPort(server.getLocalPort());
            Properties props = new Properties();
            props.put("mail.smtp.auth", "false");
            props.put("mail.smtp.starttls.enable", "false");
            props.put("mail.smtp.localhost", "boxora-app.test");
            props.put("mail.host", "boxora-app.test");
            props.put("mail.smtp.quitwait", "false");
            props.put("mail.smtp.connectiontimeout", "3000");
            props.put("mail.smtp.timeout", "3000");
            sender.setJavaMailProperties(props);

            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom("no-reply@boxora.test");
            helper.setTo("khach@example.test");
            helper.setSubject("Mã OTP");
            helper.setText("<p>123456</p>", true);

            long start = System.nanoTime();
            sender.send(message);
            long elapsedMs = (System.nanoTime() - start) / 1_000_000L;

            List<String> lines = transcript.get(5, TimeUnit.SECONDS);
            assertTrue(lines.stream().anyMatch(l -> l.equalsIgnoreCase("EHLO boxora-app.test")), lines.toString());
            assertTrue(lines.stream().anyMatch(l -> l.startsWith("RCPT TO:<khach@example.test>")), lines.toString());
            assertTrue(lines.stream().anyMatch(l -> l.toLowerCase().startsWith("message-id:") && l.contains("@boxora-app.test>")),
                    lines.toString());
            assertTrue(elapsedMs < 3000, "sending took " + elapsedMs + " ms");
        }
    }

    /** Minimal SMTP responder: greets, accepts one message, remembers every command line it received. */
    private static List<String> serveOneMessage(ServerSocket server) {
        List<String> received = new ArrayList<>();
        try (Socket socket = server.accept();
             BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
             OutputStream out = socket.getOutputStream()) {
            reply(out, "220 fake.smtp ready");
            String line;
            boolean inData = false;
            while ((line = in.readLine()) != null) {
                if (inData) {
                    if (line.toLowerCase().startsWith("message-id:")) {
                        received.add(line);
                    }
                    if (".".equals(line)) {
                        inData = false;
                        reply(out, "250 queued");
                    }
                    continue;
                }
                received.add(line);
                String upper = line.toUpperCase();
                if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
                    reply(out, "250 fake.smtp");
                } else if (upper.startsWith("DATA")) {
                    inData = true;
                    reply(out, "354 go ahead");
                } else if (upper.startsWith("QUIT")) {
                    reply(out, "221 bye");
                    break;
                } else {
                    reply(out, "250 ok");
                }
            }
        } catch (IOException e) {
            received.add("IO error: " + e.getMessage());
        }
        return received;
    }

    private static void reply(OutputStream out, String line) throws IOException {
        out.write((line + "\r\n").getBytes(StandardCharsets.UTF_8));
        out.flush();
    }
}
