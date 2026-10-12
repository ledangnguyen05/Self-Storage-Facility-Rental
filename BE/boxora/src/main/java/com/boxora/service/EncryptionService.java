package com.boxora.service;

public interface EncryptionService {
    /**
     * Encrypts plain text using AES-256-GCM authenticated encryption.
     *
     * @param plainText the plain text string (e.g. 6-digit access PIN)
     * @return Base64 encoded string containing IV + ciphertext + authentication tag
     */
    String encrypt(String plainText);

    /**
     * Decrypts Base64 encoded AES-256-GCM ciphertext back to plain text.
     * Gracefully returns original string if legacy unencrypted or invalid.
     *
     * @param cipherText Base64 encoded ciphertext
     * @return decrypted plain text
     */
    String decrypt(String cipherText);
}
