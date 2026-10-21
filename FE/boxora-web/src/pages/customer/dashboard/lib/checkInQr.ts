/** QR payload the staff scanner understands (contract 6 with the handover desk): `BOXORA-CHECKIN:<bookingCode>`. */
export const checkInQrPayload = (bookingCode: string) => `BOXORA-CHECKIN:${bookingCode}`
