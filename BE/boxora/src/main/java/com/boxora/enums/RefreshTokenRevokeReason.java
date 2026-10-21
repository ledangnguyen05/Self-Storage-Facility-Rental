package com.boxora.enums;

/**
 * Why a refresh / reset token was revoked. Only {@link #ROTATED} makes a later reuse of the token a sign of
 * theft: the legitimate client threw that token away when it received its successor. Every other reason
 * (sign-out, session cap, password change, lock) is an ordinary end of a session, so presenting such a token
 * again is just a stale client and must not revoke the user's other devices.
 */
public enum RefreshTokenRevokeReason {
    /** Exchanged for a new token during a refresh. */
    ROTATED,
    /** The user signed out. */
    LOGOUT,
    /** The oldest session was dropped because the user is signed in on more devices than allowed. */
    SESSION_LIMIT,
    /** Password changed or reset: every session of the account ends. */
    PASSWORD_CHANGED,
    /** The account was locked by an administrator. */
    ACCOUNT_LOCKED,
    /** A rotated token was presented again after the grace window: all sessions were dropped as a precaution. */
    REPLAY_DETECTED,
    /** The token's lifetime ran out. */
    EXPIRED,
    /** A newer reset token replaced it, or it was consumed. */
    SUPERSEDED
}
