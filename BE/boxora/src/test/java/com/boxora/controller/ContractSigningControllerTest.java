package com.boxora.controller;

import com.boxora.config.DocuSealConfig;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.service.ContractOtpService;
import com.boxora.service.ContractRenewalService;
import com.boxora.service.ContractSigningService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContractSigningControllerTest {

    @Mock private ContractSigningService contractSigningService;
    @Mock private ContractOtpService contractOtpService;
    @Mock private ContractRenewalService contractRenewalService;
    @Mock private DocuSealConfig docuSealConfig;

    @InjectMocks
    private ContractSigningController controller;

    @Test
    void docuSealWebhookRejectsWhenSecretIsNotConfigured() {
        when(docuSealConfig.getWebhookToken()).thenReturn(" ");

        AppException exception = assertThrows(AppException.class, () -> controller.docusealWebhook(
                null, null, null, Map.<String, Object>of("event_type", "form.completed")));

        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_SIGNING_INVALID_WEBHOOK_TOKEN);
        verifyNoInteractions(contractSigningService);
    }

    @Test
    void docuSealWebhookRejectsWrongTokenAndAcceptsConfiguredToken() {
        when(docuSealConfig.getWebhookToken()).thenReturn("secret-value");
        Map<String, Object> payload = Map.of("event_type", "form.completed");

        assertThrows(AppException.class, () -> controller.docusealWebhook(null, "wrong", null, payload));
        verifyNoInteractions(contractSigningService);

        controller.docusealWebhook(null, "secret-value", null, payload);
        verify(contractSigningService).handleWebhook(payload);
    }
}
