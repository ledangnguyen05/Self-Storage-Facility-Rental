package com.boxora.service;

/**
 * Clears the overdue lockout of a rental contract once its debt is settled (contract 3).
 *
 * <p>Implemented by the overdue domain ({@code com.boxora.service.impl.AccessRestorationServiceImpl}):
 * the contract goes back to ACTIVE when nothing is outstanding, the booking to ACTIVE, the unit to
 * OCCUPIED, a new PIN / QR is issued and the activity is logged. The payment / renewal flows call it
 * after a successful payment that settles an OVERDUE or OVERDUE_LOCKED contract; the manager
 * "Mở khóa truy cập" action calls it too.
 */
public interface AccessRestorationService {

    void restoreAccessAfterSettlement(java.util.UUID contractId, String reason);
}
