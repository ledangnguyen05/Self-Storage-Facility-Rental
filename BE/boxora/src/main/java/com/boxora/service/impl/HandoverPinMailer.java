package com.boxora.service.impl;

import com.boxora.service.EmailService;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Sends the handover PIN mail once the check-in transaction has committed, on a worker thread.
 *
 * <p>The SMTP round trip used to run inside the check-in request, so a slow mail server kept the booking and unit rows
 * locked and made the staff member wait. Here the request only queues the mail; a failure is logged and the staff member
 * can resend from the PIN screen, which reports the real SMTP outcome.
 */
@Component
@Slf4j
public class HandoverPinMailer {

    private final EmailService emailService;
    private final ExecutorService executor;

    @Autowired
    public HandoverPinMailer(EmailService emailService) {
        this(emailService, Executors.newFixedThreadPool(2, new ThreadFactory() {
            private final AtomicInteger counter = new AtomicInteger();

            @Override
            public Thread newThread(Runnable runnable) {
                Thread thread = new Thread(runnable, "handover-pin-mail-" + counter.incrementAndGet());
                thread.setDaemon(true);
                return thread;
            }
        }));
    }

    /** For tests: a same-thread executor makes the send observable. */
    public HandoverPinMailer(EmailService emailService, ExecutorService executor) {
        this.emailService = emailService;
        this.executor = executor;
    }

    /**
     * Queues the mail. Inside a transaction it is released only after the commit (nothing is sent when the check-in
     * rolls back); outside one it is queued right away.
     */
    public void sendAfterCommit(String to, String subject, String html, String bookingCode) {
        Runnable send = () -> {
            try {
                emailService.sendNow(to, subject, html);
                log.info("[CHECK_IN] Handover PIN email sent for booking {}", bookingCode);
            } catch (Exception e) {
                log.warn("[CHECK_IN] Could not send handover PIN email for booking {}: {}", bookingCode, e.getMessage());
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    executor.execute(send);
                }
            });
        } else {
            executor.execute(send);
        }
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
    }
}
