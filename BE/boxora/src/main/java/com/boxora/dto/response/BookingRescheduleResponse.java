package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BookingRescheduleResponse {
    private BookingResponse booking;
    private BookingRescheduleHistoryResponse historyRecord;
    private String message;

    public static BookingRescheduleResponseBuilder builder() {
        return new BookingRescheduleResponseBuilder();
    }

    public static class BookingRescheduleResponseBuilder {
        private BookingResponse booking;
        private BookingRescheduleHistoryResponse historyRecord;
        private String message;

        BookingRescheduleResponseBuilder() {}

        public BookingRescheduleResponseBuilder booking(BookingResponse booking) {
            this.booking = booking;
            return this;
        }

        public BookingRescheduleResponseBuilder historyRecord(BookingRescheduleHistoryResponse historyRecord) {
            this.historyRecord = historyRecord;
            return this;
        }

        public BookingRescheduleResponseBuilder message(String message) {
            this.message = message;
            return this;
        }

        public BookingRescheduleResponse build() {
            return new BookingRescheduleResponse(booking, historyRecord, message);
        }
    }
}
