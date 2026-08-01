/**
 * Encryption Utility for Chrome Storage
 * Encrypts and decrypts sensitive data (tokens) using Chrome's storage encryption
 */

/**
 * Generate encryption key (one-time, stored securely)
 */
async function generateKey() {
    const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true, // extractable
        ['encrypt', 'decrypt']
    );
    return key;
}

/**
 * Get or create encryption key
 */
async function getEncryptionKey() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['_encryption_key'], async (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }

            if (result._encryption_key) {
                try {
                    // Import the stored key
                    const key = await crypto.subtle.importKey(
                        'jwk',
                        result._encryption_key,
                        { name: 'AES-GCM' },
                        true,
                        ['encrypt', 'decrypt']
                    );
                    resolve(key);
                } catch (error) {
                    reject(error);
                }
            } else {
                try {
                    // Generate new key
                    const key = await generateKey();
                    
                    // Export and store key
                    const keyJwk = await crypto.subtle.exportKey('jwk', key);
                    chrome.storage.local.set({ '_encryption_key': keyJwk }, () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(key);
                        }
                    });
                } catch (error) {
                    reject(error);
                }
            }
        });
    });
}

/**
 * Encrypt data
 */
async function encryptData(data) {
    try {
        const key = await getEncryptionKey();
        
        // Convert data to JSON string, then to Uint8Array
        const dataString = JSON.stringify(data);
        const encoder = new TextEncoder();
        const dataBytes = encoder.encode(dataString);
        
        // Generate random IV
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        // Encrypt
        const encryptedBytes = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            dataBytes
        );
        
        // Combine IV + encrypted data and convert to base64
        const combined = new Uint8Array(iv.length + encryptedBytes.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encryptedBytes), iv.length);
        
        const base64 = btoa(String.fromCharCode.apply(null, combined));
        
        return {
            encrypted: true,
            data: base64,
            algorithm: 'AES-GCM',
            timestamp: Date.now()
        };
    } catch (error) {
        console.error('[Encryption] Encrypt error:', error);
        throw error;
    }
}

/**
 * Decrypt data
 */
async function decryptData(encryptedData) {
    try {
        if (!encryptedData.encrypted || !encryptedData.data) {
            throw new Error('Invalid encrypted data format');
        }

        const key = await getEncryptionKey();
        
        // Decode base64
        const binaryString = atob(encryptedData.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Extract IV and encrypted data
        const iv = bytes.slice(0, 12);
        const encryptedBytes = bytes.slice(12);
        
        // Decrypt
        const decryptedBytes = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encryptedBytes
        );
        
        // Convert back to string
        const decoder = new TextDecoder();
        const dataString = decoder.decode(decryptedBytes);
        
        // Parse JSON
        return JSON.parse(dataString);
    } catch (error) {
        console.error('[Encryption] Decrypt error:', error);
        throw error;
    }
}

/**
 * Store encrypted data in Chrome storage
 */
async function storeEncrypted(key, data) {
    try {
        const encrypted = await encryptData(data);
        return new Promise((resolve, reject) => {
            const storageData = {};
            storageData[key] = encrypted;
            
            chrome.storage.sync.set(storageData, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(true);
                }
            });
        });
    } catch (error) {
        console.error('[Encryption] Store error:', error);
        throw error;
    }
}

/**
 * Retrieve and decrypt data from Chrome storage
 */
async function retrieveEncrypted(key) {
    try {
        return new Promise(async (resolve, reject) => {
            chrome.storage.sync.get([key], async (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }

                if (!result[key]) {
                    resolve(null);
                    return;
                }

                try {
                    const decrypted = await decryptData(result[key]);
                    resolve(decrypted);
                } catch (error) {
                    reject(error);
                }
            });
        });
    } catch (error) {
        console.error('[Encryption] Retrieve error:', error);
        throw error;
    }
}

/**
 * Clear encrypted data from Chrome storage
 */
async function clearEncrypted(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.remove([key], () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(true);
            }
        });
    });
}

// Export functions
window.EncryptionUtils = {
    encryptData,
    decryptData,
    storeEncrypted,
    retrieveEncrypted,
    clearEncrypted,
    getEncryptionKey
};
