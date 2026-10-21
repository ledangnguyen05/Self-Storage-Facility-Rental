package com.boxora.service;

import com.boxora.dto.response.OccupancyReportResponse;
import com.boxora.dto.response.OverdueDebtReportResponse;
import com.boxora.dto.response.PaymentChannelReportResponse;
import com.boxora.dto.response.RevenueReportResponse;
import com.boxora.dto.response.RevenueTrendResponse;

import java.time.LocalDate;
import java.util.UUID;

public interface ReportService {
    RevenueReportResponse getRevenueReport(LocalDate fromDate, LocalDate toDate);

    /** Net cash revenue of the period (collected minus refunded), per facility and for the whole scope. */
    RevenueReportResponse getRevenueReport(LocalDate fromDate, LocalDate toDate, UUID facilityId);

    /** Monthly revenue of the period, split by payment type, filtered on the server. */
    RevenueTrendResponse getRevenueTrend(LocalDate fromDate, LocalDate toDate, UUID facilityId);

    /** Paid payments of the period grouped by payment channel, filtered on the server. */
    PaymentChannelReportResponse getPaymentChannels(LocalDate fromDate, LocalDate toDate, UUID facilityId);

    OccupancyReportResponse getOccupancyReport();
    OccupancyReportResponse getOccupancyReport(UUID facilityId);

    OverdueDebtReportResponse getOverdueDebtReport(UUID facilityId);

    /** Emails the customer of an overdue contract and fails (instead of pretending) when nothing could be sent. */
    void sendOverdueReminder(UUID contractId);
}
