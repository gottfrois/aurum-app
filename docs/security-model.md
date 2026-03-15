# Bunkr Security Model

## 1. Overview: Zero-Knowledge Encryption

Bunkr uses **zero-knowledge encryption** to protect your financial data. This means that even though Bunkr's servers store your bank accounts, transactions, balances, and investment data, the servers **cannot read any of it**. Your data is encrypted before it is stored and can only be decrypted in your browser, using a passphrase that only you know.

This approach is sometimes called "client-side encryption" or "end-to-end encryption." The key principle is:

> **The server never has access to your plaintext financial data or your decryption keys.**

For a personal finance application that aggregates sensitive banking information, this is an important guarantee. Even if an attacker were to gain access to the database, they would see only encrypted blobs -- not your account numbers, balances, or transaction details.


## 2. Architecture

### 2.1 Cryptographic Primitives

Bunkr's encryption is built on **ECIES** (Elliptic Curve Integrated Encryption Scheme), combining three well-established algorithms:

| Component | Algorithm | Purpose |
|-----------|-----------|---------|
| Key agreement | **X25519** (Curve25519 ECDH) | Two parties derive a shared secret without ever transmitting it |
| Key derivation | **HKDF-SHA256** | Stretches the shared secret into a strong, unique encryption key |
| Encryption | **AES-GCM-256** | Encrypts and authenticates data in a single operation |

**In plain English:**

- **X25519** is a modern elliptic curve that provides high security with excellent performance. It is widely used in TLS 1.3, Signal, WireGuard, and other security-critical systems.
- **HKDF-SHA256** takes the raw shared secret and derives a purpose-specific encryption key from it, ensuring that each encryption operation uses a distinct key even when the same parties are involved.
- **AES-GCM-256** is the gold standard for authenticated encryption. It not only encrypts your data (confidentiality) but also ensures it has not been tampered with (integrity). The "256" means 256-bit keys, which is the highest strength level for AES.

All cryptographic operations use the **Web Crypto API**, a browser-native implementation that is FIPS-compliant and hardware-accelerated on most platforms.


### 2.2 Key Hierarchy

Bunkr uses a layered key hierarchy to separate concerns and enable multi-user access:

```
Passphrase (you memorize this)
    |
    v
[PBKDF2 - 600,000 iterations]
    |
    v
Passphrase-derived AES key
    |
    v  (encrypts/decrypts)
Personal Private Key (X25519)  <-->  Personal Public Key
    |
    v  (decrypts key slot)
Workspace Private Key (X25519)  <-->  Workspace Public Key
    |                                        |
    v  (decrypts data)                       v  (encrypts data)
Your financial data                   Server encrypts during sync
```

**Four layers explained:**

1. **Passphrase**: A password you choose during setup (minimum 8 characters). This is the only secret you need to remember. It is never sent to the server.

2. **Personal key pair**: An X25519 key pair unique to you. The private key is encrypted with your passphrase-derived key and stored on the server in encrypted form. The public key is stored in the clear so that others can encrypt data for you.

3. **Workspace key pair**: An X25519 key pair shared across all authorized members of a workspace. The private key is never stored in the clear -- each member receives a copy encrypted to their personal public key (called a "key slot").

4. **Data encryption keys**: For each encrypted record, a fresh ephemeral key pair is generated. This means every piece of data is encrypted with a unique key, providing forward secrecy.


### 2.3 How the Server Encrypts Without Being Able to Decrypt

When your bank syncs new data, the Bunkr server receives the data from Powens (the banking aggregation provider). The server needs to store this data encrypted, but it only has the workspace **public key** -- never the private key.

This is the core of ECIES: the server can encrypt data using only the public key. Here is how it works:

1. The server generates a temporary (ephemeral) X25519 key pair.
2. It performs a Diffie-Hellman key exchange between the ephemeral private key and the workspace public key to derive a shared secret.
3. It uses HKDF to derive an AES-256 key from that shared secret.
4. It encrypts the data with AES-GCM using the derived key.
5. It stores the encrypted data along with the ephemeral public key.
6. **It discards the ephemeral private key immediately.**

Later, in your browser, you can reverse this process using the workspace private key (which you unlocked with your passphrase) and the stored ephemeral public key.

The server performs the same Diffie-Hellman exchange in reverse, derives the same AES key, and your browser decrypts the data. The server itself can never perform this decryption because it never possesses the workspace private key.


