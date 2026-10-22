package com.boxora.event;

import java.util.UUID;

public record BookingCreatedEvent(UUID bookingId) {
}