## 3. What Data Is Encrypted

### 3.1 Encrypted Fields by Record Type

| Record Type | Field Group | Encrypted Fields | Plaintext Fields |
|-------------|-------------|-----------------|------------------|
| **Connection** | `encryptedData` | Connector name | Powens connection ID, sync state, last sync date |
| **Bank Account** | `encryptedIdentity` | Account name, account number, IBAN | Account type, currency, disabled/deleted flags, Powens ID |
| **Bank Account** | `encryptedBalance` | Balance | (same record -- type, currency remain visible) |
| **Transaction** | `encryptedDetails` | Wording, original wording, simplified wording, counterparty, card, comment | Date, transaction type, coming/active/deleted flags, Powens ID |
| **Transaction** | `encryptedFinancials` | Value, original value | Original currency |
| **Transaction** | `encryptedCategories` | Category, parent category | (none additional) |
| **Investment** | `encryptedIdentity` | Code, label, description | Code type, original currency, valuation date, deleted flag, Powens ID |
| **Investment** | `encryptedValuation` | Quantity, unit price, unit value, valuation, portfolio share, diff, diff percent | (none additional) |
| **Balance Snapshot** | `encryptedData` | Balance | Currency, date, timestamp, seed flag |

### 3.2 Field-Group Encryption

Rather than encrypting all fields of a record into a single blob, Bunkr splits fields into **field groups**. For example, a bank account has two groups: `encryptedIdentity` (name, number, IBAN) and `encryptedBalance` (balance).

This design serves several purposes:

- **Selective updates**: When a bank sync updates only your balance, only the `encryptedBalance` group needs to be re-encrypted. The identity group stays unchanged.
- **Granular access patterns**: Different parts of the application may need different subsets of data. Field groups allow decrypting only what is needed.
- **Performance**: Smaller encrypted payloads are faster to encrypt and decrypt.

Each field group is encrypted independently with its own ephemeral key, using the record ID and group name as part of the encryption context.


### 3.3 What Is NOT Encrypted (and Why)

The following metadata remains in plaintext:

- **Record IDs and foreign keys**: The database needs these to link records together (e.g., which transactions belong to which account).
- **Timestamps and dates**: Required for sorting, filtering, and displaying timelines without decrypting every record.
- **Record types and currency codes**: Used for UI rendering and aggregation queries.
- **Sync state and flags** (disabled, deleted, coming, active): Required for the server to manage sync logic without decrypting data.
- **Powens IDs**: Numeric identifiers from the banking provider, needed for sync reconciliation.

This is a deliberate trade-off: the server needs some structural metadata to function, but all **financially sensitive** information (who you bank with, your balances, transaction descriptions, investment holdings) is encrypted.


## 4. Key Management

### 4.1 Passphrase Protection

Your personal private key is protected by your passphrase using **PBKDF2** (Password-Based Key Derivation Function 2):

- **Algorithm**: PBKDF2-HMAC-SHA256
- **Iterations**: 600,000
- **Salt**: 256-bit random, unique per user
- **Output**: AES-256-GCM key

The high iteration count (600,000) makes brute-force attacks against your passphrase extremely slow. Even with specialized hardware, an attacker would need to perform 600,000 SHA-256 operations per guess. A random 32-byte salt ensures that identical passphrases produce different derived keys.

The derived AES key encrypts your personal X25519 private key using AES-GCM. The encrypted private key and the salt are stored on the server. Without your passphrase, the private key cannot be recovered.


### 4.2 Workspace Key Distribution via Key Slots

Each workspace member who has been granted access receives a **key slot** -- a copy of the workspace private key that has been encrypted to their personal public key using ECIES.

```
Workspace private key (plaintext, in owner's browser)
    |
    v  [ECIES encrypt with member's personal public key]
    |
    v
Key slot (stored on server -- encrypted, per member)
```

To unlock their vault, a member:

1. Enters their passphrase.
2. Derives their PBKDF2 key and decrypts their personal private key.
3. Uses their personal private key to decrypt their key slot via ECIES.
4. Obtains the workspace private key and can now decrypt all workspace data.

This means each member has their own passphrase and their own personal key pair, but they all ultimately access the same workspace private key.


### 4.3 Key Rotation

The workspace owner can rotate the workspace key pair at any time. This process:

1. Generates a new X25519 workspace key pair in the owner's browser.
2. Creates a new key slot for the owner (workspace private key encrypted to the owner's personal public key).
3. Updates the workspace public key on the server.
4. **Deletes all existing key slots** for other members.
5. Re-encrypts every encrypted record: decrypts with the old key, re-encrypts with the new key.
6. After all records are re-encrypted, marks the rotation as complete.

Other members will need to be re-granted access by the owner after rotation. This is by design -- key rotation is intended to revoke access from former members or to rotate keys as a security precaution.

The re-encryption happens entirely in the owner's browser. Records are processed in batches (50 at a time for snapshots and investments) to avoid overloading the browser.


### 4.4 Passphrase Loss

**If you forget your passphrase, your data cannot be recovered.** This is by design and is a fundamental property of zero-knowledge encryption.

There is no "forgot passphrase" flow, no recovery email, and no backdoor. The server does not have the information needed to decrypt your data. Store your passphrase in a secure password manager or write it down and keep it in a safe place.


## 5. Data Flow

### 5.1 End-to-End Data Flow

The complete path of your financial data:

```
Your Bank
    |
    v  [Bank's API]
Powens (banking aggregator)
    |
    v  [Powens API, HTTPS]
Bunkr Server (Convex action)
    |
    |  1. Fetches workspace public key from database
    |  2. Encrypts sensitive fields using ECIES (public key only)
    |  3. Stores encrypted data + plaintext metadata
    |
    v  [Stored in Convex database]
Encrypted records at rest
    |
    v  [Real-time sync to browser via Convex]
Your Browser
    |
    |  1. Loads encrypted records
    |  2. Retrieves workspace private key from IndexedDB
    |  3. Decrypts field groups using ECIES
    |  4. Displays plaintext data in the UI
    |
    v
You see your financial data
```

During this entire flow, the sensitive data exists in plaintext only in two places:

1. **Briefly on the server**, between receiving it from Powens and encrypting it. This window is as short as possible -- encryption happens in the same function that receives the data.
2. **In your browser**, after decryption.

The server never stores plaintext financial data at rest. Once encrypted, the original plaintext is discarded.


### 5.2 Client-Side Decryption with Web Workers

Decrypting hundreds of records (e.g., a full transaction history) can be computationally intensive. To keep the UI responsive, Bunkr offloads decryption to **Web Workers**:

- A pool of up to 4 Web Workers is created (matching available CPU cores).
- Decryption requests are distributed across workers in a round-robin fashion.
- Each worker receives the encrypted data and the private key in JWK format, performs the ECIES decryption, and returns the plaintext.
- The main thread remains free to handle UI interactions while decryption happens in the background.

When the vault is first unlocked via passphrase, the workspace private key is imported as **extractable** so that it can be serialized to JWK format and passed to Web Workers. If the key was loaded from a previous session's IndexedDB storage, it may be non-extractable, in which case decryption falls back to the main thread.


## 6. Multi-User Access

### 6.1 How Workspace Members Get Access

Bunkr workspaces can have multiple members. Here is the lifecycle of a new member gaining access to encrypted data:

1. **Invitation**: The workspace owner invites a new member by email.
2. **Onboarding**: The invited member creates an account and sets up their passphrase during onboarding. This generates their personal X25519 key pair.
3. **Pending state**: The member's personal public key is now stored on the server, but they do not yet have a key slot. They can see the workspace exists but cannot decrypt any data.
4. **Owner grants access**: The owner navigates to the Members settings page. For each pending member, the owner clicks "Grant access." This requires the owner's passphrase (if the vault is locked) to decrypt the workspace private key. The workspace private key is then encrypted to the member's personal public key, creating a key slot.
5. **Member unlocks**: The member enters their passphrase, which decrypts their personal private key, which in turn decrypts their key slot, giving them the workspace private key. They can now decrypt all workspace data.

### 6.2 Revoking Access

Access can be revoked in two ways:

- **Removing a member**: The owner removes a member from the workspace. However, since the member may have cached the workspace private key locally, this alone does not guarantee they cannot decrypt data they have already downloaded.
- **Key rotation**: For full revocation, the owner performs a key rotation. This generates a new workspace key pair and re-encrypts all data with the new key. The removed member's cached key becomes useless since all data is now encrypted with a different key.


## 7. Security Properties

### 7.1 Zero Knowledge

The server stores only:
- Encrypted private keys (protected by passphrases it does not know).
- Public keys (which cannot be used to decrypt).
- Encrypted data blobs.

At no point does the server possess the information needed to decrypt your financial data.


### 7.2 Forward Secrecy

Every encryption operation generates a **fresh ephemeral X25519 key pair**. This means:

- Each encrypted record uses a unique key derived from a unique Diffie-Hellman exchange.
- Compromising one record's encryption does not help an attacker decrypt any other record.
- The ephemeral private key is discarded immediately after encryption and never stored.


### 7.3 Authenticated Encryption

Bunkr uses AES-GCM, which provides **authenticated encryption with associated data (AEAD)**:

- **Confidentiality**: The data is encrypted and unreadable without the key.
- **Integrity**: Any tampering with the ciphertext is detected during decryption.
- **Associated data (AAD)**: Each encrypted blob includes additional authenticated data binding the ciphertext to its context: the payload version, the ephemeral public key, and the record identifier. This prevents an attacker from moving encrypted data between records or contexts.

The AAD is constructed as: `{version}|{ephemeral_public_key}|{record_context}`

This means even if an attacker could replace one encrypted blob with another, the decryption would fail because the context would not match.


### 7.4 Payload Versioning

Every encrypted payload includes a version number (`_v`). This enables future-proof schema evolution:

- If the encrypted data format needs to change, the version number allows the decryption code to migrate old payloads to the new format automatically.
- Older clients can still read data encrypted by newer clients (and vice versa) through version-aware migration logic.

This ensures that encryption upgrades do not require a disruptive migration of all existing data.


### 7.5 Domain Separation

HKDF uses a structured `info` parameter to ensure that keys derived for different purposes are cryptographically independent:

- Data encryption: `bunkr-v1|{recordId}|{fieldGroup}`
- Key slot wrapping: `bunkr-v1|keyslot`

This prevents cross-context key reuse even if the same key pair were somehow involved in multiple operations.


## 8. Trade-offs and Limitations

### 8.1 Metadata Leakage

While all sensitive financial data is encrypted, certain structural information remains visible to the server:

- **Record counts**: The server knows how many bank accounts, transactions, and investments you have.
- **Timestamps**: The server knows when records were created or last updated.
- **Record relationships**: The server knows which transactions belong to which account, and which accounts belong to which connection.
- **Field-group presence**: The server can see which field groups exist on a record and when they change, revealing that (for example) a balance was updated even though the new balance is encrypted.

This is an inherent limitation of application-level encryption. Full metadata protection would require techniques like oblivious RAM or encrypted databases, which are not practical for a real-time application.


### 8.2 No Server-Side Search

Because the server cannot read encrypted data, it cannot perform server-side search or filtering on encrypted fields. For example:

- You cannot search for transactions by wording on the server side.
- You cannot filter accounts by name on the server side.
- Sorting by encrypted balance requires client-side processing.

All search and filtering on encrypted fields must happen in the browser after decryption.


### 8.3 Passphrase Dependency

The entire security model depends on your passphrase:

- **No recovery mechanism**: If you forget your passphrase, your data is permanently inaccessible.
- **Passphrase strength matters**: A weak passphrase undermines the 600,000-iteration PBKDF2 protection. Use a strong, unique passphrase.
- **Passphrase is not rate-limited client-side**: An attacker who obtains your encrypted personal private key could attempt offline brute-force attacks. The PBKDF2 iterations make this slow, but a weak passphrase remains vulnerable.


### 8.4 Field-Group Granularity

While field-group encryption improves performance and update efficiency, it reveals which categories of data changed during a sync. For example, if only `encryptedBalance` changes on a bank account record, an observer can infer that the balance was updated even though the actual value is hidden.


### 8.5 Web Worker Key Handling

For performance, the workspace private key is imported as **extractable** in the browser, allowing it to be serialized and passed to Web Workers for parallel decryption. This means:

- The key material exists in JavaScript memory and could theoretically be accessed by malicious browser extensions or XSS attacks.
- This is a trade-off between security and performance. Non-extractable keys would be more secure but would require all decryption to happen on the main thread, degrading UI responsiveness.

This is consistent with the standard browser security model -- if an attacker has code execution in your browser, they could also intercept the decrypted data itself.


### 8.6 Transient Plaintext on Server

During a bank sync, data from Powens arrives at the server in plaintext and is encrypted before storage. For a brief moment, the plaintext exists in server memory. Bunkr minimizes this window by encrypting data in the same function that receives it, but it is not eliminated entirely. This is inherent to the architecture of server-side encryption with a public key.
